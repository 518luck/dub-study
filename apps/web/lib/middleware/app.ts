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

      /* Onboarding redirects

        - User was created less than a day ago
        - User is not invited to a workspace (redirect straight to the workspace)
        - The path does not start with /onboarding
        - User doesn't have a default workspace
        - User has not completed the onboarding flow
      */
    } else if (
      //用户创建时间 > 当前时间 - 24小时
      new Date(user.createdAt).getTime() >
        Date.now() - ONBOARDING_WINDOW_SECONDS * 1000 &&
      // onboarding (入职培训)   account (账户)  some(只要有一个满足就返回true)
      !["/onboarding", "/account"].some((p) => path.startsWith(p)) &&
      !(await getDefaultWorkspace(user)) &&
      !(await hasPendingInvites({ req, user })) &&
      (await onboardingStepCache.get({ userId: user.id })) !== "completed"
    ) {
      let step = await onboardingStepCache.get({ userId: user.id });
      if (!step) {
        return NextResponse.redirect(new URL("/onboarding", req.url));
      } else if (step === "completed") {
        return WorkspacesMiddleware(req, user);
      }

      const defaultWorkspace = await getDefaultWorkspace(user);

      if (defaultWorkspace) {
        // Skip workspace step if user already has a workspace
        step = step === "workspace" ? "link" : step;
        return NextResponse.redirect(
          new URL(`/onboarding/${step}?workspace=${defaultWorkspace}`, req.url),
        );
      } else {
        return NextResponse.redirect(new URL("/onboarding", req.url));
      }

      // if the path is / or /login or /register, redirect to the default workspace
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

    const appRedirectPath = await appRedirect(path);
    if (appRedirectPath) {
      return NextResponse.redirect(
        new URL(`${appRedirectPath}${searchParamsString}`, req.url),
      );
    }
  }

  // otherwise, rewrite the path to /app
  return NextResponse.rewrite(new URL(`/app.dub.co${fullPath}`, req.url));
}
