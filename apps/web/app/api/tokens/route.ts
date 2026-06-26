import { createId } from "@/lib/api/create-id";
import { DubApiError } from "@/lib/api/errors";
import { scopesToName, validateScopesForRole } from "@/lib/api/tokens/scopes";
import { parseRequestBody } from "@/lib/api/utils";
import { hashToken, withWorkspace } from "@/lib/auth";
import { generateRandomName } from "@/lib/names";
import { ratelimit } from "@/lib/upstash";
import { createTokenSchema, tokenSchema } from "@/lib/zod/schemas/token";
import { sendEmail } from "@dub/email";
import APIKeyCreated from "@dub/email/templates/api-key-created";
import { prisma } from "@dub/prisma";
import { Prisma, User } from "@dub/prisma/client";
import { nanoid } from "@dub/utils";
import { waitUntil } from "@vercel/functions";
import { NextResponse } from "next/server";
import * as z from "zod/v4";

const MAX_WORKSPACE_TOKENS = 100;

const getTokensQuerySchema = z.object({
  userId: z.string().optional(),
});

// GET /api/tokens - get all tokens for a workspace
export const GET = withWorkspace(
  async ({ workspace, searchParams }) => {
    const { userId } = getTokensQuerySchema.parse(searchParams);

    const tokens = await prisma.restrictedToken.findMany({
      where: {
        projectId: workspace.id,
        installationId: null,
        ...(userId && {
          userId,
        }),
      },
      select: {
        id: true,
        name: true,
        partialKey: true,
        scopes: true,
        lastUsed: true,
        createdAt: true,
        updatedAt: true,
        user: {
          select: {
            id: true,
            name: true,
            image: true,
            isMachine: true,
          },
        },
      },
      orderBy: [{ lastUsed: "desc" }, { createdAt: "desc" }],
      take: 100,
    });

    return NextResponse.json(tokenSchema.array().parse(tokens));
  },
  {
    requiredPermissions: ["tokens.read"],
  },
);

