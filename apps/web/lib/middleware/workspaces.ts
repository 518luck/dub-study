import { UserProps } from "@/lib/types";
import { prismaEdge } from "@dub/prisma/edge";
import { NextRequest, NextResponse } from "next/server";
import { getDefaultWorkspace } from "./utils/get-default-workspace";
import { getWorkspaceProduct } from "./utils/get-workspace-product";
import { isTopLevelSettingsRedirect } from "./utils/is-top-level-settings-redirect";
import { isValidInternalRedirect } from "./utils/is-valid-internal-redirect";
import { parse } from "./utils/parse";
// 把“用户访问后台顶层地址”转换成“进入某个具体工作区的具体页面”。
export async function WorkspacesMiddleware(req: NextRequest, user: UserProps) {
  const { path, searchParamsObj, searchParamsString } = parse(req);

  // 处理 URL 里的 ?next= 参数时，要做严格校验，防止出现开放重定向漏洞（open  redirect）。
  // Handle ?next= query param with proper validation to prevent open redirects
  if (
    searchParamsObj.next &&
    isValidInternalRedirect({
      redirectPath: searchParamsObj.next,
      currentUrl: req.url,
    })
  ) {
    return NextResponse.redirect(new URL(searchParamsObj.next, req.url));
  }

  const defaultWorkspace = await getDefaultWorkspace(user);

  // If user has a default workspace, redirect them to it
  // 如果用户有默认 workspace，就先算出后面要跳到 workspace 下的哪条路径；有些顶层路
  // 径要特殊处理，不直接原样拼。
  if (defaultWorkspace) {
    let redirectPath = path;
    if (["/", "/login", "/register", "/workspaces"].includes(path)) {
      redirectPath = "";
    } else if (isTopLevelSettingsRedirect(path)) {
      redirectPath = `/settings/${path}`;
    }

    // 如果前面还没有算出具体要跳到 workspace 下的哪个路径，那就根据这个 workspace 的产
    // 品类型，给它补一个默认路径。
    if (!redirectPath) {
      const product = await getWorkspaceProduct(defaultWorkspace);
      redirectPath = `/${product}`;
    }

    return NextResponse.redirect(
      new URL(
        `/${defaultWorkspace}${redirectPath}${searchParamsString}`,
        req.url,
      ),
    );
  }

  // Redirect user to the accept invite page if they have a pending invite
  //如果用户有待处理的邀请，则将用户重定向到接受邀请页面
  // 去数据库里的 projectInvite 表查一条邀请记录
  // 找第一条符合条件的
  const projectInvite = await prismaEdge.projectInvite.findFirst({
    where: {
      email: user.email,
    },
    select: {
      project: {
        select: {
          slug: true,
        },
      },
    },
  });

  if (projectInvite) {
    return NextResponse.redirect(
      // url的意义  用当前请求的真实上下文来保证跳转地址适配当前环境。
      new URL(`/${projectInvite.project.slug}/invite`, req.url),
    );
  }

  // No default workspace or invite found, redirect to workspace onboarding
  return NextResponse.redirect(new URL("/onboarding/workspace", req.url));
}
