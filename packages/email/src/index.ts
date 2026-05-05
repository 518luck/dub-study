import { resend } from "./resend";
import { ResendBulkEmailOptions, ResendEmailOptions } from "./resend/types";
import { sendViaNodeMailer } from "./send-via-nodemailer";
import { sendBatchEmailViaResend, sendEmailViaResend } from "./send-via-resend";

// 自定义发送方式
// 统一邮件发送入口
export const sendEmail = async (opts: ResendEmailOptions) => {
  // 优先走 Resend 发送
  if (resend) {
    return await sendEmailViaResend(opts);
  }

  // Fallback to SMTP if Resend is not configured
  //如果没配 Resend，就回退到 SMTP 发送
  const smtpConfigured = Boolean(
    process.env.SMTP_HOST && process.env.SMTP_PORT,
  );

  if (smtpConfigured) {
    const { to, subject, text, react } = opts;
    return await sendViaNodeMailer({
      to, //收件人
      subject, //主题
      text, //纯文本内容
      react, //React 组件（用于生成 HTML 内容）
    });
  }

  console.info(
    "Email sending failed: Neither SMTP nor Resend is configured. Please set up at least one email service to send emails.",
  );
};

// 批量发送邮件
export const sendBatchEmail = async (
  emails: ResendBulkEmailOptions,
  options?: { idempotencyKey?: string },
) => {
  if (resend) {
    return await sendBatchEmailViaResend(emails, options);
  }

  // Fallback to SMTP if Resend is not configured
  const smtpConfigured = Boolean(
    process.env.SMTP_HOST && process.env.SMTP_PORT,
  );

  if (smtpConfigured) {
    await Promise.all(
      emails.map((p) =>
        sendViaNodeMailer({
          to: p.to,
          subject: p.subject,
          text: p.text,
          react: p.react,
        }),
      ),
    );

    return {
      data: null,
      error: null,
    };
  }

  console.info(
    "Email sending failed: Neither SMTP nor Resend is configured. Please set up at least one email service to send emails.",
  );

  return {
    data: null,
    error: null,
  };
};
