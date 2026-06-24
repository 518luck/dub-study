import { DubApiError, ErrorCodes } from "@/lib/api/errors";
import { createLink, getLinksForWorkspace, processLink } from "@/lib/api/links";
import { throwIfLinksUsageExceeded } from "@/lib/api/links/usage-checks";
import { validateLinksQueryFilters } from "@/lib/api/links/validate-links-query-filters";
import { parseRequestBody } from "@/lib/api/utils";
import { withWorkspace } from "@/lib/auth";
import { MEGA_WORKSPACE_LINKS_LIMIT } from "@/lib/constants/misc";
import { ratelimit } from "@/lib/upstash";
import { sendWorkspaceWebhook } from "@/lib/webhook/publish";
import {
  createLinkBodySchemaAsync,
  getLinksQuerySchemaExtended,
  linkEventSchema,
} from "@/lib/zod/schemas/links";
import { LOCALHOST_IP } from "@dub/utils";
import { waitUntil } from "@vercel/functions";
import { NextResponse } from "next/server";

// GET /api/links – get all links for a workspace
export const GET = withWorkspace(
  async ({ headers, searchParams, workspace, session }) => {
    const filters = getLinksQuerySchemaExtended.parse(searchParams);

    const { folderIds } = await validateLinksQueryFilters({
      ...filters,
      workspace,
      userId: session.user.id,
    });

    const response = await getLinksForWorkspace({
      ...filters,
      workspaceId: workspace.id,
      folderIds,
      searchMode:
        workspace.totalLinks > MEGA_WORKSPACE_LINKS_LIMIT ? "exact" : "fuzzy",
    });

    return NextResponse.json(response, {
      headers,
    });
  },
  {
    requiredPermissions: ["links.read"],
  },
);

// ============================================================
// POST /api/links —— 创建一条短链
// ------------------------------------------------------------
// 整体职责：HTTP 入口 + 编排层（controller）
//   · 接收请求 → 调鉴权 wrapper → 做几条业务前置检查
//   · 委托给 processLink（校验）+ createLink（落库）两个 service
//   · 把结果包成 JSON 返回
// 真正的"业务规则"在 processLink / createLink 里，本函数只做编排。
// ============================================================
export const POST = withWorkspace(
  async ({ req, headers, session, workspace }) => {
    // ----------------------------------------------------------
    // ① 套餐用量检查
    // workspace 存在 = 已登录用户所属的工作空间
    // 超过套餐允许的短链总数 → 直接抛错（免费/付费档位不同）
    // ----------------------------------------------------------
    if (workspace) {
      throwIfLinksUsageExceeded(workspace);
    }

    // ----------------------------------------------------------
    // ② 入参解析 + Zod 异步校验
    //   parseRequestBody：把请求体读成对象（含大小限制）
    //   createLinkBodySchemaAsync：Zod schema，定义了 link 的全部字段
    //     （domain / key / url / utm_* / tagIds / expiresAt ...）
    //   校验失败时 Zod 会自动抛错，无需手动处理
    // ----------------------------------------------------------
    const body = await createLinkBodySchemaAsync.parseAsync(
      await parseRequestBody(req),
    );

    // ----------------------------------------------------------
    // ③ 匿名用户限流（业务规则：防止白嫖）
    // session 不存在 = 未登录调用（Dub 允许匿名创建短链）
    // 限制：同一 IP 每天最多 10 条，超过抛 rate_limit_exceeded
    // 已登录用户由 withWorkspace 内部按套餐限流，不走这段
    // ----------------------------------------------------------
    if (!session) {
      // x-forwarded-for 是 Vercel/代理注入的真实客户端 IP；本地开发兜底为 localhost
      const ip = req.headers.get("x-forwarded-for") || LOCALHOST_IP;
      // ratelimit(次数, 时间窗) 是基于 Upstash Redis 的滑动窗口限流
      const { success } = await ratelimit(10, "1 d").limit(ip);

      if (!success) {
        throw new DubApiError({
          code: "rate_limit_exceeded",
          message:
            "Rate limited – you can only create up to 10 links per day without an account.",
        });
      }
    }

    // ----------------------------------------------------------
    // ④ 委托 service 层：processLink（纯校验，不写库）
    // 入参：用户提交的 body + workspace + （若登录）userId
    // 内部依次校验：URL 合法性、套餐功能、域名权限、恶意链接、
    //              key 生成与冲突检测、tag/folder/program/webhook 归属
    // 出参：{ link: 处理好的数据, error, code }
    //   · 成功：link 已含 projectId / userId / 规范化后的 key
    //   · 失败：error 为人类可读的错误信息，code 为错误码
    // ----------------------------------------------------------
    const { link, error, code } = await processLink({
      payload: body,
      workspace,
      ...(session && { userId: session.user.id }),
    });

    // 校验失败 → 转成统一错误响应（DubApiError 由上层 error boundary 接管）
    if (error != null) {
      throw new DubApiError({
        code: code as ErrorCodes,
        message: error,
      });
    }

    // ----------------------------------------------------------
    // ⑤ 委托 service 层：createLink（真正落库 + 触发副作用）
    //   同步部分：prisma.link.create（唯一一次 DB 写入，决定响应延迟）
    //            tags / webhooks / dashboard 通过 Prisma 嵌套写入同事务
    //   异步部分（waitUntil，不阻塞本次响应）：
    //            Redis 缓存 / Tinybird / R2 图片 / workspace 计数 / webhook 变更
    // ----------------------------------------------------------
    try {
      const response = await createLink(link);

      // --------------------------------------------------------
      // ⑥ 异步触发 webhook（仅登录用户的工作空间链才发）
      // waitUntil：让 Vercel 函数响应后再继续执行，不占用响应时间
      // trigger="link.created" → 推到客户配置的 webhook URL
      // linkEventSchema.parse：再做一次 Zod 校验，确保推送数据格式
      // --------------------------------------------------------
      if (response.projectId && response.userId) {
        waitUntil(
          sendWorkspaceWebhook({
            trigger: "link.created",
            workspace,
            data: linkEventSchema.parse(response),
          }),
        );
      }

      // 成功 → 返回创建好的 link 对象（headers 里带 CORS / ratelimit 信息）
      return NextResponse.json(response, {
        headers,
      });
    } catch (error) {
      // 兜底：DB 写入或下游异常 → 422 Unprocessable Entity
      throw new DubApiError({
        code: "unprocessable_entity",
        message: error.message,
      });
    }
  },
  // ----------------------------------------------------------
  // ⑦ withWorkspace 的配置：声明本接口需要的最小权限
  // requiredPermissions: ["links.write"] → RBAC 校验
  //   · API key 调用：token scopes 必须包含 links.write
  //   · 网页调用：用户在该 workspace 的角色必须能写 links
  // 不满足 → withWorkspace 内部抛 forbidden 错，handler 不会执行
  // ----------------------------------------------------------
  {
    requiredPermissions: ["links.write"],
  },
);
