import type { CreateEmailOptions } from "resend";
import { resend } from "./resend";
import { VARIANT_TO_FROM_MAP } from "./resend/constants";
import { ResendBulkEmailOptions, ResendEmailOptions } from "./resend/types";

//接收项目自己的 ResendEmailOptions，转为 Resend 原生的 CreateEmailOptions，
const resendEmailForOptions = (
  opts: ResendEmailOptions,
): CreateEmailOptions => {
  const {
    to,
    from,
    variant = "primary",
    bcc,
    replyTo,
    subject,
    text,
    react,
    scheduledAt,
    headers,
    tags,
    unsubscribeUrl,
  } = opts;

  //这两个是 Vercel 部署时的环境变量，用于在非生产环境中做开发防护：
  //判断当前部署是否是 Vercel 的生产环境。
  const isProdEnv = process.env.VERCEL_ENV === "production";
  //获取当前部署对应的 git 分支名。
  const gitBranch = process.env.VERCEL_GIT_COMMIT_REF;

  // 构建不包含渲染输出（react/text）的基础选项
  // CreateEmailOptions 至少需要 react 或 text 中的一个
  const baseOptions = {
    to: isProdEnv ? to : "delivered@resend.dev",
    from: from || VARIANT_TO_FROM_MAP[variant],
    subject: `${subject}${!isProdEnv && gitBranch ? ` [${gitBranch}]` : ""}`,
    bcc,
    // 如果 replyTo 被设置为 "noreply@dub.co"，则不设置 replyTo
    // 否则将其设置为 replyTo 的值，或者回退到默认值 support@dub.co
    ...(replyTo === "noreply" ? {} : { replyTo: replyTo || "support@dub.co" }),
    scheduledAt,
    tags,
    ...(variant === "marketing"
      ? {
          headers: {
            ...(headers || {}),
            "List-Unsubscribe":
              unsubscribeUrl || "https://app.dub.co/account/settings",
          },
        }
      : headers && { headers }),
  };

  // Add render options (react or text) - at least one must be present
  if (react) {
    return { ...baseOptions, react };
  }
  if (text) {
    return { ...baseOptions, text };
  }
  // If none of react or text is provided, we need to ensure at least one is present
  // This shouldn't happen in practice, but we'll default to an empty text
  return { ...baseOptions, text: "" };
};

// 单封发送 sendEmailViaResend（
// Send email using Resend (Recommended for production)
export const sendEmailViaResend = async (opts: ResendEmailOptions) => {
  if (!resend) {
    console.info(
      "RESEND_API_KEY is not set in the .env. Skipping sending email.",
    );
    return;
  }

  return await resend.emails.send(resendEmailForOptions(opts));
};

//  一人一封，批量发送多封不同的邮件
// 比如：用户 A 发"密码重置"，用户 B 发"欢迎注册"——一次调用，两封不同邮件同时发出
export const sendBatchEmailViaResend = async (
  emails: ResendBulkEmailOptions,
  options?: { idempotencyKey?: string },
) => {
  if (!resend) {
    console.info(
      "RESEND_API_KEY is not set in the .env. Skipping sending email.",
    );
    // 保持返回结构一致。正常发送成功时 resend.batch.send() 也返回 { data, error }
    return {
      data: null,
      error: null,
    };
  }

  if (emails.length === 0) {
    return {
      data: null,
      error: null,
    };
  }

  // 过滤掉没有收件人地址的邮件，并格式化为 Resend 所需格式
  // 语法
  // array.reduce((累积值, 当前元素) => { ... }, 初始值)
  const filteredBatch = emails.reduce(
    (acc, email) => {
      if (!email?.to) {
        return acc;
      }

      acc.push(resendEmailForOptions(email));

      return acc;
    },
    [] as ReturnType<typeof resendEmailForOptions>[],
  );

  if (filteredBatch.length === 0) {
    return {
      data: null,
      error: null,
    };
  }

  const idempotencyKey = options?.idempotencyKey || undefined;

  return await resend.batch.send(
    filteredBatch,
    idempotencyKey ? { idempotencyKey } : undefined,
  );
};
