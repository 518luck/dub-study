"use client";

/**
 * 邮箱变更确认页 - 客户端组件
 *
 * 作用：当 server 端（page.tsx）已经成功更新完邮箱后，把这个组件渲染给用户。
 * 它负责在浏览器端做最后的「状态同步」：
 *   1. 调用 useSession 的 update() 强制刷新 session（拿到新的 email）
 *   2. toast 提示「修改成功」
 *   3. 根据是 partner 还是普通用户，跳转到对应的设置页面
 *
 * 为什么要放到客户端做？
 *   - session 是 cookie 里的，必须在浏览器侧触发 next-auth 的 update
 *   - 路由跳转（router.replace）也是客户端行为
 *   - 在等待/跳转期间先显示一个 Loading 占位，避免用户误以为页面卡住
 */
import { EmptyState, LoadingSpinner } from "@dub/ui";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { toast } from "sonner";

// isPartnerProfile 由父级 page.tsx 传进来，
// 用来决定最终跳到 /profile（合作伙伴）还是 /account/settings（普通用户）
export default async function ConfirmEmailChangePageClient({
  isPartnerProfile,
}: {
  isPartnerProfile: boolean;
}) {
  const router = useRouter();
  // update：next-auth 提供的方法，用来手动触发 session 刷新
  // status：当前登录状态，取值 "loading" | "authenticated" | "unauthenticated"
  const { update, status } = useSession();
  // 用 ref 做单次执行标记，防止 React 18 StrictMode 下 useEffect 被执行两次
  // （StrictMode 在开发环境会故意重复执行 effect 来暴露副作用 bug）
  const hasUpdatedSession = useRef(false);

  useEffect(() => {
    // 还没确认登录态，或已经更新过一次了 → 直接返回，不重复执行
    if (status !== "authenticated" || hasUpdatedSession.current) {
      return;
    }

    // 真正的「刷新 session + 提示 + 跳转」逻辑
    async function updateSession() {
      // 立刻置位，确保即使函数还在 await，也不会被再次触发
      hasUpdatedSession.current = true;
      // 强制刷新 session（这样 session.user.email 就会是最新的）
      await update();
      toast.success("Successfully updated your email!");
      // 跳到对应的设置页面（partner 跳 /profile，普通用户跳 /account/settings）
      router.replace(isPartnerProfile ? "/profile" : "/account/settings");
    }

    updateSession();
  }, [status, update]);

  // 在 useEffect 执行期间，先显示一个 Loading 占位
  // 用户看到「Verifying...」几秒后会被 toast + 跳转替换掉
  return (
    <EmptyState
      icon={LoadingSpinner}
      title="Verifying Email Change"
      description="Verifying your email change request. This might take a few seconds..."
    />
  );
}
