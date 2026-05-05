- Server Action 用于“页面内部的 mutation / 表单提交 / dashboard 交互”
- route.ts 用于“明确的 HTTP 接口边界”，尤其是：
  - webhook / callback
  - 对外 API
  - 需要 GET/POST/PUT/... 语义的端点
  - 需要直接处理 Request / Response、headers、raw body、query params 的场景

这不是“Server Action 功能少，所以本来都能用 Route Handler 替代却没替代”的问题。
而是：两者解决的问题层级不同。

## 官方文档怎么定义这两者

Next.js 官方对 Route Handlers 的定义是：

- 用 Web Request/Response API 创建自定义请求处理器
- 支持 GET / POST / PUT / PATCH / DELETE / HEAD / OPTIONS

Next.js 官方对 Server Functions / Server Actions 的定义是：

- 在服务端运行的异步函数
- 可以从客户端通过网络调用
- 用于 mutation 时叫 Server Actions mutation = 会修改数据或状态的操作。
- 和表单、React UI 更新、缓存/重验证架构集成
- 动作触发时，Next.js 可以在一次往返里返回更新后的 UI 和数据

这里官方其实已经给了边界：

- Route Handler 是 HTTP handler
- Server Action 是 UI mutation primitive
