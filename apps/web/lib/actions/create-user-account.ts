"use server";

import { ratelimit } from "@/lib/upstash";
import { prisma } from "@dub/prisma";
import { waitUntil } from "@vercel/functions";
import { flattenValidationErrors } from "next-safe-action";
import * as z from "zod/v4";
import { createId } from "../api/create-id";
import { skipAuthThrottling } from "../api/environment";
import { hashPassword } from "../auth/password";
import { signUpSchema } from "../zod/schemas/auth";
import { throwIfAuthenticated } from "./auth/throw-if-authenticated";
import { actionClient } from "./safe-action";

const schema = signUpSchema.extend({
  code: z.string().min(6, "OTP must be 6 characters long."),
});

const MAX_OTP_ATTEMPTS = 5; // Block after 5 failed attempts
const OTP_LOCKOUT_DURATION = "24 h"; // Block for 24 hours

// 使用邮箱、密码和验证码完成注册。
export const createUserAccountAction = actionClient
  .inputSchema(schema, {
    // 把 Zod 校验错误整理成前端更容易消费的字段级错误结构。
    handleValidationErrorsShape: async (ve) =>
      flattenValidationErrors(ve).fieldErrors,
  })
  // 已登录用户不允许再次走注册流程。
  .use(throwIfAuthenticated)
  .action(async ({ parsedInput }) => {
    // 取出本次注册提交的邮箱、密码和 OTP 验证码。
    const { email, password, code } = parsedInput;

    // 按邮箱维度记录注册验证码失败次数。
    const signupAttemptKey = `signup:attempts:${email}`;

    if (!skipAuthThrottling) {
      // 先查询当前邮箱在锁定窗口内还剩多少次验证码尝试机会。
      const { remaining: attemptsRemaining } = await ratelimit(
        MAX_OTP_ATTEMPTS,
        OTP_LOCKOUT_DURATION,
      ).getRemaining(signupAttemptKey);

      // 如果失败次数已耗尽，直接拒绝继续尝试。
      if (attemptsRemaining <= 0) {
        throw new Error(
          "Too many failed attempts. You have to try again later.",
        );
      }
    }

    // 校验邮箱和验证码是否能在数据库里匹配到有效记录。
    const verificationToken = await prisma.emailVerificationToken.findUnique({
      where: {
        identifier: email,
        token: code,
      },
    });

    if (!verificationToken) {
      // 验证码错误时累计一次失败次数。
      await ratelimit(MAX_OTP_ATTEMPTS, OTP_LOCKOUT_DURATION).limit(
        signupAttemptKey,
      );

      // 验证码不匹配时终止注册。
      throw new Error("Invalid verification code entered.");
    }

    if (verificationToken.expires && verificationToken.expires < new Date()) {
      // 过期验证码异步清理掉，避免脏数据残留。
      waitUntil(
        prisma.emailVerificationToken.delete({
          where: {
            identifier: email,
            token: code,
          },
        }),
      );

      // 验证码过期时提示用户重新获取。
      throw new Error("The OTP has expired. Please request a new one.");
    }

    // 验证通过后立即删除验证码，避免重复使用。
    await prisma.emailVerificationToken.delete({
      where: {
        identifier: email,
        token: code,
      },
    });

    // 再查一次用户是否已存在，避免重复创建账号。
    const user = await prisma.user.findUnique({
      where: {
        email,
      },
    });

    if (!user) {
      // 首次注册时创建用户，并保存密码哈希与默认通知配置。
      await prisma.user.create({
        data: {
          id: createId({ prefix: "user_" }),
          email,
          passwordHash: await hashPassword(password),
          emailVerified: new Date(),
          notificationPreferences: {
            create: {},
          },
        },
      });
    }
  });
