import { UserProps } from "@/lib/types";
import { prismaEdge } from "@dub/prisma/edge";

// “帮中间件判断这个用户默认应该进哪个工作区”
export async function getDefaultWorkspace(user: UserProps) {
  let defaultWorkspace = user?.defaultWorkspace;

  if (!defaultWorkspace) {
    //prismaEdge   这是 Prisma 客户端实例。 也就是项目里操作数据库的工具。
    //因为 middleware 这种位置更靠近 edge / 请求入口环境，而这类环境通常不擅长维持传统数据库长连接。
    // findUnique 它的作用是根据数据库中具有 唯一性（Unique） 约束的字段来获取单条数据。
    const refreshedUser = await prismaEdge.user.findUnique({
      where: {
        id: user.id,
      },
      // 在 Prisma 中，如果你不写 select，它会默认返回该表的所有字段。一旦写了 select，就变成了“只返回我勾选的字段”。
      select: {
        defaultWorkspace: true,
        projects: {
          select: {
            project: {
              select: {
                slug: true,
              },
            },
          },
          //限制返回数量。  只取第一条
          take: 1,
        },
      },
    });

    defaultWorkspace =
      refreshedUser?.defaultWorkspace ||
      // slug  给 URL 用的“人类可读标识”
      refreshedUser?.projects[0]?.project?.slug ||
      undefined;
  }

  return defaultWorkspace;
}