// =============================================================================
// POST /api/tokens —— 为当前 workspace 创建一个新的 API key
// -----------------------------------------------------------------------------
// 整体流程：
//   ① 限流（防刷）：每 workspace 每 5 秒最多创建 1 个
//   ② 入参解析：Zod 校验 name / isMachine / scopes
//   ③ 权限校验：Machine User 只能 owner 创建 + scopes 不能超过当前角色
//   ④ 生成 token 三件套：明文 dub_xxx / 哈希 / 脱敏 partialKey
//   ⑤ 事务写库：数量上限检查 → (可选)创建 bot 用户 → 写 restrictedToken
//   ⑥ 异步发邮件通知创建者
//   ⑦ 返回明文 token（仅此一次，DB 只存哈希）
// =============================================================================
export const POST = withWorkspace(
  async ({ req, session, workspace }) => {
    // ----------------------------------------------------------
    // ① 限流：同一 workspace 每 5 秒最多创建 1 个 token
    // 防止恶意批量生成 key，限流 key 按 workspaceId 维度计数
    // ----------------------------------------------------------
    const { success } = await ratelimit(1, "5 s").limit(
      `create-tokens:${workspace.id}`,
    );

    if (!success) {
      throw new DubApiError({
        code: "rate_limit_exceeded",
        message: "Too many requests. Please try again later.",
      });
    }

    // ----------------------------------------------------------
    // ② 入参解析 + Zod 异步校验
    //   parseRequestBody：把请求体读成对象（含大小限制）
    //   createTokenSchema：校验 name(1-50字) / isMachine / scopes[]
    //   校验失败 Zod 自动抛错，无需手动处理
    // ----------------------------------------------------------
    const { name, isMachine, scopes } = createTokenSchema.parse(
      await parseRequestBody(req),
    );

    // 当前用户在该 workspace 的角色（owner / admin / member ...）
    const role = workspace.users[0].role;

    // ----------------------------------------------------------
    // ③-a Machine User 权限校验
    // 只有 workspace owner 能创建 Machine 类型的 key
    // （因为 bot 用户会被加入 workspace，等于赋予了访问权限）
    // ----------------------------------------------------------
    // Only workspace owners can create machine users
    if (isMachine && role !== "owner") {
      throw new DubApiError({
        code: "forbidden",
        message: "Only workspace owners can create machine users.",
      });
    }

    // ----------------------------------------------------------
    // ③-b scopes 角色范围校验
    // 申请的 scopes 不能超过当前角色拥有的权限
    // 例如 member 不能申请只有 owner 才有的 scope
    // ----------------------------------------------------------
    if (!validateScopesForRole(scopes || [], role)) {
      throw new DubApiError({
        code: "unprocessable_entity",
        message: "Some of the given scopes are not available for your role.",
      });
    }

    // ----------------------------------------------------------
    // ④ 生成 token 三件套（整个 key 的核心）
    //   token      → 明文 key：dub_ 前缀 + 24 位 nanoid 随机串
    //                · dub_ 前缀让 withWorkspace 识别为 restricted token
    //                · 明文只返回一次，DB 永不存储
    //   hashedKey  → SHA-256 哈希，DB 只存这个，鉴权时反查用
    //   partialKey → 脱敏片段 dub...abcd，UI 列表展示用
    // ----------------------------------------------------------
    // Create token
    const token = `dub_${nanoid(24)}`;
    const hashedKey = await hashToken(token);
    const partialKey = `${token.slice(0, 3)}...${token.slice(-4)}`;

    // ----------------------------------------------------------
    // ⑤ 事务写入：数量检查 → 创建 bot → 写 token 记录
    // 用事务保证三步原子性，任一步失败则全部回滚
    // ----------------------------------------------------------
    await prisma.$transaction(
      async (tx) => {
        // ⑤-a 数量上限检查（排除 OAuth 安装产生的 token）
        // 每个 workspace 最多 100 个手动创建的 API key
        const totalTokens = await tx.restrictedToken.count({
          where: {
            projectId: workspace.id,
            installationId: null, // Skip OAuth installations tokens
          },
        });

        if (totalTokens >= MAX_WORKSPACE_TOKENS) {
          throw new DubApiError({
            code: "forbidden",
            message: `You've reached your limit of ${MAX_WORKSPACE_TOKENS} API keys for this workspace. Please contact support to increase this limit.`,
          });
        }

        let machineUser: Pick<User, "id"> | null = null;

        // ⑤-b Machine 模式：创建独立的 bot 用户并加入 workspace
        // bot 用户不绑定到创建者，创建者离开后 key 依然有效
        if (isMachine) {
          // 创建 bot 用户记录，isMachine: true 标记为机器账号
          // 名字用随机生成 + "(Machine User)" 后缀，便于在成员列表识别
          machineUser = await tx.user.create({
            data: {
              id: createId({ prefix: "user_" }),
              name: `${generateRandomName()} (Machine User)`,
              isMachine: true,
            },
            select: {
              id: true,
            },
          });

          // 把 bot 加入当前 workspace，role = member
          // 注意：鉴权时 workspace.ts 会把 isMachine 用户临时提升为 owner
          // Add machine user to workspace
          await tx.projectUsers.create({
            data: {
              role: "member",
              userId: machineUser.id,
              projectId: workspace.id,
            },
          });
        }

        // ⑤-c 写入 restrictedToken 记录（核心落库）
        //   userId      → Machine 模式绑 bot，否则绑当前用户
        //   projectId   → 绑定当前 workspace（key 不可跨 workspace）
        //   scopes      → 数组去重后 join(" ") 存为字符串，空则存 null
        return await tx.restrictedToken.create({
          data: {
            name,
            hashedKey,
            partialKey,
            userId: isMachine ? machineUser?.id! : session.user.id,
            projectId: workspace.id,
            scopes:
              scopes && scopes.length > 0
                ? [...new Set(scopes)].join(" ")
                : null,
          },
        });
      },
      {
        // 事务隔离级别：ReadUncommitted（最低隔离，追求性能）
        // 这里不需要严格隔离，因为数量限制即使有轻微误差也可接受
        isolationLevel: Prisma.TransactionIsolationLevel.ReadUncommitted,
        maxWait: 5000, // 最多等 5 秒获取连接
        timeout: 5000, // 事务最多执行 5 秒
      },
    );

    // ----------------------------------------------------------
    // ⑥ 异步发邮件通知创建者
    // waitUntil：让 Vercel 函数响应后再后台执行，不占用响应时间
    // 邮件内容：key 名称 + 权限类型（All/Read Only/Restricted）+ workspace 信息
    // 注意：Machine 模式下邮件发给创建者（session.user），不是发给 bot
    // ----------------------------------------------------------
    waitUntil(
      sendEmail({
        to: session.user.email,
        subject: `A new API key has been created for your workspace ${workspace.name} on Dub`,
        react: APIKeyCreated({
          email: session.user.email,
          token: {
            name,
            type: scopesToName(scopes || []).name,
            permissions: scopesToName(scopes || []).description,
          },
          workspace: {
            name: workspace.name,
            slug: workspace.slug,
          },
        }),
      }),
    );

    // ----------------------------------------------------------
    // ⑦ 返回明文 token（仅此一次）
    // 前端收到后会弹"请复制保存"的提示窗
    // DB 里只有哈希，后续永远无法再次获取明文
    // ----------------------------------------------------------
    return NextResponse.json({ token });
  },
  // ----------------------------------------------------------
  // withWorkspace 配置：声明本接口需要的最小权限
  // requiredPermissions: ["tokens.write"]
  //   · API key 调用 → token scopes 必须包含 tokens.write
  //   · 网页调用 → 用户在该 workspace 的角色必须能写 tokens
  // 不满足 → withWorkspace 内部抛 forbidden，handler 不会执行
  // ----------------------------------------------------------
  {
    requiredPermissions: ["tokens.write"],
  },
);
