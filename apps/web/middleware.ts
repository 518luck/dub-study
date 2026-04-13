import { logger } from "@/lib/axiom/server";
import { transformMiddlewareRequest } from "@axiomhq/nextjs";
import {
  ADMIN_HOSTNAMES,
  API_HOSTNAMES,
  APP_HOSTNAMES,
  DEFAULT_REDIRECTS,
  isValidUrl,
} from "@dub/utils";
import { PARTNERS_HOSTNAMES } from "@dub/utils/src/constants";
import { NextFetchEvent, NextRequest, NextResponse } from "next/server";
import { AdminMiddleware } from "./lib/middleware/admin";
import { ApiMiddleware } from "./lib/middleware/api";
import { AppMiddleware } from "./lib/middleware/app";
import { CreateLinkMiddleware } from "./lib/middleware/create-link";
import { LinkMiddleware } from "./lib/middleware/link";
import { PartnersMiddleware } from "./lib/middleware/partners";
import { parse } from "./lib/middleware/utils/parse";
import { supportedWellKnownFiles } from "./lib/well-known";

/**
 * 这是 Next.js Middleware 的配置对象，用来告诉 Next：
 * - 这个中间件运行在什么环境
 * - 它要拦截哪些请求路径
 */
export const config = {
  //这个 middleware 运行在 Node.js runtime 上。
  runtime: "nodejs",
  //哪些请求路径应该进入这个 middleware。
  matcher: [
    /*
     * Match all paths except for:
     * 1. /api/ routes
     * 2. /_next/ (Next.js internals)
     * 3. /_proxy/ (proxies for third-party services)
     * 4. Metadata files: favicon.ico, sitemap.xml, robots.txt, manifest.webmanifest
     */
    "/((?!api/|_next/|_proxy/|favicon.ico|sitemap.xml|robots.txt|manifest.webmanifest).*)",
  ],
};

// 导出一个默认的异步函数，名字叫 middleware，Next.js 会把它当成中间件入口。
export default async function middleware(req: NextRequest, ev: NextFetchEvent) {
  // ev: NextFetchEvent  中间件运行时事件对象。   让一些异步任务在后台继续执行，不阻塞主响应。
  const { domain, path, key, fullKey } = parse(req);

  // Axiom logging
  // ransformMiddlewareRequest(req) 就是在把原始请求 req 变成这组日志参数
  logger.info(...transformMiddlewareRequest(req));
  //  把一个异步任务挂到后台去继续执行，即使主响应流程已经准备结束，也让它继续 跑完。
  // 是 middleware 的事件对象 NextFetchEvent
  ev.waitUntil(logger.flush());

  // for App
  if (APP_HOSTNAMES.has(domain)) {
    return AppMiddleware(req);
  }

  // for API
  if (API_HOSTNAMES.has(domain)) {
    return ApiMiddleware(req);
  }

  // for public stats pages (e.g. d.to/stats/try -> rewrite to [/domain]/[key]/stats)
  if (path.startsWith("/stats/")) {
    return NextResponse.rewrite(
      new URL(
        `/${domain}/${encodeURIComponent(path.replace("/stats/", ""))}/stats`,
        req.url,
      ),
    );
  }

  // for .well-known routes
  if (path.startsWith("/.well-known/")) {
    const file = path.split("/.well-known/").pop();
    if (file && supportedWellKnownFiles.includes(file)) {
      return NextResponse.rewrite(
        new URL(`/wellknown/${domain}/${file}`, req.url),
      );
    }
  }

  // default redirects for dub.sh
  if (domain === "dub.sh" && DEFAULT_REDIRECTS[key]) {
    return NextResponse.redirect(DEFAULT_REDIRECTS[key]);
  }

  if (ADMIN_HOSTNAMES.has(domain)) {
    return AdminMiddleware(req);
  }

  if (PARTNERS_HOSTNAMES.has(domain)) {
    return PartnersMiddleware(req);
  }

  if (isValidUrl(fullKey)) {
    return CreateLinkMiddleware(req);
  }

  return LinkMiddleware(req, ev);
}
