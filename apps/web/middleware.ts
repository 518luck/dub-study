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

export const config = {
  // 中间件运行时
  runtime: "nodejs",
  // 页面请求入口，排除 API、静态资源和站点元数据
  // 被排除的有：
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

// 请求总入口
export default async function middleware(req: NextRequest, ev: NextFetchEvent) {
  // 请求基础信息
  const { domain, path, key, fullKey } = parse(req);

  // 中间件访问日志
  logger.info(...transformMiddlewareRequest(req));
  ev.waitUntil(logger.flush());

  // App 站点入口
  if (APP_HOSTNAMES.has(domain)) {
    return AppMiddleware(req);
  }

  // API 站点入口
  if (API_HOSTNAMES.has(domain)) {
    return ApiMiddleware(req);
  }

  // 公共统计页改写到域名路由
  if (path.startsWith("/stats/")) {
    return NextResponse.rewrite(
      new URL(
        `/${domain}/${encodeURIComponent(path.replace("/stats/", ""))}/stats`,
        req.url,
      ),
    );
  }

  // 标准协议文件改写到专用路由
  if (path.startsWith("/.well-known/")) {
    const file = path.split("/.well-known/").pop();
    if (file && supportedWellKnownFiles.includes(file)) {
      return NextResponse.rewrite(
        new URL(`/wellknown/${domain}/${file}`, req.url),
      );
    }
  }

  // dub.sh 预设短链跳转
  if (domain === "dub.sh" && DEFAULT_REDIRECTS[key]) {
    return NextResponse.redirect(DEFAULT_REDIRECTS[key]);
  }

  // Admin 站点入口
  if (ADMIN_HOSTNAMES.has(domain)) {
    return AdminMiddleware(req);
  }

  // Partners 站点入口
  if (PARTNERS_HOSTNAMES.has(domain)) {
    return PartnersMiddleware(req);
  }

  // 有效 URL 直接进入短链创建链路
  if (isValidUrl(fullKey)) {
    return CreateLinkMiddleware(req);
  }

  // 默认短链访问链路
  return LinkMiddleware(req, ev);
}
