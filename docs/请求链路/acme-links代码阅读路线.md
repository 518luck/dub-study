# 访问 /acme/links 的代码阅读路线图

> 目标：跟着真实代码走一遍，从"敲回车"到"看到链接列表"的完整请求链路
> 配套：建议配合 `docs/请求链路/acme-links三次请求完整链路.md` 的 ASCII 图对照看

## 推荐阅读路线（跟着请求时间线，6 站）

```txt
📥 浏览器发请求
    │
    ▼
【站1】middleware.ts          ← 总入口，看 hostname 分流
    │   line 38-49 (default export)
    ▼
【站2】app.ts (AppMiddleware)  ← 解 JWT + rewrite，注意"很轻"
    │   line 17-137
    ▼
🖥️ 页面渲染
    │
    ▼
【站3】auth.tsx (WorkspaceAuth) ← 客户端鉴权，超短，32 行读完
    │   全文，重点 line 13、19-29
    ▼
📡 前端发 3 个 API（SWR）
    │
    ▼
【站4】use-workspace.ts        ← 请求①的发源地
    │   line 17-41（SWR 核心写法）
    ├─ use-links.ts:15,29      ← 请求②，注意条件请求（依赖 ws_id）
    └─ use-links-count.ts:19   ← 请求③，同理
    ▼
🔐 API 层：每个请求都走这里
    │
    ▼
【站5】workspace.ts (withWorkspace) ⭐ 最核心，最重
    │   line 387-524（两道闸都在这）
    ▼
🗄️ 业务查询
    │
    ▼
【站6】route.ts → get-links-for-workspace.ts
        route.ts:20-45（API 入口）
        get-links-for-workspace.ts:91-94（WHERE projectId 铁闸）
```

## 逐站详解（每站看什么）

### 🚉 站 1：`apps/web/middleware.ts`（总入口）

- **看 line 38-49**：`default export function middleware`，就一个 if-else 链，按域名分流
- **看 line 20-34**：`matcher`，理解中间件**不拦截 `/api/`**（所以 API 请求不经过这里！这是后面理解 withWorkspace 的关键）
- **难度**：⭐ 最简单，就是个分发器
- **看完能懂**：请求是怎么按域名分流到不同中间件的

### 🚉 站 2：`apps/web/lib/middleware/app.ts`（App 中间件）

- **看 line 28**：`getUserViaToken(req)` —— 这是"解 JWT 不查库"的真相
- **看 line 136**：`NextResponse.rewrite(...)` —— URL rewrite 到内部路由
- **难度**：⭐⭐ 分支较多，重点只看上面两行
- **看完能懂**：为什么说"中间件很轻"——它真的只解 JWT + 改 URL

### 🚉 站 3：`apps/web/app/app.dub.co/(dashboard)/[slug]/auth.tsx`（客户端鉴权）⭐ 强烈推荐先看

- **全文只有 32 行**，超短
- **看 line 13**：`useWorkspace()` 触发请求①
- **看 line 19-29**：根据 `error.status` 分流（not_found → 404 / invite_pending → 重定向）
- **难度**：⭐ 最直观，就是 if-else
- **看完能懂**：页面是怎么靠"请求①的错误码"做鉴权的——这是 Next.js App Router 的客户端鉴权模式

### 🚉 站 4：`apps/web/lib/swr/use-workspace.ts`（SWR hook）

- **看 line 22-27**：slug 从哪来（路由参数优先）
- **看 line 34-41**：SWR 的核心三件——key、fetcher、配置
- **看 line 38**：`dedupingInterval: 60000` —— 这就是"60 秒去重"的来源
- **难度**：⭐⭐ 需要理解 SWR 的 key 概念
- **看完能懂**：为什么切页面不重复请求、为什么 key 为 null 不发请求

> 看完这个，再看 `use-links.ts:15`（`const { id: workspaceId } = useWorkspace()`）和 `:29`（`workspaceId ? url : null`），就秒懂"请求②③必须等①"的依赖关系。

### 🚉 站 5：`apps/web/lib/auth/workspace.ts`（withWorkspace）⭐⭐⭐ 最核心

这个文件 558 行，**别从头读**，直接跳到核心段：

- **看 line 387-408** ⭐⭐⭐：那条 `prisma.project.findUnique({ include: { users: { where: { userId } } } })` —— 这是**整个多租户鉴权的命脉**，就是"查你是不是成员"
- **看 line 411-452**：失败分支（not_found / invite_pending / invite_expired）
- **看 line 460**：`getPermissionsByRole` —— role 转权限
- **看 line 472-512**：权限/套餐校验
- **难度**：⭐⭐⭐⭐ 最复杂，但只看 387-524 这一段就够
- **看完能懂**：第一道闸到底怎么挡人的

### 🚉 站 6：业务查询（第二道闸）

- `apps/web/app/api/links/route.ts` **line 20-45**：API 入口，看 `withWorkspace` 怎么包裹 handler，`workspace.id` 怎么传给查询函数
- `apps/web/lib/api/links/get-links-for-workspace.ts` **line 91-94**：`where: { projectId: workspaceId }` —— **隔离铁闸**，就这一行
- **难度**：⭐⭐
- **看完能懂**：第二道闸怎么保证数据不串

## 阅读建议

1. **第一遍快读**：按站 1→6 走一遍，**只看我标的行号**，别钻细节，先建立全貌
2. **第二遍精读站 3 和站 5**：这两个是核心（客户端鉴权 + 服务端鉴权），理解透就掌握 80%
3. **配合那个 ASCII 图**：打开 `docs/请求链路/acme-links三次请求完整链路.md`，对照着图看代码，每看到图里的一个框，就去对应文件找那行
4. **善用"跳转"**：在 `auth.tsx` 看到 `useWorkspace()` → 跳进 `use-workspace.ts`；看到 `/api/workspaces/${slug}` → 跳进 `route.ts`；看到 `withWorkspace` → 跳进 `workspace.ts`。这是最自然的追代码方式

## 一个关键提醒

**注意 `middleware.ts` 的 matcher（line 25-34）排除了 `/api/`**——这意味着：

- 页面请求（`/acme/links`）会经过中间件
- API 请求（`/api/links`）**不经过中间件**，直接打到 route handler

所以 API 的鉴权完全靠 `withWorkspace`，中间件帮不上忙。这就是为什么每个 API 都要独立包 `withWorkspace`。

---

**建议从 🚉 站 3（auth.tsx）开始**——它最短（32 行）、最直观，能让你立刻看到"客户端鉴权"长什么样，建立信心后再往下追。
