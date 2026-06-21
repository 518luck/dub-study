"use client";

// 文件名叫 auth 只是开发者的命名约定，表示“这里集中放置 workspace 级别的鉴权逻辑”。
// 它在 [slug]/layout.tsx 中被作为布局组件包裹整个 [slug] 路由段，
// 因此所有 /<workspace-slug>/... 下的页面，在渲染前都会先经过这里的鉴权校验。
import { ErrorCodes } from "@/lib/api/error-codes";
import useWorkspace from "@/lib/swr/use-workspace";
import LayoutLoader from "@/ui/layout/layout-loader";
import { notFound, redirect, useParams } from "next/navigation";
import type { ReactNode } from "react";

// 工作空间鉴权组件
// 作用：作为 [slug] 路由段的“守卫”，在子页面渲染前，先根据 useWorkspace 的请求结果
// 判断当前用户能否进入该 workspace，并处理三种异常情况（不存在 / 邀请待处理 / 邀请已过期）。
export default function WorkspaceAuth({ children }: { children: ReactNode }) {
  // 从路由参数中取出 workspace 的 slug，后续拼邀请页跳转地址时会用到。
  const { slug } = useParams();
  // useWorkspace 内部会根据 slug 发请求拉取当前 workspace 的数据。
  // 这里只关心 loading 和 error 两个状态：
  //   - loading=true：请求进行中
  //   - error：请求失败时带有 status（HTTP 状态码），用来区分失败原因
  const { loading, error } = useWorkspace();

  // 请求进行中：先用全屏 loader 占位，避免在数据还没回来时露出子页面。
  if (loading) {
    return <LayoutLoader />;
  }

  // 请求出错：根据错误码分流到不同的处理方式。
  if (error) {
    // 404：该 workspace 不存在（或当前用户无权看到）。直接渲染 404 页面。
    // notFound() 是 next/navigation 提供的方法，会触发 Next.js 的 not-found.tsx。
    if (error.status === ErrorCodes.not_found) {
      notFound();
    } else if (
      // 409(invite_pending) 或 410(invite_expired)：
      // 说明当前用户对这个 workspace 有一份“邀请”，但邀请还未被接受 / 已经过期，
      // 没法直接进入。这时重定向到该 workspace 的邀请处理页，让用户在那里接受或重新发起邀请。
      [ErrorCodes.invite_pending, ErrorCodes.invite_expired].includes(
        error.status,
      )
    ) {
      redirect(`/${slug}/invite`);
    }
  }

  // 上面所有异常情况都未命中，说明用户对该 workspace 有合法访问权限，
  // 正常渲染子页面内容（即 [slug] 路由段下真正的业务页面）。
  return children;
}
