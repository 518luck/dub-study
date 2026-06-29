// =============================================================================
// /api/tokens/:id —— 针对单个 API Key 的 增删改查 路由
// -----------------------------------------------------------------------------
// 这个文件处理「针对某个具体 token」的三个操作：
//   · GET    /api/tokens/:id  → 查询某个 token 的详情（名称、权限、归属用户等）
//   · PATCH  /api/tokens/:id  → 修改某个 token 的 name / scopes
//   · DELETE /api/tokens/:id  → 删除某个 token（如果是 Machine User 创建的，连带删除其 bot 账号）
//
// 三个 handler 都用 withWorkspace 包裹，它会自动完成：
//   1. 鉴权：校验当前用户是否登录、是否属于该 workspace
//   2. 权限：第二个参数 requiredPermissions 指定该接口需要的最小权限
//   3. 注入：把 workspace、params、req、session 等注入到 handler 参数里
// =============================================================================

import { DubApiError } from "@/lib/api/errors";
import { validateScopesForRole } from "@/lib/api/tokens/scopes";
import { parseRequestBody } from "@/lib/api/utils";
import { withWorkspace } from "@/lib/auth";
import { tokenCache } from "@/lib/auth/token-cache";
import { tokenSchema, updateTokenSchema } from "@/lib/zod/schemas/token";
import { prisma } from "@dub/prisma";
import { waitUntil } from "@vercel/functions";
import { NextResponse } from "next/server";

// GET /api/tokens/:id —— 获取某个 token 的详情
// 需要权限：tokens.read
export const GET = withWorkspace(
  async ({ workspace, params }) => {
    // 按 id + workspaceId 双重条件查询，确保只能查到自己 workspace 下的 token
    const token = await prisma.restrictedToken.findUnique({
      where: {
        id: params.id,
        projectId: workspace.id,
      },
      // select：只取需要的字段，不返回敏感信息（如完整的 hashedKey）
      select: {
        id: true,
        name: true,
        partialKey: true, // 脱敏 key，形如 "dub...abcd"，列表展示用
        scopes: true, // DB 里是空格分隔字符串，tokenSchema 会转成数组
        lastUsed: true,
        createdAt: true,
        updatedAt: true,
        // 关联查询 token 的归属用户（真人或 Machine User）
        user: {
          select: {
            id: true,
            name: true,
            image: true,
            isMachine: true, // 前端据此区分显示 "You" 还是 "Machine"
          },
        },
      },
    });

    // 查不到 → 抛 404（DubApiError 会转成统一错误响应格式）
    if (!token) {
      throw new DubApiError({
        code: "not_found",
        message: `Token with id ${params.id} not found.`,
      });
    }

    // tokenSchema.parse：把 DB 形态转成 API 返回形态
    // 关键转换：scopes 从 "links.write domains.read" 字符串 → ["links.write", "domains.read"] 数组
    return NextResponse.json(tokenSchema.parse(token));
  },
  {
    requiredPermissions: ["tokens.read"],
  },
);

// PATCH /api/tokens/:id —— 修改某个 token 的 name / scopes
// 需要权限：tokens.write
export const PATCH = withWorkspace(
  async ({ workspace, params, req, session }) => {
    // ① 用 zod 校验请求体：name 和 scopes 都必填（updateTokenSchema 已 .required()）
    const { name, scopes } = updateTokenSchema.parse(
      await parseRequestBody(req),
    );

    // ② 查当前用户在 workspace 里的角色（owner / member 等）
    // 后续要用角色来判断「用户能否把某些权限授予 token」
    const { role } = await prisma.projectUsers.findUniqueOrThrow({
      where: {
        userId_projectId: {
          userId: session.user.id,
          projectId: workspace.id,
        },
      },
      select: {
        role: true,
      },
    });

    // ③ 权限校验：用户授予 token 的 scopes，不能超过用户自己拥有的权限
    // 例如 member 角色不能给 token 授予只有 owner 才有的 scope
    // 不通过 → 抛 422 unprocessable_entity
    if (!validateScopesForRole(scopes, role)) {
      throw new DubApiError({
        code: "unprocessable_entity",
        message: "Some of the given scopes are not available for your role.",
      });
    }

    // ④ 更新 DB
    const token = await prisma.restrictedToken.update({
      where: {
        id: params.id,
        projectId: workspace.id,
      },
      data: {
        ...(name && { name }), // 有 name 才更新 name
        // scopes：前端传数组 → 这里 join(" ") 存成空格分隔字符串
        // [...new Set(scopes)]：去重，避免重复 scope 污染数据
        ...(scopes && { scopes: [...new Set(scopes)].join(" ") }),
      },
      include: {
        user: true,
      },
    });

    // ⑤ 更新缓存：token 校验时走的是 Redis 缓存，DB 改了必须同步刷新缓存
    // waitUntil：不阻塞响应，让缓存写入在响应返回后异步完成（提升响应速度）
    waitUntil(
      tokenCache.set({
        hashedKey: token.hashedKey,
        token,
      }),
    );

    // 返回更新后的 token（同样经过 tokenSchema 转换形态）
    return NextResponse.json(tokenSchema.parse(token));
  },
  {
    requiredPermissions: ["tokens.write"],
  },
);

// DELETE /api/tokens/:id —— 删除某个 token
// 需要权限：tokens.write
export const DELETE = withWorkspace(
  async ({ workspace, params }) => {
    // 删除 DB 记录，同时拿到 user 信息（用于判断是否要连带删除 Machine User）
    const token = await prisma.restrictedToken.delete({
      where: {
        id: params.id,
        projectId: workspace.id,
      },
      select: {
        id: true,
        hashedKey: true, // 删缓存时需要
        user: {
          select: {
            id: true,
            isMachine: true, // 判断该 token 是否属于 Machine User
          },
        },
      },
    });

    // 关键：如果是 Machine User（独立 bot 账号）创建的 token，
    // 删除 token 时要连带把这个 bot 账号也删掉，避免遗留无用账号
    // （普通用户的 token 不删用户，因为用户本身还要留在 workspace 里）
    if (token.user.isMachine) {
      await prisma.user.delete({
        where: {
          id: token.user.id,
        },
      });
    }

    // 删除缓存：token 删了，缓存里的也必须清掉，否则失效 token 仍可能命中缓存
    waitUntil(
      tokenCache.delete({
        hashedKey: token.hashedKey,
      }),
    );

    // 只返回 id，前端用它从本地列表里移除对应项
    return NextResponse.json({
      id: token.id,
    });
  },
  {
    requiredPermissions: ["tokens.write"],
  },
);
