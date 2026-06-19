import { sendEmail } from "@dub/email";
import ConfirmEmailChange from "@dub/email/templates/confirm-email-change";
import { prisma } from "@dub/prisma";
import { waitUntil } from "@vercel/functions";
import { randomBytes } from "crypto";
import { hashToken } from ".";
import { DubApiError } from "../api/errors";
import { ratelimit, redis } from "../upstash";

/**
 * 发起「邮箱变更确认」流程（生成 token + 写 Redis + 发邮件）
 *
 * 使用场景：
 *   - 普通用户在 /account/settings 改邮箱（PATCH /api/user）
 *   - Partner 在 /profile 改邮箱（update-partner-profile action）
 *
 * 注意：此函数只负责「发起确认」，并不直接修改邮箱。
 * 真正的邮箱修改发生在用户点邮件按钮后访问的页面：
 *   app/app.dub.co/(auth)/auth/confirm-email-change/[token]/page.tsx
 *
 * 完整流程：
 *   ① 限流检查（防邮件轰炸）
 *   ② 清掉该用户历史遗留的 token（保证同时只有一个有效）
 *   ③ 生成 32 字节随机 token，DB 里存 hash（不存明文）
 *   ④ 把 {oldEmail, newEmail} 放进 Redis（15 分钟过期）
 *   ⑤ 异步发确认邮件到新邮箱
 *
 * 安全设计要点：
 *   - DB 存 hash 而非明文：DB 泄露后 token 也无法直接使用
 *   - token + Redis 数据分离：必须同时拥有合法 token 和原始登录态才能改库
 *   - 15 分钟过期 + 限流 3 次/天：防止长期有效的钓鱼链接和邮件轰炸
 */
// Send the OTP to confirm the email address change for existing users/partners
export const confirmEmailChange = async ({
  email, // 当前（旧）邮箱，用于邮件正文展示 + 后续通知
  newEmail, // 想更换成的新邮箱，确认邮件会发到这里
  identifier, // 用户唯一标识（普通用户是 userId，Partner 是 partnerId）
  isPartnerProfile = false, // 是否是 Partner 资料的邮箱变更（影响后续走 Partner 表还是 User 表）
  hostName, // 邮件里确认按钮指向的域名（APP_DOMAIN 或 PARTNERS_DOMAIN）
}: {
  email: string;
  newEmail: string;
  identifier: string;
  isPartnerProfile?: boolean; // If true, the email is being changed for a partner profile
  hostName: string;
}) => {
  // ============ ① 限流：同一用户每天最多 3 次邮箱变更请求 ============
  // 防止恶意用户通过反复触发来轰炸目标邮箱（发大量确认邮件）
  const { success } = await ratelimit(3, "1 d").limit(
    `email-change-request:${identifier}`,
  );

  if (!success) {
    // 触发限流 → 直接抛 429 错误，前端会收到 rate_limit_exceeded
    throw new DubApiError({
      code: "rate_limit_exceeded",
      message:
        "You've requested too many email change requests. Please try again later.",
    });
  }

  // ============ ② 清理该用户历史遗留的 verificationToken ============
  // 每次发起新请求前先删掉旧的，保证同一时刻只有一个有效 token，
  // 避免「用户连续点了两次改邮箱」后两个链接都能用造成的混乱
  // Remove existing verification tokens
  await prisma.verificationToken.deleteMany({
    where: {
      identifier,
    },
  });

  // ============ ③ 生成新 token 并写入数据库（存 hash 不存明文）============
  // randomBytes(32) → 256 bit 随机数，转 hex 后是 64 字符的字符串
  // 这个明文 token 会拼进邮件链接发给用户；DB 里只存它的 hash
  const token = randomBytes(32).toString("hex");
  // 过期时间 15 分钟（毫秒）
  const expiresIn = 15 * 60 * 1000;

  // Create a new verification token
  await prisma.verificationToken.create({
    data: {
      identifier, // 关联用户，后面用 identifier 反查
      // hashToken 用 secret 加盐哈希，DB 泄露时攻击者也无法逆推明文
      // 用户点链接时，URL 里的明文 token 会被同样 hash 一次再去 DB 匹配
      token: await hashToken(token, { secret: true }),
      expires: new Date(Date.now() + expiresIn), // 15 分钟后失效
    },
  });

  // ============ ④ 把变更详情写入 Redis（落地页会读这份信息）============
  // 之所以要把 {oldEmail, newEmail} 放 Redis 而不是 DB：
  //   - 临时数据，15 分钟后自动清理，不需要永久存储
  //   - Redis 自带 TTL 机制，到期自动删除，不用手动维护
  //   - 读性能好，落地页打开时能快速拿到
  //
  // 落地页（confirm-email-change/[token]/page.tsx）会读这个 key，
  // 拿到 newEmail 后调 prisma.user.update 真正改库
  // Set the email change request in Redis, we'll use this to verify the email change in /auth/confirm-email-change/[token]
  await redis.set(
    `email-change-request:user:${identifier}`,
    {
      email,
      newEmail,
      // 只有 Partner 流程才带这个标记，落地页据此决定改 User 表还是 Partner 表
      ...(isPartnerProfile && { isPartnerProfile }),
    },
    {
      px: expiresIn, // 毫秒级过期时间，和 token 保持一致（15 分钟）
    },
  );

  // ============ ⑤ 异步发送确认邮件到新邮箱 ============
  // waitUntil 是 Vercel 提供的工具：函数返回后仍允许这个 Promise 继续执行完，
  // 不会被服务器提前掐断。这样 API 响应不用等邮件真发出去才返回。
  //
  // 邮件正文由 ConfirmEmailChange 模板渲染（位于 packages/email/templates/），
  // 模板里的「Confirm Email Change」按钮就是 <a href={confirmUrl}>
  // 用户点按钮 → 打开 hostName/auth/confirm-email-change/<token> → 走落地页流程
  waitUntil(
    sendEmail({
      subject: "Confirm your email address change",
      to: newEmail, // 发到新邮箱（验证新邮箱确实属于本人）
      react: ConfirmEmailChange({
        email, // 旧邮箱，邮件里会展示「from old@x to new@x」
        newEmail,
        // 邮件按钮的最终链接：
        //   hostName = APP_DOMAIN（如 https://dub.co）或 PARTNERS_DOMAIN（如 https://partners.dub.co）
        //   拼上固定路径 + 明文 token
        confirmUrl: `${hostName}/auth/confirm-email-change/${token}`,
      }),
    }),
  );
};
