import { DubApiError, handleAndReturnErrorResponse } from "@/lib/api/errors";
import { BetaFeatures, PlanProps, WorkspaceWithUsers } from "@/lib/types";
import { ratelimit } from "@/lib/upstash";
import { prisma } from "@dub/prisma";
import { WorkspaceRole } from "@dub/prisma/client";
import { API_DOMAIN, getSearchParams } from "@dub/utils";
import { waitUntil } from "@vercel/functions";
import { headers } from "next/headers";
import { getRatelimitForPlan } from "../api/get-ratelimit-for-plan";
import {
  PermissionAction,
  getPermissionsByRole,
} from "../api/rbac/permissions";
import { Scope, mapScopesToPermissions } from "../api/tokens/scopes";
import { throwIfNoAccess } from "../api/tokens/throw-if-no-access";
import { normalizeWorkspaceId } from "../api/workspaces/workspace-id";
import { withAxiomBodyLog } from "../axiom/server";
import { getFeatureFlags } from "../edge-config";
import { logConversionEvent } from "../tinybird/log-conversion-events";
import { hashToken } from "./hash-token";
import { rateLimitRequest } from "./rate-limit-request";
import { TokenCacheItem, tokenCache } from "./token-cache";
import { Session, getSession } from "./utils";

// 普通网页登录用户的 API 限流配置；API key 请求会根据 workspace 套餐动态计算。
const RATE_LIMIT_FOR_SESSIONS = {
  api: {
    limit: 600,
    interval: "1 m",
  },
  analyticsApi: {
    limit: 12,
    interval: "1 s",
  },
} as const;

interface WithWorkspaceHandler {
  ({
    req,
    params,
    searchParams,
    headers,
    session,
    workspace,
    permissions,
    token,
  }: {
    req: Request; // 原始请求对象（已 clone，业务 handler 可放心读 body）
    params: Record<string, string>; // 动态路由参数，如 [id]、[idOrSlug]
    searchParams: Record<string, string>; // URL 查询参数，如 ?workspaceId=xxx
    headers?: Headers; // 待返回给客户端的响应头容器（限流等头会写到这里）
    session: Session; // 已鉴权的会话（统一结构：API key 和 cookie 登录都归一成 { user }）
    permissions: PermissionAction[]; // 当前请求最终可用的权限点（由 role 推导，restricted token 会再用 scopes 收窄）
    workspace: WorkspaceWithUsers; // 当前 workspace（含当前用户在其中的成员关系）
    token: TokenCacheItem | null; // API key 请求时的 token 信息；网页登录时为 null
  }): Promise<Response>;
}

