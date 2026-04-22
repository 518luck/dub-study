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
                "未找到工作空间 ID。你是不是忘了在查询参数里带上 workspaceId？看起来你可能还在使用个人 API key，同时也推荐你重构为工作空间 API key：https://d.to/keys",
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
          // 查询条件
          where: {
            id: workspaceId || undefined,
            slug: workspaceSlug || undefined,
          },
          // 连带查关联数据
          include: {
            users: {
              //Prisma 这里 include: { users: ... } 返回的关系字段类型天然就是数组。即使你加了：
              where: {
                userId: session.user.id, // @@unique([userId, projectId])
                // 意思是：同一个用户在同一个 workspace 里最多只能有一条成员关系记录。
              },
              select: {
                role: true,
                defaultFolderId: true,
                workspacePreferences: !apiKey, // Hide from API
              },
            },
          },
        })) as WorkspaceWithUsers;

        // exist 存在
        // workspace doesn't exist
        if (!workspace || !workspace.users) {
          throw new DubApiError({
            code: "not_found",
            message: "Workspace not found.",
          });
        }

        // workspace exists but user is not part of it
        // 工作区存在但用户不是其中一部分
        if (workspace.users.length === 0) {
          // pendingInvites  待处理的邀请  [pending:待处理的]
          const pendingInvites = await prisma.projectInvite.findUnique({
            where: {
              //  两层不是多余，而是在表示“用 email_projectId 这个复合唯一键去查”，里面那层才是这个联合键的具体字段值。
              //用 email 和 projectId 这组联合唯一条件去查一条唯一记录
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
        //默认情况下，机器用户具有所有者角色  |   机器用户默认拥有 owner 角色
        // Only workspace owners can create machine users
        //只有工作区所有者可以创建机器用户  |  只有工作区的 owner 才能创建机器用户
        if (session.user.isMachine) {
          // 如果当前登录身份是机器用户，就把他在当前 workspace 里的角色直接当成 owner
          workspace.users[0].role = "owner";
        }

        // 根据当前用户在这个 workspace 里的角色，算出他拥有的权限列表
        //  因为这里控制的不是“这个人全局是什么身份”，而是“这个人在这个 workspace 里是什么身份”。
        permissions = getPermissionsByRole(workspace.users[0].role);

        // Find the subset of permissions that the user has access to based on the token scopes
        //根据 token 的 scopes，找出当前用户实际可用的那部分权限。
        //如果当前用的是 restricted token，就不能只看用户角色，还要看这个 token 自己允许哪些 scope。
        if (isRestrictedToken && token?.scopes) {
          const tokenScopes = (token.scopes.split(" ") as Scope[]) || [];
          //token 允许的权限 和 用户角色本来拥有的权限 的交集。
          permissions = mapScopesToPermissions(tokenScopes).filter((p) =>
            permissions.includes(p),
          );
        }

        // Check user has permission to make the action
        // 如果当前接口定义了“需要哪些权限”，那就检查当前用户有没有这些权限；没有的话就抛错拦截。
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
          //  > 如果这个接口要求必须是某些角色才能访问，而当前用户在这个 workspace 里的角色不在允许范围内，就直接报错
          requiredRoles.length > 0 &&
          !requiredRoles.includes(workspace.users[0].role)
        ) {
          throw new DubApiError({
            code: "forbidden",
            message: `You don't have the required role to access this endpoint. Required role(s): ${requiredRoles.join(", ")}.`,
          });
        }

        // beta feature checks
        //  > 如果当前接口或功能要求某个 featureFlag 开启，系统就去查这个 workspace 有没有开通这个功能；如果没开，就禁止访问。
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
        // > 如果当前 workspace 的套餐 plan 不在接口要求的套餐范围里，就禁止访问。
        if (!requiredPlan.includes(workspace.plan)) {
          throw new DubApiError({
            code: "forbidden",
            message: "Unauthorized: Need higher plan.",
          });
        }

        // analytics API checks
        //免费套餐的 workspace，如果是通过 apiKey 调用 analytics 接口，就不允许访问。
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

        //前面的鉴权、权限、角色、套餐、功能开关这些检查都通过了，现在正式调用真正的业务处理函数 handler。
        return await handler({
          req: clonedReq, // 当前请求对象
          params, // 路由参数
          searchParams, // 查询参数
          headers: responseHeaders, // 响应头
          session, // 当前登录用户会话
          workspace, // 当前解析出来的 workspace
          permissions, // 当前用户 / token 最终可用的权限
          token, // 当前请求使用的 token 信息（如果有）
        });
      } catch (error) {
        // Log the conversion events for debugging purposes
        //> 在后台额外执行一段异步任务。
        // > 如果当前请求是 /track/lead 或 /track/sale，并且有 workspace，就把这次错误记录下来。
        //  异步记录错误日志，而且不阻塞当前请求返回。
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
