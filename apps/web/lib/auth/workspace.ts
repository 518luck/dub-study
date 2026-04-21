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
    req: Request;
    params: Record<string, string>;
    searchParams: Record<string, string>;
    headers?: Headers;
    session: Session;
    permissions: PermissionAction[];
    workspace: WorkspaceWithUsers;
    token: TokenCacheItem | null;
  }): Promise<Response>;
}

// 基础结构 export const wfuncont=(handler:typehandler,{options}:{typeoptions}={})=>{return xx()}
// 一个函数的返回值是另一个函数 = (先配置,再执行)
export const withWorkspace = (
  handler: WithWorkspaceHandler, // 业务处理函数
  {
    // 表示这个接口允许哪些套餐访问。如果调用方不传，就默认“所有 plan 都允许”。
    requiredPlan = [
      "free",
      "pro",
      "business",
      "business plus",
      "business max",
      "business extra",
      "advanced",
      "enterprise",
    ], // if the action needs a specific plan
    requiredPermissions = [],
    requiredRoles = [],
    featureFlag, // if the action needs a specific feature flag
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
      // Clone the request early so handlers can read the body without cloning
      // Keep the original for withAxiomBodyLog to read in onSuccess
      const clonedReq = req.clone();

      const params = (await initialParams) || {};
      const searchParams = getSearchParams(req.url);

      let apiKey: string | undefined = undefined;
      // 这里的 headers() 是 Next 提供的动态 API，用来读取当前请求的 header。
      let requestHeaders = await headers();
      let responseHeaders = new Headers();
      let workspace: WorkspaceWithUsers | undefined;

      try {
        //1. 先取鉴权信息   这一步是“读取凭证”。
        const authorizationHeader = requestHeaders.get("Authorization");
        if (authorizationHeader) {
          if (!authorizationHeader.startsWith("Bearer ")) {
            throw new DubApiError({
              code: "bad_request",
              message:
                "Misconfigured authorization header. Did you forget to add 'Bearer '? Learn more: https://d.to/auth",
            });
          }
          apiKey = authorizationHeader.replace("Bearer ", "");
        }

        //先把后面流程里要用到的几个关键变量声明出来。
        //这是把请求地址解析成标准 URL 对象。
        const url = new URL(req.url || "", API_DOMAIN);

        let session: Session | undefined;
        let workspaceId: string | undefined;
        let workspaceSlug: string | undefined;
        let permissions: PermissionAction[] = [];
        let token: TokenCacheItem | null = null;
        const isRestrictedToken = apiKey?.startsWith("dub_"); // 是否是 restricted(受限) token

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
          // 特殊情况：匿名创建短链
          if (
            // 只有当请求头里带了某个特殊标记，并且当前请求路径正好是 /links 或 /api/links，才认为这是“匿名创建短链”的特殊请求。
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
            // missing authorization header
          } else if (!authorizationHeader) {
            throw new DubApiError({
              code: "unauthorized",
              message: "Missing Authorization header.",
            });
            // in case user is still using personal API keys
          } else {
            throw new DubApiError({
              code: "not_found",
              message:
                "Workspace ID not found. Did you forget to include a `workspaceId` query parameter? It looks like you might be using personal API keys, we also recommend refactoring to workspace API keys: https://d.to/keys",
            });
          }
        }

        //  把前面拿到的 idOrSlug 进一步判断到底是 workspace id，还是 workspace slug。
        if (idOrSlug) {
          if (idOrSlug.startsWith("ws_")) {
            workspaceId = normalizeWorkspaceId(idOrSlug);
          } else {
            workspaceSlug = idOrSlug;
          }
        }

        //  如果请求 URL 中包含 /analytics 或 /events，就标记为分析相关的请求。
        const isAnalytics =
          url.pathname.includes("/analytics") ||
          url.pathname.includes("/events");

        //  如果这次请求带了 apiKey，就走 API key 鉴权流程；否则就走普通登录 session 鉴权流程。
        if (apiKey) {
          const hashedKey = await hashToken(apiKey);
          const cachedToken = await tokenCache.get({
            hashedKey,
          });

          if (!cachedToken) {
            // prismaArgs
            const prismaArgs = {
              // 表示这次的查询条件
              where: {
                hashedKey,
              },
              // 表示这次查询只取指定字段
              select: {
                expires: true, // expirres 到期
                ...(isRestrictedToken && {
                  scopes: true, // 作用域
                  projectId: true, // 项目id
                  installationId: true, // 安装id
                  project: {
                    select: {
                      plan: true, // 项目plan
                    },
                  },
                }),
                user: true,
              },
            };

            if (isRestrictedToken) {
              token = await prisma.restrictedToken.findUnique(prismaArgs);
            } else {
              token = await prisma.token.findUnique(prismaArgs);
            }
          }

          // 优先用 cachedToken，如果 cachedToken 没值，就用前面查出来的 token
          token = cachedToken || token;

          if (!token || !token.user) {
            throw new DubApiError({
              code: "unauthorized", // 未经许可（或批准）的，未经授权的
              message: "Unauthorized: Invalid API key.", //未授权：无效的API密钥。
            });
          }

          if (token.expires && token.expires < new Date()) {
            throw new DubApiError({
              code: "unauthorized", // 未经许可（或批准）的，未经授权的
              message: "Unauthorized: Access token expired.", // 未授权：访问令牌已过期。
            });
          }

          if (!cachedToken) {
            waitUntil(
              //核心作用是：  把一个异步任务挂到请求生命周期里继续执行，但不阻塞当前响应返回
              tokenCache.set({
                hashedKey,
                token,
              }),
            );
          }

          // Rate limit checks for API keys
          // 对使用 API key 发起的请求做限流检查，防止同一个 key 在短时间内打太多请求
          let limit = 0;
          //let 变量名: 类型 = 值;
          let interval: `${number} s` | `${number} m` = isAnalytics
            ? "1 s"
            : "1 m";

          //  根据当前 token 对应项目的套餐 plan，取出这个套餐的限流配置；如果拿不到 plan，就按 free 套餐处理。
          const planLimit = getRatelimitForPlan(token.project?.plan || "free");
          // is Analytcs 是否是分析类请求    从当前套餐的限流配置里，取出这次请求应该使用的那一档请求上限
          limit = planLimit.limits[isAnalytics ? "analyticsApi" : "api"];

          //  限制单位时间内的请求次数
          // rate limit：限流
          // request：请求
          const { success, headers } = await rateLimitRequest({
            //   Identifier: 标识符
            identifier: `workspace:ratelimit:${hashedKey}`,
            // requests: limit：请求的上限
            requests: limit,
            // interval：时间间隔
            interval,
          });

          if (headers) {
            // Object.entries(headers)  会把对象转成“键值对数组”。
            //  [ [ 'Retry-After', '59' ], [ 'X-RateLimit-Limit', '1000' ], [ 'X-RateLimit-Remaining', '999' ], [ 'X-RateLimit-Reset', '1713749448' ] ]
            for (const [key, value] of Object.entries(headers)) {
              responseHeaders.set(key, value);
            }
          }

          if (!success) {
            throw new DubApiError({
              code: "rate_limit_exceeded", //超出限制速率
              message: "Too many requests.", //太多请求了。
            });
          }

          // Find workspaceId if it's a restricted token
          //如果workspaceId是受限令牌，则查找它
          if (isRestrictedToken && token?.projectId) {
            workspaceId = token.projectId;
          }

          //在后台异步更新 token 的 lastUsed（最后使用时间），但最多每分钟更新一次
          waitUntil(
            // update last used time for the token (only once every minute)
            // 更新该令牌的最后使用时间（每分钟仅更新一次）
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

          //  这段代码是在把 token 对应的用户信息包装成统一的 session 结构，方便后续代码按 session.user 来访问。
          session = {
            user: {
              id: token.user.id,
              name: token.user.name || "",
              email: token.user.email || "",
              isMachine: token.user.isMachine, //“当前用户是不是系统/自动化账户，而不是普通人类用户”。`
            },
          };
        } else {
          //  如果没有传 apiKey，就通过 NextAuth.js 的 getSession 来获取当前登录用户的 session
          session = await getSession();

          if (!session?.user?.id) {
            throw new DubApiError({
              code: "unauthorized", // 未经许可（或批准）的，未经授权的
              message: "Unauthorized: Login required.", // 未授权：需要登录。
            });
          }

          // Rate limit checks for session requests
          const rateLimit =
            RATE_LIMIT_FOR_SESSIONS[isAnalytics ? "analyticsApi" : "api"];

          const { success, headers } = await rateLimitRequest({
            identifier: `workspace:ratelimit:${session.user.id}`,
            requests: rateLimit.limit,
            interval: rateLimit.interval,
          });

          for (const [key, value] of Object.entries(headers)) {
            responseHeaders.set(key, value);
          }

          if (!success) {
            throw new DubApiError({
              code: "rate_limit_exceeded",
              message: "Too many requests.",
            });
          }
        }

        workspace = (await prisma.project.findUnique({
          where: {
            id: workspaceId || undefined,
            slug: workspaceSlug || undefined,
          },
          include: {
            users: {
              where: {
                userId: session.user.id,
              },
              select: {
                role: true,
                defaultFolderId: true,
                workspacePreferences: !apiKey, // Hide from API
              },
            },
          },
        })) as WorkspaceWithUsers;

        // workspace doesn't exist
        if (!workspace || !workspace.users) {
          throw new DubApiError({
            code: "not_found",
            message: "Workspace not found.",
          });
        }

        // workspace exists but user is not part of it
        if (workspace.users.length === 0) {
          const pendingInvites = await prisma.projectInvite.findUnique({
            where: {
              email_projectId: {
                email: session.user.email,
                projectId: workspace.id,
              },
            },
            select: {
              expires: true,
            },
          });

          if (!pendingInvites) {
            throw new DubApiError({
              code: "not_found",
              message: "Workspace not found.",
            });
          } else if (pendingInvites.expires < new Date()) {
            throw new DubApiError({
              code: "invite_expired",
              message: "Workspace invite expired.",
            });
          } else {
            throw new DubApiError({
              code: "invite_pending",
              message: "Workspace invite pending.",
            });
          }
        }

        // Machine users have owner role by default
        // Only workspace owners can create machine users
        if (session.user.isMachine) {
          workspace.users[0].role = "owner";
        }

        permissions = getPermissionsByRole(workspace.users[0].role);

        // Find the subset of permissions that the user has access to based on the token scopes
        if (isRestrictedToken && token?.scopes) {
          const tokenScopes = (token.scopes.split(" ") as Scope[]) || [];
          permissions = mapScopesToPermissions(tokenScopes).filter((p) =>
            permissions.includes(p),
          );
        }

        // Check user has permission to make the action
        if (requiredPermissions.length > 0) {
          throwIfNoAccess({
            permissions,
            requiredPermissions,
            workspaceId: workspace.id,
            externalRequest: Boolean(apiKey),
          });
        }

        // role checks
        if (
          requiredRoles.length > 0 &&
          !requiredRoles.includes(workspace.users[0].role)
        ) {
          throw new DubApiError({
            code: "forbidden",
            message: `You don't have the required role to access this endpoint. Required role(s): ${requiredRoles.join(", ")}.`,
          });
        }

        // beta feature checks
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

        // plan checks
        if (!requiredPlan.includes(workspace.plan)) {
          throw new DubApiError({
            code: "forbidden",
            message: "Unauthorized: Need higher plan.",
          });
        }

        // analytics API checks
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
        // Log the conversion events for debugging purposes
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

        return handleAndReturnErrorResponse(error, responseHeaders);
      }
    },
  );
};
