// =============================================================================
// withSession —— 全站 API 路由的鉴权中间件
// -----------------------------------------------------------------------------
// 大部分 /api/* 路由都用 `withSession(handler)` 包裹一层，
// 由它统一完成「会话识别 + 鉴权 + 限流」，再把解析好的
// { req, params, searchParams, session } 注入业务 handler。
//
// 支持两种身份来源（二选一）：
//   1. Bearer API Key：客户端通过 `Authorization: Bearer <key>` 请求头携带，
//      用于程序化访问（如 SDK、集成、机器账号）。
//   2. Cookie 会话：浏览器登录后由 next-auth 写入的 session cookie，
//      用于网页端调用（如 dashboard）。
// =============================================================================

// 自定义 API 错误类 + 统一错误响应序列化工具
import { DubApiError, handleAndReturnErrorResponse } from "@/lib/api/errors";
// 基于 Upstash Redis 的滑动窗口限流器
import { ratelimit } from "@/lib/upstash";
import { prisma } from "@dub/prisma";
// 从 URL 解析查询参数为扁平 Record（如 workspaceId=xxx）
import { getSearchParams } from "@dub/utils";
// Vercel Edge API：把任务挂到响应之后异步执行，不阻塞返回
import { waitUntil } from "@vercel/functions";
// Next.js 的 headers() —— 读取请求头（服务端 only）
import { headers } from "next/headers";
// Axiom 日志/可观测性封装：记录请求日志、错误等
import { withAxiom } from "../axiom/server";
// 把明文 token 哈希（单向），用于在 DB 中比对，避免明文落库
import { hashToken } from "./hash-token";
// Session 类型定义 + 默认基于 cookie 的会话读取（next-auth）
import { Session, getSession } from "./utils";

// -----------------------------------------------------------------------------
// 业务 handler 的统一入参契约：经过 withSession 包装后，
// handler 不再需要自己处理鉴权，只需关注业务逻辑。
// -----------------------------------------------------------------------------
interface WithSessionHandler {
  ({
    req,
    params,
    searchParams,
    session,
  }: {
    req: Request; // 原始请求对象
    params: Record<string, string>; // 路径动态参数（如 [id]）
    searchParams: Record<string, string>; // 查询参数
    session: Session; // 已鉴权通过的当前会话
  }): Promise<Response>;
}

// withSession 是一个高阶函数：
// 接收业务 handler，返回一个符合 Next.js App Router 约定的新 handler。
// 用 withAxiom 再包一层是为了接入可观测性（自动记录请求/异常）。
export const withSession = (handler: WithSessionHandler) =>
  withAxiom(
    async (
      req,
      // Next.js 15 起 params 是 Promise（异步动态参数），需 await 后使用
      { params: initialParams }: { params: Promise<Record<string, string>> },
    ) => {
      const params = (await initialParams) || {};
      let requestHeaders = await headers();
      // 额外的响应头容器：用于把限流信息（X-RateLimit-*）带回客户端
      let responseHeaders = new Headers();

      try {
        let session: Session | undefined;

        // =============== 分支 A：API Key 鉴权 ===============
        // 优先检查 Authorization 头 —— 命中则按 API Key 流程处理。
        const authorizationHeader = requestHeaders.get("Authorization");
        if (authorizationHeader) {
          // 1) 格式校验：必须是 "Bearer <key>" 前缀
          if (!authorizationHeader.startsWith("Bearer ")) {
            throw new DubApiError({
              code: "bad_request",
              message:
                "Misconfigured authorization header. Did you forget to add 'Bearer '? Learn more: https://d.to/auth",
            });
          }
          const apiKey = authorizationHeader.replace("Bearer ", "");

          // 2) 对明文 key 做哈希，再用哈希值在 DB 中反查所属用户
          //    （DB 里只存哈希，防止泄露；这里通过 tokens 关系反查 user）
          const hashedKey = await hashToken(apiKey);

          const user = await prisma.user.findFirst({
            where: {
              tokens: {
                some: {
                  hashedKey,
                },
              },
            },
            select: {
              id: true,
              name: true,
              email: true,
              isMachine: true, // 是否为机器账号（如 CI/CD 创建的专用账号）
            },
          });
          if (!user) {
            throw new DubApiError({
              code: "unauthorized",
              message: "Unauthorized: Invalid API key.",
            });
          }

          // 3) 限流：同一 API Key 每分钟最多 60 次请求
          const { success, limit, reset, remaining } = await ratelimit(
            60,
            "1 m",
          ).limit(apiKey);

          // 把限流配额信息回写到响应头，方便客户端做退避
          responseHeaders.set("Retry-After", reset.toString());
          responseHeaders.set("X-RateLimit-Limit", limit.toString());
          responseHeaders.set("X-RateLimit-Remaining", remaining.toString());
          responseHeaders.set("X-RateLimit-Reset", reset.toString());

          if (!success) {
            throw new DubApiError({
              code: "rate_limit_exceeded",
              message: "Too many requests.",
            });
          }

          // 4) 异步维护 token 的「最近一次使用时间」。
          //    每分钟最多写一次 DB（用一个独立限流 key 来节流），
          //    避免高 QPS 时对 DB 造成写放大。响应已返回后才执行。
          waitUntil(
            (async () => {
              try {
                // 用独立限流键做去重：1 分钟内只允许写一次
                const { success } = await ratelimit(1, "1 m").limit(
                  `last-used-${hashedKey}`,
                );

                if (success) {
                  await prisma.token.update({
                    where: {
                      hashedKey,
                    },
                    data: {
                      lastUsed: new Date(),
                    },
                  });
                }
              } catch (error) {
                console.error(error);
              }
            })(),
          );

          // 5) 用 API Key 对应的用户构造 session（与 cookie 分支保持同构）
          session = {
            user: {
              id: user.id,
              name: user.name || "",
              email: user.email || "",
              isMachine: user.isMachine,
            },
          };
        } else {
          // =============== 分支 B：Cookie 会话鉴权 ===============
          // 没有 Authorization 头时，回退到 next-auth 的 cookie session。
          session = await getSession();
          if (!session?.user.id) {
            throw new DubApiError({
              code: "unauthorized",
              message: "Unauthorized: Login required.",
            });
          }
        }

        // 鉴权全部通过 —— 解析查询参数，注入业务 handler 执行。
        const searchParams = getSearchParams(req.url);
        return await handler({ req, params, searchParams, session });
      } catch (error) {
        // 统一异常出口：把 DubApiError / 未知错误序列化为标准 JSON 错误响应，
        // 并附上前面累积的限流响应头。
        return handleAndReturnErrorResponse(error, responseHeaders);
      }
    },
  );
