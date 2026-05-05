"use server";

import { getIP } from "@/lib/api/utils/get-ip";
import { ratelimit, redis } from "@/lib/upstash";
import { sendEmail } from "@dub/email";
import VerifyEmail from "@dub/email/templates/verify-email";
import { prisma } from "@dub/prisma";
import { get } from "@vercel/edge-config";
import { flattenValidationErrors } from "next-safe-action";
import * as z from "zod/v4";
import { generateOTP } from "../auth";
import { EMAIL_OTP_EXPIRY_IN } from "../auth/constants";
import { isGenericEmail } from "../is-generic-email";
import { emailSchema, passwordSchema } from "../zod/schemas/auth";
import { throwIfAuthenticated } from "./auth/throw-if-authenticated";
import { actionClient } from "./safe-action";

const schema = z.object({
  email: emailSchema,
  password: passwordSchema.optional(),
});

// Send OTP to email to verify account
// 用 actionClient 定义一个具体的服务端 action：sendOtpAction。
// 总共分为4步
// 1. actionClient: 选用哪个基础 client
//  2. .inputSchema(...): 定义输入校验规则
//  3. .use(...): 给这个 action 单独加中间件
//  4. .action(...): 写真正业务逻辑
export const sendOtpAction = actionClient
  // inputSchema(schema,options)
  .inputSchema(schema, {
    //当输入校验失败时，你可以自己决定“返回给前端的错误长什么样”。
    handleValidationErrorsShape: async (ve) =>
      // 这个是 next-safe-action 提供的一个工具函数。把原本比较复杂的校验错误对象，压平整理成更容易用的结构。
      flattenValidationErrors(ve).fieldErrors,
  })
  .use(throwIfAuthenticated)

  // - parsedInput  已经通过 inputSchema(...) 校验后的 输入
  // - ctx  前面中间件传下来的上下文。
  // - metadata  如果这个 client 配置过 metadata，那么 action 里还能拿到。
  // - bindArgsParsedInputs 如果你用到了 bind 包装，这里会是 bind 后的完整参数。
  .action(async ({ parsedInput }) => {
    const { email } = parsedInput;

    // 1. 先按“邮箱 + IP”做频率限制，避免短时间内重复刷验证码。
    const { success } = await ratelimit(2, "1 m").limit(
      `send-otp:${email}:${await getIP()}`,
    );

    if (!success) {
      throw new Error("Too many requests. Please try again later.");
    }

    // 2. 拦截带 "+" 的泛邮箱别名，降低利用邮箱别名批量注册的风险。
    // 公共邮箱+别名不准注册
    if (email.includes("+") && isGenericEmail(email)) {
      throw new Error(
        "Email addresses with + are not allowed. Please use your work email instead.",
      );
    }

    //得到的就是邮箱域名。
    const domain = email.split("@")[1];

    //只有当前运行环境是 Dub 主站时，才执行这段逻辑
    if (process.env.NEXT_PUBLIC_IS_DUB) {
      // 3. 在 Dub 主站场景下额外校验邮箱域名，过滤一次性邮箱和命中黑名单规则的域名。
      //查当前邮箱域名是不是一次性邮箱
      //读取一份“可疑邮箱域名规则”
      const [isDisposable, emailDomainTerms] = await Promise.all([
        //某个值，是否属于 Redis 里的某个集合。
        redis.sismember("disposableEmailDomains", domain),
        process.env.EDGE_CONFIG ? get("emailDomainTerms") : [],
      ]);

      // Only build the regex if we have at least one term; otherwise set to null
      const blacklistedEmailDomainTermsRegex =
        emailDomainTerms && Array.isArray(emailDomainTerms)
          ? new RegExp(
              emailDomainTerms
                .map((term: string) =>
                  term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
                ) // replace special characters with escape sequences
                .join("|"),
            )
          : null;

      if (
        isDisposable ||
        (blacklistedEmailDomainTermsRegex &&
          blacklistedEmailDomainTermsRegex.test(domain))
      ) {
        // 4. 如果域名可疑，再检查是否属于历史 partner 或申请用户；命中特例则允许继续。
        // edge case: the user already has a partner account on Dub with this email address,
        // or they have an existing application for a program, we can allow them to continue
        const [isPartnerAccount, hasExistingApplications] = await Promise.all([
          prisma.partner.findUnique({
            where: {
              email,
            },
          }),
          prisma.programApplication.findFirst({
            where: {
              email,
            },
          }),
        ]);
        if (!isPartnerAccount && !hasExistingApplications) {
          throw new Error(
            "Invalid email address – please use your work email instead. If you think this is a mistake, please contact us at dub.co/support",
          );
        }
      }
    }

    // 5. 如果这个邮箱已经注册成正式用户，则终止流程并提示去登录。
    const isExistingUser = await prisma.user.findUnique({
      where: {
        email,
      },
    });

    if (isExistingUser) {
      throw new Error(
        "User already exists. Please login instead of requesting a new OTP.",
      );
    }

    // 6. 生成新的 OTP 验证码，后面会同时写入数据库并发送邮件。
    const code = generateOTP();

    // 7. 先清理该邮箱旧的验证码记录，保证只保留最新的一份。
    await prisma.emailVerificationToken.deleteMany({
      where: {
        identifier: email,
      },
    });

    // 8. 并行完成两件事：保存验证码记录，以及发送验证码邮件。
    await Promise.all([
      prisma.emailVerificationToken.create({
        data: {
          identifier: email,
          token: code,
          expires: new Date(Date.now() + EMAIL_OTP_EXPIRY_IN * 1000),
        },
      }),

      sendEmail({
        subject: `${process.env.NEXT_PUBLIC_APP_NAME}: OTP to verify your account`,
        to: email,
        react: VerifyEmail({
          email,
          code,
        }),
      }),
    ]);
  });
