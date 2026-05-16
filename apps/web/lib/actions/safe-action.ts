import { prisma } from "@dub/prisma";
import { createSafeActionClient } from "next-safe-action";
import { after } from "next/server";
import { normalizeWorkspaceId } from "../api/workspaces/workspace-id";
import { getSession } from "../auth";
import { logger } from "../axiom/server";
import { PlanProps } from "../types";

export const actionClient = createSafeActionClient({
  // defineMetadataSchema, 定义 action metadata 的 schema。这个项目目前没用。
  // handleServerError,  服务端 action 抛错时统一处理。
  // defaultValidationErrorsShape,  控制校验错误默认长什么样。
  // throwValidationErrors, 控制校验失败时，是返回 validationErrors，还是直接 throw
  //只要服务端出错 都先走这套统一错误处理逻辑
  handleServerError: async (e) => {
    console.error("Server action error:", e);

    // Send error to Axiom
    logger.error(e.message, e); //上报到 Axiom
    after(logger.flush()); //把刚才记下来的日志真正提交给日志系统。
    // after  是 Next.js 的一个函数，用来把一段工作安排到 响应结束之后 再执行
    if (e instanceof Error) {
      return e.message;
    }

    return "An unknown error occurred.";
  },
});

// 添加中间件
// 只要求用户已登录。
export const authUserActionClient = actionClient.use(async ({ next }) => {
  const session = await getSession();

  if (!session?.user.id) {
    throw new Error("Unauthorized: Login required.");
  }

  return next({
    ctx: {
      user: session.user,
    },
  });
});

// Workspace users
// 要求用户已登录，并且属于某个 workspace。
export const authActionClient = actionClient.use(
  async ({ next, clientInput }) => {
    const session = await getSession();

    if (!session?.user.id) {
      throw new Error("Unauthorized: Login required.");
    }

    // @ts-ignore
    let workspaceId = clientInput?.workspaceId;

    if (!workspaceId) {
      throw new Error("WorkspaceId is required.");
    }

    workspaceId = normalizeWorkspaceId(workspaceId);

    const workspace = await prisma.project.findUnique({
      where: {
        id: workspaceId,
      },
      include: {
        users: {
          where: {
            userId: session.user.id,
          },
          select: {
            role: true,
            workspacePreferences: true,
          },
        },
      },
    });

    if (!workspace || !workspace.users || workspace.users.length === 0) {
      throw new Error("Workspace not found.");
    }

    return next({
      ctx: {
        user: session.user,
        workspace: {
          ...workspace,
          role: workspace.users[0].role,
          plan: workspace.plan as PlanProps,
        },
      },
    });
  },
);

// Partner users
// 要求用户已登录，并且属于某个 partner。
export const authPartnerActionClient = actionClient.use(async ({ next }) => {
  const session = await getSession();

  if (!session?.user.id) {
    throw new Error("Unauthorized: Login required.");
  }

  const partner = await prisma.partner.findFirst({
    where: {
      ...(session.user.defaultPartnerId && {
        id: session.user.defaultPartnerId,
      }),
      users: {
        some: { userId: session.user.id },
      },
    },
    include: {
      users: {
        where: {
          userId: session.user.id,
        },
        select: {
          role: true,
          userId: true,
        },
      },
    },
  });

  if (!partner) {
    throw new Error("Partner not found.");
  }

  return next({
    ctx: {
      user: session.user,
      partner,
      partnerUser: partner.users[0],
    },
  });
});
