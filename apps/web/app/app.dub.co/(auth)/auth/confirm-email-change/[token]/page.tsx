/**
 * 邮箱变更确认页（服务端组件）
 *
 * 作用：用户点击邮件里「Confirm Email Change」按钮后跳转到此页面。
 * URL 形如：/auth/confirm-email-change/<token>
 *
 * 完整流程：
 *   1. PATCH /api/user 请求改邮箱 → 后端生成 token 写入 DB（hash 存储），
 *      把 {oldEmail, newEmail} 放进 Redis（15 分钟过期），再发确认邮件到新邮箱
 *   2. 用户点邮件按钮 → 打开本页面
 *   3. 本页面（Server Component）做以下事情：
 *      - 用 URL 里的 token 做 hash → 在 DB 里匹配 verificationToken
 *      - token 不存在/已过期 → 显示「Invalid Token」
 *      - 带 ?cancel=true → 取消请求
 *      - 校验登录态（没登录跳 /login 并带上 next 参数，登录后跳回来继续）
 *      - 从 Redis 拿到 {oldEmail, newEmail}
 *      - 真正更新数据库 email（用户表 或 partner 表）
 *      - 给老邮箱发一封「邮箱已被修改」通知邮件
 *      - 删除 token + Redis 数据（一次性使用）
 */
import { getSession, hashToken } from "@/lib/auth";
import { redis } from "@/lib/upstash";
import EmptyState from "@/ui/shared/empty-state";
import { sendEmail } from "@dub/email";
import EmailUpdated from "@dub/email/templates/email-updated";
import { prisma } from "@dub/prisma";
import { VerificationToken } from "@dub/prisma/client";
import { InputPassword, LoadingSpinner } from "@dub/ui";
import { waitUntil } from "@vercel/functions";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import ConfirmEmailChangePageClient from "./page-client";

// Next.js App Router 的页面 props 约定：
// - params：动态路由参数（这里是 URL 里的 token），Promise 形式
// - searchParams：查询字符串参数（这里用来识别 ?cancel=true），Promise 形式
interface PageProps {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ cancel?: string }>;
}

// 页面默认导出：包一层 Suspense，因为内部的 VerifyEmailChange 是异步数据获取组件，
// 在它加载期间显示一个 Loading 占位（典型 Next.js 数据流模式）
export default async function ConfirmEmailChangePage(props: PageProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-6 text-center">
      <Suspense
        fallback={
          <EmptyState
            icon={LoadingSpinner}
            title="Verifying Email Change"
            description="Verifying your email change request. This might take a few seconds..."
          />
        }
      >
        <VerifyEmailChange {...props} />
      </Suspense>
    </div>
  );
}

