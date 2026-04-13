import { NextRequest, NextResponse } from "next/server";
import { parse } from "./utils/parse";

// 专门处理 /embed 相关请求，判断它们能不能进入嵌入页面；能的话 rewrite 到app.dub.co 下的真实页面，不能的话重定向回首页。
export function EmbedMiddleware(req: NextRequest) {
  const { path, searchParamsObj, fullPath } = parse(req);

  //判断当前请求路径是不是以 /embed/support-chat 开头。
  if (path.startsWith("/embed/support-chat")) {
    // rewrite是什么意思 内部改道
    //  用户访问的是 A 地址
    //  服务器内部实际去处理 B 地址
    //  但浏览器地址栏仍然显示 A
    return NextResponse.rewrite(new URL(`/app.dub.co${fullPath}`, req.url));
  }

  if (searchParamsObj.token) {
    return NextResponse.rewrite(new URL(`/app.dub.co${fullPath}`, req.url));
  }

  // TODO: Show token expiry page
  //- 第一个参数：相对路径或目标路径
  // - 第二个参数：基准 URL

  // 如果当前请求是：
  // https://app.dub.co/embed/abc?token=123
  // 那么：
  // new URL("/", req.url)
  // 会得到：
  // https://app.dub.co/
  return NextResponse.redirect(new URL("/", req.url));
}