// API Route 的 workspace 级鉴权包装器。
// 使用方式：withWorkspace(业务 handler, 访问条件)，先统一做身份、workspace、权限、套餐、限流检查，再执行 handler。
export const withWorkspace = (
  handler: WithWorkspaceHandler, // 真正的业务处理函数，只有前面的准入检查全部通过后才会执行。
  {
    // 这个接口允许哪些套餐访问；不传时默认所有主要套餐都可以访问。
    requiredPlan = [
      "free",
      "pro",
      "business",
      "business plus",
      "business max",
      "business extra",
      "advanced",
      "enterprise",
    ],
    // 这个接口需要的权限点，比如 links.write、folders.read。
    requiredPermissions = [],
    // 这个接口限定哪些 workspace 角色可以访问，比如只有 owner。
    requiredRoles = [],
    // 这个接口是否要求某个 beta / 灰度功能开关已经开启。
    featureFlag,
  }: {
    requiredPlan?: Array<PlanProps>;
    requiredPermissions?: PermissionAction[];
    requiredRoles?: WorkspaceRole[];
    featureFlag?: BetaFeatures;
  } = {},
) => {
  return withAxiomBodyLog(
    async (
      req,
      { params: initialParams }: { params: Promise<Record<string, string>> },
    ) => {
      // Request body 通常只能读取一次；这里先 clone 一份给业务 handler 使用，原始请求留给日志包装器读取。
      const clonedReq = req.clone();

      // 路由参数来自动态路由，比如 /api/workspaces/[idOrSlug]。
      const params = (await initialParams) || {};
      // 查询参数来自 URL，比如 ?workspaceId=xxx。
      const searchParams = getSearchParams(req.url);

      // 如果请求使用 Authorization: Bearer xxx，这里会提取出 xxx 作为 apiKey。
      let apiKey: string | undefined = undefined;
      // Next.js 的动态 API，用来读取当前请求的 headers。
      let requestHeaders = await headers();
      // 后面会把限流等响应头写到这里，最后随响应返回给客户端。
      let responseHeaders = new Headers();
      // 先声明 workspace，catch 中也可能用它记录错误日志。
      let workspace: WorkspaceWithUsers | undefined;

      try {
        // 第一层：读取鉴权凭证。外部 API 调用会把 API key 放在 Authorization header 里。
        const authorizationHeader = requestHeaders.get("Authorization");
        if (authorizationHeader) {
          // Dub API key 必须使用标准 Bearer 格式：Authorization: Bearer <token>。
          if (!authorizationHeader.startsWith("Bearer ")) {
            throw new DubApiError({
              code: "bad_request",
              message:
                "Misconfigured authorization header. Did you forget to add 'Bearer '? Learn more: https://d.to/auth",
            });
          }
          // 去掉 Bearer 前缀后，剩下的才是真正的 API key。
          apiKey = authorizationHeader.replace("Bearer ", "");
        }

        // 把请求地址解析成标准 URL 对象，后面要用 pathname 判断 analytics/events 等接口类型。
        const url = new URL(req.url || "", API_DOMAIN);

        // 后续会把 API key 或 NextAuth session 都统一整理成 session，方便使用 session.user。
        let session: Session | undefined;
        // workspace 既可能用 id 查询，也可能用 slug 查询。
        let workspaceId: string | undefined;
        let workspaceSlug: string | undefined;
        // 当前请求最终可用的权限列表：先由 workspace role 推导，restricted token 会再收窄。
        let permissions: PermissionAction[] = [];
        // API key 对应的 token 记录；普通 session 请求时保持 null。
        let token: TokenCacheItem | null = null;
        // 以 dub_ 开头的是 restricted token：它绑定 workspace，并且带 scopes 限制权限范围。
        const isRestrictedToken = apiKey?.startsWith("dub_");

        // 从路由参数或查询参数里尽量找出 workspace 标识。
        const idOrSlug =
          params?.idOrSlug ||
          searchParams.workspaceId ||
          params?.slug ||
          searchParams.projectSlug;

        /*
          如果当前请求里没有提供 workspace 的 ID 或 slug，并且也不是受限 token，
          那么通常只会落入下面几种情况之一：

          - 匿名创建短链的特殊场景
          - 缺少 Authorization 请求头
          - 用户仍在使用旧的 personal API key，而不是 workspace API key
        */
        if (!idOrSlug && !isRestrictedToken) {
          // 特殊情况：匿名创建短链。这个场景不需要 workspace，也不会继续走完整鉴权流程。
          if (
            // 必须同时满足特殊 header 和固定路径，避免任意接口绕过 workspace 鉴权。
            requestHeaders.has("dub-anonymous-link-creation") &&
            ["/links", "/api/links"].includes(req.nextUrl.pathname)
          ) {
            // @ts-expect-error
            return await handler({
              req: clonedReq,
              params,
              searchParams,
              headers: responseHeaders,
            });
          } else if (!authorizationHeader) {
            // 没有 workspace，也没有 API key，无法证明请求身份。
            throw new DubApiError({
              code: "unauthorized",
              message: "Missing Authorization header.",
            });
          } else {
            // 有 Authorization 但没有 workspace 标识，常见原因是仍在使用旧 personal API key。
            throw new DubApiError({
              code: "not_found",
              message:
                "未找到工作空间 ID。你是不是忘了在查询参数里带上 workspaceId？看起来你可能还在使用个人 API key，同时也推荐你重构为工作空间 API key：https://d.to/keys",
            });
          }
        }

        // 把 idOrSlug 拆成两种查询条件：ws_ 开头当作 workspace id，否则当作 workspace slug。
        if (idOrSlug) {
          if (idOrSlug.startsWith("ws_")) {
            workspaceId = normalizeWorkspaceId(idOrSlug);
          } else {
            workspaceSlug = idOrSlug;
          }
        }

        // analytics/events 请求使用更严格的限流策略，并且 free plan 的 API key analytics 会额外被限制。
        const isAnalytics =
          url.pathname.includes("/analytics") ||
          url.pathname.includes("/events");

        // 第二层：判断鉴权来源。API key 面向外部程序调用；session 面向网页登录用户。
        if (apiKey) {
          // 数据库和缓存里不直接使用明文 API key，而是使用 hash 后的 key。
          const hashedKey = await hashToken(apiKey);
          // 先查 token 缓存，命中时可以避免每次 API 请求都访问数据库。
          const cachedToken = await tokenCache.get({
            hashedKey,
          });

          if (!cachedToken) {
            // 缓存没有命中时，准备查询数据库的参数。
            const prismaArgs = {
              // 用 hash 后的 key 查 token，避免保存或比较明文 API key。
              where: {
                hashedKey,
              },
              // 只取鉴权和权限计算需要的字段。
              select: {
                expires: true,
                ...(isRestrictedToken && {
                  scopes: true,
                  projectId: true,
                  installationId: true,
                  project: {
                    select: {
                      plan: true,
                    },
                  },
                }),
                user: true,
              },
            };

            // restricted token 和普通 token 存在不同表中，权限模型也不同。
            if (isRestrictedToken) {
              token = await prisma.restrictedToken.findUnique(prismaArgs);
            } else {
              token = await prisma.token.findUnique(prismaArgs);
            }
          }

          // 优先使用缓存中的 token；缓存没命中时使用数据库查到的 token。
          token = cachedToken || token;

          // token 不存在或没有关联用户，说明 API key 无效。
          if (!token || !token.user) {
            throw new DubApiError({
              code: "unauthorized",
              message: "Unauthorized: Invalid API key.",
            });
          }

          // token 如果配置了过期时间，过期后不能继续使用。
          if (token.expires && token.expires < new Date()) {
            throw new DubApiError({
              code: "unauthorized",
              message: "Unauthorized: Access token expired.",
            });
          }

          if (!cachedToken) {
            waitUntil(
              // 后台写入 token 缓存，不阻塞当前请求返回。
              tokenCache.set({
                hashedKey,
                token,
              }),
            );
          }

          // 对 API key 请求做限流，防止同一个 key 在短时间内打太多请求。
          let limit = 0;
          // analytics/events 请求使用秒级窗口，普通 API 请求使用分钟级窗口。
          let interval: `${number} s` | `${number} m` = isAnalytics
            ? "1 s"
            : "1 m";

          // 根据 token 绑定项目的套餐获取限流配置；拿不到套餐时按 free 处理。
          const planLimit = getRatelimitForPlan(token.project?.plan || "free");
          // 同一个套餐下，普通 API 和 analytics API 的限流上限不同。
          limit = planLimit.limits[isAnalytics ? "analyticsApi" : "api"];

          // 执行限流检查。identifier 使用 hashedKey，表示按 API key 维度限流。
          const { success, headers } = await rateLimitRequest({
            identifier: `workspace:ratelimit:${hashedKey}`,
            requests: limit,
            interval,
          });

          if (headers) {
            // 把限流相关响应头透传给客户端，例如 Retry-After、X-RateLimit-Remaining。
            for (const [key, value] of Object.entries(headers)) {
              responseHeaders.set(key, value);
            }
          }

          // 限流未通过时，直接拒绝本次请求，不进入后续 workspace 权限判断。
          if (!success) {
            throw new DubApiError({
              code: "rate_limit_exceeded",
              message: "Too many requests.",
            });
          }

          // restricted token 绑定了 projectId，可以直接用它确定 workspaceId。
          if (isRestrictedToken && token?.projectId) {
            workspaceId = token.projectId;
          }

          // 后台更新 token 的 lastUsed，最多每分钟更新一次，避免每次请求都写数据库。
          waitUntil(
            (async () => {
              try {
                const { success } = await ratelimit(1, "1 m").limit(
                  `last-used-${hashedKey}`,
                );

                if (success) {
                  const prismaArgs = {
                    where: {
                      hashedKey,
                    },
                    data: {
                      lastUsed: new Date(),
                    },
                  };

                  // 两种 token 存储在不同表中，更新 lastUsed 时也要区分。
                  if (isRestrictedToken) {
                    await prisma.restrictedToken.update(prismaArgs);
                  } else {
                    await prisma.token.update(prismaArgs);
                  }
                }
              } catch (error) {
                console.error(error);
              }
            })(),
          );

          // 把 API key 对应的用户包装成统一的 session 结构，后续流程就不用区分 API key 和网页登录。
          session = {
            user: {
              id: token.user.id,
              name: token.user.name || "",
              email: token.user.email || "",
              isMachine: token.user.isMachine,
            },
          };
        } else {
          // 没有 API key 时，按普通网页登录请求处理，从 NextAuth session 中读取当前用户。
          session = await getSession();

          // 没有 session.user.id 表示用户未登录。
          if (!session?.user?.id) {
            throw new DubApiError({
              code: "unauthorized",
              message: "Unauthorized: Login required.",
            });
          }

          // 普通 session 请求也做限流，但限流上限使用固定配置，不按套餐动态计算。
          const rateLimit =
            RATE_LIMIT_FOR_SESSIONS[isAnalytics ? "analyticsApi" : "api"];

          // session 请求按 userId 维度限流。
          const { success, headers } = await rateLimitRequest({
            identifier: `workspace:ratelimit:${session.user.id}`,
            requests: rateLimit.limit,
            interval: rateLimit.interval,
          });

          // 把限流响应头返回给客户端。
          for (const [key, value] of Object.entries(headers)) {
            responseHeaders.set(key, value);
          }

          // session 请求超过限流时同样直接拒绝。
          if (!success) {
            throw new DubApiError({
              code: "rate_limit_exceeded",
              message: "Too many requests.",
            });
          }
        }

        // 第三层：根据 workspaceId 或 workspaceSlug 查询当前 workspace。
        workspace = (await prisma.project.findUnique({
          where: {
            id: workspaceId || undefined,
            slug: workspaceSlug || undefined,
          },
          include: {
            // 这里只查询“当前用户在这个 workspace 的成员关系”，不是查询全部 workspace 成员。
            users: {
              where: {
                userId: session.user.id,
              },
              select: {
                // role 是后续计算 workspace 权限的核心字段。
                role: true,
                // 当前用户默认使用的 folder。
                defaultFolderId: true,
                // API key 请求不返回 workspacePreferences，避免把前端偏好数据暴露给外部 API。
                workspacePreferences: !apiKey,
              },
            },
          },
        })) as WorkspaceWithUsers;

        // workspace 本身不存在时，后续成员关系和权限都无法判断。
        if (!workspace || !workspace.users) {
          throw new DubApiError({
            code: "not_found",
            message: "Workspace not found.",
          });
        }

        // workspace 存在，但当前用户不是成员；此时检查是否存在待接受邀请。
        if (workspace.users.length === 0) {
          const pendingInvites = await prisma.projectInvite.findUnique({
            where: {
              // 使用 email + projectId 这个复合唯一键查询邀请记录。
              email_projectId: {
                email: session.user.email,
                projectId: workspace.id,
              },
            },
            select: {
              expires: true,
            },
          });

          // 没有成员关系也没有邀请，返回 not_found，避免向无关用户暴露 workspace 是否存在。
          if (!pendingInvites) {
            throw new DubApiError({
              code: "not_found",
              message: "Workspace not found.",
            });
          } else if (pendingInvites.expires < new Date()) {
            // 有邀请但已过期，返回单独错误，前端可以展示邀请过期状态。
            throw new DubApiError({
              code: "invite_expired",
              message: "Workspace invite expired.",
            });
          } else {
            // 有邀请且未过期，但用户尚未接受。
            throw new DubApiError({
              code: "invite_pending",
              message: "Workspace invite pending.",
            });
          }
        }

        // 机器用户默认按 owner 处理；只有 workspace owner 能创建机器用户，所以这里提升为 owner 是安全前提。
        if (session.user.isMachine) {
          workspace.users[0].role = "owner";
        }

        // 第四层：根据当前用户在该 workspace 中的 role，映射出 workspace 级权限列表。
        permissions = getPermissionsByRole(workspace.users[0].role);

        // restricted token 不能只看用户角色，还要用 token scopes 再收窄权限。
        if (isRestrictedToken && token?.scopes) {
          const tokenScopes = (token.scopes.split(" ") as Scope[]) || [];
          // 最终权限 = token scopes 映射出的权限 ∩ 用户当前 role 拥有的权限。
          permissions = mapScopesToPermissions(tokenScopes).filter((p) =>
            permissions.includes(p),
          );
        }

        // 第五层：检查接口声明的 requiredPermissions。
        if (requiredPermissions.length > 0) {
          throwIfNoAccess({
            permissions,
            requiredPermissions,
            workspaceId: workspace.id,
            externalRequest: Boolean(apiKey),
          });
        }

        // 第六层：检查接口声明的 requiredRoles。这个比权限点更直接，适合必须限定 owner 等角色的接口。
        if (
          requiredRoles.length > 0 &&
          !requiredRoles.includes(workspace.users[0].role)
        ) {
          throw new DubApiError({
            code: "forbidden",
            message: `You don't have the required role to access this endpoint. Required role(s): ${requiredRoles.join(", ")}.`,
          });
        }

        // 第七层：检查 beta / 灰度功能开关。接口要求 featureFlag 时，workspace 必须已开启该功能。
        if (featureFlag) {
          const flags = await getFeatureFlags({
            workspaceId: workspace.id,
          });

          if (!flags[featureFlag]) {
            throw new DubApiError({
              code: "forbidden",
              message: "Unauthorized: Beta feature.",
            });
          }
        }

        // 第八层：检查套餐。当前 workspace plan 必须包含在接口允许的 requiredPlan 中。
        if (!requiredPlan.includes(workspace.plan)) {
          throw new DubApiError({
            code: "forbidden",
            message: "Unauthorized: Need higher plan.",
          });
        }

        // 第九层：免费套餐不能通过 API key 调用 analytics API。
        if (
          workspace.plan === "free" &&
          apiKey &&
          url.pathname.includes("/analytics")
        ) {
          throw new DubApiError({
            code: "forbidden",
            message: "Analytics API is only available on paid plans.",
          });
        }

        // 所有准入检查都通过后，才调用真正的业务处理函数。
        return await handler({
          req: clonedReq,
          params,
          searchParams,
          headers: responseHeaders,
          session,
          workspace,
          permissions,
          token,
        });
      } catch (error) {
        // 错误处理：转化追踪接口失败时额外记录事件，便于排查 lead/sale 上报失败原因。
        waitUntil(
          (async () => {
            const paths = ["/track/lead", "/track/sale"];

            if (workspace && paths.includes(req.nextUrl.pathname)) {
              logConversionEvent({
                workspace_id: workspace.id,
                path: req.nextUrl.pathname,
                error: error.message,
              });
            }
          })(),
        );

        // 把 DubApiError 或其他异常转换成统一 HTTP 响应，并保留已写入的响应头。
        return handleAndReturnErrorResponse(error, responseHeaders);
      }
    },
  );
};