// 核心校验与处理逻辑组件（服务端异步组件）
const VerifyEmailChange = async ({ params, searchParams }: PageProps) => {
  // 取出 URL 动态段里的 token（明文 token，由邮件链接带来）
  const { token } = await params;

  // 用同样的 secret 算法把明文 token hash 一下，
  // 然后去 DB 里找匹配的 verificationToken 记录
  // （DB 里存的是 hash，不是明文，防止 DB 泄露后 token 被直接盗用）
  const tokenFound = await prisma.verificationToken.findUnique({
    where: {
      token: await hashToken(token, { secret: true }),
    },
  });

  // token 不存在 或 已过期 → 显示「Invalid Token」并终止
  if (!tokenFound || tokenFound.expires < new Date()) {
    return (
      <EmptyState
        icon={InputPassword}
        title="Invalid Token"
        description="This token is invalid or expired. Please request a new one."
      />
    );
  }

  // ============ 分支 1：取消邮箱变更（邮件里也有「Cancel」按钮）============
  // URL 带 ?cancel=true 表示用户点了取消按钮
  const { cancel } = await searchParams;

  if (cancel && cancel === "true") {
    // 删除 DB token 和 Redis 数据，让这个变更请求作废
    await deleteRequest(tokenFound);

    return (
      <EmptyState
        icon={InputPassword}
        title="Email Change Request Canceled"
        description="Your email change request has been canceled. No changes have been made to your account. You can close this page."
      />
    );
  }

  // ============ 分支 2：确认邮箱变更 ============
  // 必须是已登录状态；否则跳到登录页，并用 next 参数记住「登录后要回到这里继续」
  // 这样用户点完邮件链接、被要求重新登录后，仍能自动回到本流程
  const session = await getSession();

  if (!session) {
    redirect(`/login?next=/auth/confirm-email-change/${token}`);
  }

  // 从 session 里取当前用户 id 和（如果有）合作伙伴 id
  const { id: userId, defaultPartnerId: partnerId } = session.user;

  // identifier（标识符）决定从 Redis 取哪份数据：
  // - 如果 token 的 identifier 以 "pn_" 开头 → 是 partner 的邮箱变更，用 partnerId
  // - 否则是普通用户的邮箱变更，用 userId
  const identifier = tokenFound.identifier.startsWith("pn_")
    ? partnerId
    : userId;

  // 从 Redis 读取这次邮箱变更请求的详细信息
  // 这就是 confirmEmailChange 函数当初写入 Redis 的那份临时数据
  const data = await redis.get<{
    email: string;
    newEmail: string;
    isPartnerProfile?: boolean;
  }>(`email-change-request:user:${identifier}`);

  // Redis 里没有（已过期、或本来就没写过）→ 同样显示 Invalid Token
  if (!data) {
    return (
      <EmptyState
        icon={InputPassword}
        title="Invalid Token"
        description="This token is invalid. Please request a new one."
      />
    );
  }

  // ---------- 子分支 A：更新 Partner Profile 的邮箱 ----------
  if (data.isPartnerProfile) {
    // 没找到 partner id → 提示去合作伙伴站登录
    if (!partnerId) {
      return (
        <EmptyState
          icon={InputPassword}
          title="No Partner Profile Found"
          description="We couldn’t find a partner profile for your account. Please make sure you’re logged in with the correct account at https://partners.dub.co"
        />
      );
    }

    // 真正写库：更新 Partner 表的 email 字段
    await prisma.partner.update({
      where: {
        id: partnerId,
      },
      data: {
        email: data.newEmail,
      },
    });
  }

  // ---------- 子分支 B：更新普通用户的邮箱 ----------
  else {
    // 真正写库：更新 User 表的 email 字段
    await prisma.user.update({
      where: {
        id: userId,
      },
      data: {
        email: data.newEmail,
      },
    });
  }

  // ---------- 收尾：异步执行两件事（不阻塞页面返回）----------
  // 1) 删除 token 和 Redis 数据（确保一次性使用）
  // 2) 给老邮箱发一封「你的邮箱已被修改」通知邮件（安全提醒，防止用户不知情被改）
  waitUntil(
    Promise.allSettled([
      deleteRequest(tokenFound),

      sendEmail({
        subject: "Your email address has been changed",
        to: data.email,
        react: EmailUpdated({
          oldEmail: data.email,
          newEmail: data.newEmail,
          isPartnerProfile: !!data.isPartnerProfile,
        }),
      }),
    ]),
  );

  // 返回客户端组件，由它在浏览器端刷新 session 并跳转到对应设置页
  return (
    <ConfirmEmailChangePageClient isPartnerProfile={!!data.isPartnerProfile} />
  );
};

// 清理本次邮箱变更请求的所有临时数据：
// - 删 verificationToken 表里那条 token 记录（DB）
// - 删 Redis 里的 email-change-request 数据
// 用 Promise.allSettled 是为了让两个清理互相独立，即使一个失败另一个也能执行
const deleteRequest = async (tokenFound: VerificationToken) => {
  await Promise.allSettled([
    prisma.verificationToken.delete({
      where: {
        token: tokenFound.token,
      },
    }),

    redis.del(`email-change-request:user:${tokenFound.identifier}`),
  ]);
};
