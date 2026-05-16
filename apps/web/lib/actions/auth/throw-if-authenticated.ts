import { getSession } from "@/lib/auth";

// 如果用户已登录，就抛出错误。常用于注册、登录等入口。
export const throwIfAuthenticated = async ({ next, ctx }) => {
  const session = await getSession();

  if (session) {
    throw new Error("You are already logged in.");
  }

  return next({ ctx });
};
