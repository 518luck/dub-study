// 创建并导出一个 Axiom 客户端实例。

import { Axiom } from "@axiomhq/js"; // 说明这里用的是 Axiom 的 JS SDK。

export const axiomClient = new Axiom({
  //这个 token 用来证明“你有权限往 Axiom 发数据”
  token: process.env.AXIOM_TOKEN!, // 这里的 token 从环境变量中读取，是 Axiom 提供的认证凭证。
});
