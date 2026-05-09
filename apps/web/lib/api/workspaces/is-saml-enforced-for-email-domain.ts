import { prisma } from "@dub/prisma";
import { APP_HOSTNAMES } from "@dub/utils";
import { headers } from "next/headers";
import { isGenericEmail } from "../../is-generic-email";

// 判断这个邮箱域名是否被强制要求使用 SAML SSO 登录。
// 如果返回 true，说明密码登录和其他非 SAML 登录方式都应该被拦截。
export const isSamlEnforcedForEmailDomain = async (email: string) => {
  // 读取当前请求的 host，只在应用自己的主域名下启用这套 SSO 强制逻辑。
  const hostname = (await headers()).get("host");
  // 从邮箱中取出域名部分，例如 "user@company.com" -> "company.com"。
  const emailDomain = email.split("@")[1].toLocaleLowerCase();

  if (
    !hostname ||
    !emailDomain ||
    // 只有主应用域名才允许做 SSO 强制判断。
    !APP_HOSTNAMES.has(hostname) ||
    // Gmail、QQ 邮箱这类通用个人邮箱不属于企业域名，
    // 不应该触发 workspace 级别的 SAML 强制登录。
    isGenericEmail(email)
  ) {
    return false;
  }

  // 查询是否有 workspace 把这个邮箱域名配置成了 SAML 登录域名。
  const workspace = await prisma.project.findUnique({
    where: {
      ssoEmailDomain: emailDomain,
    },
    select: {
      // 这个字段不为空，表示管理员明确开启了“强制 SSO 登录”。
      ssoEnforcedAt: true,
    },
  });

  // 只要开启了强制 SSO，调用方就应该要求用户走 SAML 登录流程。
  if (workspace?.ssoEnforcedAt) {
    return true;
  }

  return false;
};
