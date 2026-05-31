"use server";

import { getIP } from "@/lib/api/utils/get-ip";
import { ratelimit } from "@/lib/upstash";
import { prisma } from "@dub/prisma";
import * as z from "zod/v4";
import { skipAuthThrottling } from "../api/environment";
import { isSamlEnforcedForEmailDomain } from "../api/workspaces/is-saml-enforced-for-email-domain";
import { emailSchema } from "../zod/schemas/auth";
import { throwIfAuthenticated } from "./auth/throw-if-authenticated";
import { actionClient } from "./safe-action";

const schema = z.object({
  email: emailSchema,
});

// 登录前检查账号状态：账号是否存在、是否有密码、是否必须使用 SAML 登录。
export const checkAccountExistsAction = actionClient
  // 只允许传入合法邮箱。
  .inputSchema(schema)
  // 已登录用户不需要走登录前检查，直接拦截。
  .use(throwIfAuthenticated)
  .action(async ({ parsedInput }) => {
    const { email } = parsedInput;

    if (!skipAuthThrottling) {
      // 按 IP 限流，降低批量探测邮箱是否注册的风险。
      const { success } = await ratelimit(8, "1 m").limit(
        `account-exists:${await getIP()}`,
      );

      if (!success) {
        throw new Error("Too many requests. Please try again later.");
      }
    }

    // 并发查询账号密码状态和邮箱域名的 SAML 强制策略。
    const [user, isSamlEnforced] = await Promise.all([
      prisma.user.findUnique({
        where: {
          email,
        },
        select: {
          // 只需要知道是否存在密码，不返回完整用户信息。
          passwordHash: true,
        },
      }),

      isSamlEnforcedForEmailDomain(email),
    ]);

    return {
      // 是否存在这个邮箱对应的用户。
      accountExists: !!user,
      // 用户是否设置过密码；如果没有用户或没有密码哈希，则为 false。
      hasPassword: !!user?.passwordHash,
      // 该邮箱域名是否要求通过企业 SAML/SSO 登录。
      requireSAML: isSamlEnforced,
    };
  });
