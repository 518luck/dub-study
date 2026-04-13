import { UserProps } from "@/lib/types";
import { getToken } from "next-auth/jwt";
import { NextRequest } from "next/server";

// 从当前请求里解析登录 token，并取出里面的用户信息返回。
//通过token获取用户
export async function getUserViaToken(req: NextRequest) {
  const session = (await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET,
  })) as {
    email?: string;
    user?: UserProps;
  };

  return session?.user;
}
