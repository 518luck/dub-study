// 学习笔记：为什么 page.tsx 这么薄
// 这个文件在 Next.js App Router 里承担的是“路由入口”职责，
// 不是主要业务实现文件。
//
// 它保持很薄，常见原因有：
// 1. 把“路由入口”和“页面实现”分开，目录职责更清楚。
// 2. page.tsx 默认更适合作为路由边界，真正复杂的客户端交互放到page-client.tsx。
// 3. 这样后续如果要在入口层增加 server 侧逻辑（比如鉴权、重定向、metadata、参数处理），
//    不需要把整个页面实现和这些入口逻辑混在一起。
// 4. 让页面主体代码集中在 page-client.tsx，避免路由文件越来越臃肿。
//
// 所以它不是“多此一举”，而是一种常见的工程化分层：
// - page.tsx: 路由入口 / 页面边界
// - page-client.tsx: 真实的客户端页面实现
import WorkspaceLinksClient from "./page-client";

export default function WorkspaceLinks() {
  return <WorkspaceLinksClient />;
}
