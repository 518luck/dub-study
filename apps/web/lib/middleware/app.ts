import { NextRequest, NextResponse } from "next/server";
import {
  ONBOARDING_WINDOW_SECONDS,
  onboardingStepCache,
} from "../api/workspaces/onboarding-step-cache";
import { EmbedMiddleware } from "./embed";
import { NewLinkMiddleware } from "./new-link";
import { appRedirect } from "./utils/app-redirect";
import { getDefaultWorkspace } from "./utils/get-default-workspace";
import { getUserViaToken } from "./utils/get-user-via-token";
import { hasPendingInvites } from "./utils/has-pending-invites";
import { isTopLevelSettingsRedirect } from "./utils/is-top-level-settings-redirect";
import { parse } from "./utils/parse";
import { WorkspacesMiddleware } from "./workspaces";

//  处理 app 站点请求的“入口分流、登录校验、onboarding 重定向、默认工作区跳转，以及最终 rewrite 到 app.dub.co 路由目录”。
export async function AppMiddleware(req: NextRequest) {
  //path, // 当前请求的路径部分，不包含 query，例如 /acme/links
  //fullPath, // 完整的路径部分，包含 query，例如 /acme/links?sort=name
  //searchParamsString, // 查询参数部分，例如 ?sort=name
  const { path, fullPath, searchParamsString } = parse(req);

  if (path.startsWith("/embed")) {
    return EmbedMiddleware(req);
  }

  // 尝试从 cookie 中获取用户。
  const user = await getUserViaToken(req);

  // if there's no user and the path isn't /login or /register, redirect to /login
  // 用户如果没有登陆,就不让他访问后台页面，而是把他重定向到登录页。
  if (
    !user &&
    path !== "/login" &&
    path !== "/forgot-password" &&
    path !== "/register" &&
    path !== "/auth/saml" &&
    !path.startsWith("/auth/reset-password/") &&
    !path.startsWith("/share/") &&
    !path.startsWith("/deeplink/")
  ) {
    // 重定向到登录页。
    return NextResponse.redirect(
      //   如果用户未登录，就把他送到登录页；如果他本来想访问的是别的页面，就把原目
      //  标地址塞进 next 参数，方便登录后跳回来。
      // 只要你把“一个 URL/路径”当作“另一个 URL 的参数值”来传，通常就必须编码。使用encodeURIComponent
      new URL(
        `/login${path === "/" ? "" : `?next=${encodeURIComponent(fullPath)}`}`,
        req.url,
      ),
    );

    // if there's a user
  } else if (user) {
    // /new is a special path that creates a new link (or workspace if the user doesn't have one yet)
    if (path === "/new") {
      return NewLinkMiddleware(req, user);

      /*新手引导重定向*
            用户创建时间少于一天
            用户未被邀请加入任何工作空间（直接重定向至工作空间流程）
            当前路径不是以 /onboarding 开头
            用户没有默认的工作空间
            用户尚未完成新手引导流程
      */
    } else if (
      //用户创建时间 > 当前时间 - 24小时
      new Date(user.createdAt).getTime() >
        Date.now() - ONBOARDING_WINDOW_SECONDS * 1000 &&
      // onboarding (入职培训)   account (账户)  some(只要有一个满足就返回true)
      !["/onboarding", "/account"].some((p) => path.startsWith(p)) &&
      //并且当前用户还没有默认 workspace。
      !(await getDefaultWorkspace(user)) &&
      //并且这个用户当前没有待处理的邀请。
      !(await hasPendingInvites({ req, user })) &&
      // “这个用户的 onboarding 是否还没完成？”
      (await onboardingStepCache.get({ userId: user.id })) !== "completed"
    ) {
      let step = await onboardingStepCache.get({ userId: user.id });
      if (!step) {
        //如果当前用户还没有记录任何 onboarding 步骤，就把他重定向到 onboarding 入口页。
        return NextResponse.redirect(new URL("/onboarding", req.url));
      } else if (step === "completed") {
        return WorkspacesMiddleware(req, user);
      }

      // 拿到当前用户默认应该进入的 workspace。
      const defaultWorkspace = await getDefaultWorkspace(user);

      //如果用户已经有默认 workspace，就跳到对应的 onboarding 步骤页面，并把 workspace
      // 带上；如果没有 workspace，就回到 onboarding 总入口。
      if (defaultWorkspace) {
        // Skip workspace step if user already has a workspace
        step = step === "workspace" ? "link" : step;
        return NextResponse.redirect(
          new URL(`/onboarding/${step}?workspace=${defaultWorkspace}`, req.url),
        );
      } else {
        return NextResponse.redirect(new URL("/onboarding", req.url));
      }

      // 如果访问的是“不带 workspace slug 的顶级页面”，就把它交给 WorkspacesMiddleware 处理。
      // WorkspacesMiddleware 会解析出当前用户的默认 workspace，然后把用户重定向到
      // /<workspace-slug>/<对应子页面>，例如访问 /links 会跳到 /acme/links。
      // 这里涵盖三类路径：
      //   1. 一组固定的顶级路径（根路径、登录注册后落地页、以及不带 slug 的功能入口，
      //      如 /links、/analytics、/program、/settings、/upgrade、/wrapped 等）。
      //   2. 以 /program/ 或 /settings/ 开头的路径（例如 /program/settings、/settings/billing）。
      //   3. 顶层 settings 相关的旧路径（/domains、/integrations、/webhooks 及其子路径），
      //      由 isTopLevelSettingsRedirect 判定，这些都需要并入 workspace settings 体系。
    } else if (
      [
        "/",
        "/login",
        "/register",
        "/workspaces",
        "/links",
        "/analytics",
        "/events",
        "/customers",
        "/program",
        "/programs",
        "/settings",
        "/upgrade",
        "/guides",
        "/wrapped",
      ].includes(path) ||
      path.startsWith("/program/") ||
      path.startsWith("/settings/") ||
      isTopLevelSettingsRedirect(path)
    ) {
      return WorkspacesMiddleware(req, user);
    }

    // 走到这里说明路径已经是带 workspace slug 的“具体业务路径”（例如 /acme/links）。
    // 调用 appRedirect 检查该路径是否命中“路径迁移规则”：可能是旧路径需要跳到新路径
    // （如 /account → /account/settings），也可能是 /<slug> 这种根路径需要补上默认
    // product（如 /acme → /acme/links）。命中则直接 302 重定向到目标路径，并保留原 query。
    const appRedirectPath = await appRedirect(path);
    if (appRedirectPath) {
      return NextResponse.redirect(
        new URL(`${appRedirectPath}${searchParamsString}`, req.url),
      );
    }
  }

  // 经过前面所有分流后仍未处理的请求，统一 rewrite 到 /app.dub.co 路由目录下。
  // rewrite（而非 redirect）对用户是透明的：浏览器地址栏不变，但内部会去 app.dub.co
  // 路由树里匹配真正的页面组件来渲染。
  return NextResponse.rewrite(new URL(`/app.dub.co${fullPath}`, req.url));
}
