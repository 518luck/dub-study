import { UserProps } from "@/lib/types";
import { prismaEdge } from "@dub/prisma/edge";
import { NextRequest } from "next/server";

//判断当前用户是否还有待处理的邀请。
export async function hasPendingInvites({
  req,
  user,
}: {
  req: NextRequest;
  user: UserProps;
}) {
  if (
    //  只要 URL 里带了 invite 查询参数，或者当前路径是以 /invites/ 开头，就认为这是一个邀请相关请求。
    req.nextUrl.searchParams.get("invite") ||
    req.nextUrl.pathname.startsWith("/invites/")
  ) {
    //当前请求已经明显处在“处理邀请”的流程里了，就认为存在待处理邀请。
    return true;
  }

  const pendingInvites = await prismaEdge.projectInvite.count({
    where: {
      email: user.email,
      //expires: 数据库表中的“过期时间”字段。
      expires: {
        //gte: 是 Greater Than or Equal 的缩写，意为“大于或等于”。
        gte: new Date(),
      },
    },
  });

  //如果数量大于 0，说明确实还有待处理邀请。
  return pendingInvites > 0;
}
