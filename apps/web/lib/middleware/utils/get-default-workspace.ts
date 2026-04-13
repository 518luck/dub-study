import { UserProps } from "@/lib/types";
import { prismaEdge } from "@dub/prisma/edge";

// “帮中间件判断这个用户默认应该进哪个工作区”
export async function getDefaultWorkspace(user: UserProps) {
  let defaultWorkspace = user?.defaultWorkspace;

  if (!defaultWorkspace) {
    //prismaEdge   这是 Prisma 客户端实例。 也就是项目里操作数据库的工具。
    const refreshedUser = await prismaEdge.user.findUnique({
      where: {
        id: user.id,
      },
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
          take: 1,
        },
      },
    });

    defaultWorkspace =
      refreshedUser?.defaultWorkspace ||
      refreshedUser?.projects[0]?.project?.slug ||
      undefined;
  }

  return defaultWorkspace;
}
