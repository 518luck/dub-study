import { SHORT_DOMAIN } from "@dub/utils";
import { NextRequest } from "next/server";

// 提取请求中的域名、路径、查询参数等信息
export const parse = (req: NextRequest) => {
  let domain = req.headers.get("host") as string;
  // path is the path of the URL (e.g. dub.sh/stats/github -> /stats/github)

  // 取当前请求 URL 的路径部分，赋值给 path。
  let path = req.nextUrl.pathname;

  // remove www. from domain and convert to lowercase
  domain = domain.replace(/^www./, "").toLowerCase();
  // 如果当前请求的域名是本地开发的 dub.localhost:8888
  // 或者是 Vercel 预览域名 *.vercel.app
  if (domain === "dub.localhost:8888" || domain.endsWith(".vercel.app")) {
    if (path.toLowerCase() === "/case-sensitive-test") {
      // special case for case-sensitive link test
      domain = "dub-internal-test.com";
    } else {
      // for local development and preview URLs
      domain = SHORT_DOMAIN;
    }
  }

  // fullPath is the full URL path (along with search params)
  // 把查询参数转成字符串。
  const searchParams = req.nextUrl.searchParams.toString();
  // 把查询参数转成对象。
  const searchParamsObj = Object.fromEntries(req.nextUrl.searchParams);
  const searchParamsString = searchParams.length > 0 ? `?${searchParams}` : "";
  const fullPath = `${path}${searchParamsString}`;

  // Here, we are using decodeURIComponent to handle foreign languages like Hebrew and Korean
  const key = decodeURIComponent(path.split("/")[1]); // key is the first part of the path (e.g. dub.sh/stats/github -> stats)
  const fullKey = decodeURIComponent(path.slice(1)); // fullKey is the full path without the first slash (to account for multi-level subpaths, e.g. d.to/github/repo -> github/repo)

  return {
    domain, // 当前请求的 host/domain，例如 app.dub.co、dub.sh、localhost:8888
    path, // 当前请求的路径部分，不包含 query，例如 /acme/links
    fullPath, // 当前请求的完整路径，包含 query，例如 /acme/links?search=test
    key, // 路径第一段，例如 /acme/links 里的 acme
    fullKey, // 去掉开头 / 后的完整路径，例如 /github/repo -> github/repo
    shortLink: `https://${domain}/${fullKey}`, // 按当前 domain + fullKey 拼出来的完整短链 URL
    searchParamsObj, // 查询参数转成的普通对象，例如 { search: "test", domain: "dub.co" }
    searchParamsString, // 带 ? 的查询字符串，例如 ?search=test&domain=dub.co；如果没有参数则为空字符串
  };
};
