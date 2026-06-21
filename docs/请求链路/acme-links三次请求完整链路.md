# 访问 /acme/links 的三次请求完整链路

> 场景：已登录用户在浏览器访问 `http://localhost:8888/acme/links`（acme 是 workspace slug）
> 目标：看清从"敲回车"到"看到链接列表"，中间发了几个请求、每步查了什么表、Redis 干了什么

## 0. 一句话总览

浏览器发请求 → 中间件只解 JWT 不查库（轻）→ 页面客户端发 **3 类 API** → 每个 API 各自走一遍 **withWorkspace 鉴权（第一道闸）+ 业务查询带 projectId（第二道闸）** → 渲染列表。

---

## 1. 整体时序：三个请求怎么排队的

```txt
浏览器 GET http://localhost:8888/acme/links（带 cookie）
   │
   ▼
┌──────────── 中间件层（请求最先进，但很轻）────────────┐
│  middleware.ts:47   hostname 判断 → AppMiddleware      │
│  app.ts:28          getToken() 解 JWT cookie           │
│  app.ts:136         rewrite → /app.dub.co/acme/links   │
│  （纯 JWT 解码，不查库、不查 Redis）                     │
└─────────────────────────┬──────────────────────────────┘
                          ▼
┌──────────── 页面渲染，触发请求① ────────────┐
│  [slug]/layout.tsx  包 <WorkspaceAuth>       │
│  auth.tsx:13        useWorkspace() 发请求①    │
└─────────────────────────┬────────────────────┘
                          ▼
   ╔═════════ 请求① GET /api/workspaces/acme ═════════╗
   ║  必须先发（要拿 workspace.id）                     ║
   ║  内部走两道闸（见 §2）+ 查 Domain + Edge Config    ║
   ╚──────────────────────┬───────────────────────────╝
                          ▼  返回 { id: "ws_xxx", role, plan, ... }
              useWorkspace 拿到 workspace.id = "ws_xxx"
                          │
          ┌───────────────┴───────────────┐
          ▼                               ▼
   useLinks 的 key              useLinksCount 的 key
   null → /api/links?...        null → /api/links/count?...
          │                               │
          ▼                               ▼
   ╔═══════════ 请求② ══╗      ╔═══════════ 请求③ ══╗
   ║ GET /api/links      ║      ║ GET /api/links/count║
   ║ ?workspaceId=ws_xxx ║      ║ ?workspaceId=ws_xxx ║
   ║ 各自走两道闸（鉴权   ║      ║ 各自走两道闸（鉴权  ║
   ║ 重复 1 次！）        ║      ║  再重复 1 次！）    ║
   ║ 查 Link+LinkTag+Tag ║      ║ 查 Link count      ║
   ╚═════════╤══════════╝      ╚════════╤═══════════╝
             └──────────┬───────────────┘
                        ▼
              SWR 收到响应 → 渲染 <LinkCard> 列表
```

**关键点：请求②③并行，但都必须等请求①返回**（因为它们的 SWR key 依赖 `workspace.id`，没拿到 id 时 key 是 `null`，SWR 不发请求）。

---

## 2. 单个请求内部的"两道闸"（以 GET /api/links 为例）

```txt
                    请求进来（带 cookie）
                       │
                       ▼
       ┌──── withWorkspace 第零步：身份认证 ────┐
       │  解 cookie 里的 JWT（getSession）       │
       │  ┌─ 拿不到 → 401 unauthorized            │
       │  └─ 拿到   → session.user 就绪            │
       │  （纯 JWT 解码，无库、无 Redis）           │
       └───────────────────┬─────────────────────┘
                           ▼
       ┌──── 限流检查（每次必查 Redis！）──────┐
       │  滑动窗口 key: workspace:ratelimit:{userId} │
       │  session 请求限流：600次/分钟               │
       │  ┌─ 超限 → 429 rate_limit_exceeded          │
       │  └─ 未超 → 继续                             │
       └───────────────────┬─────────────────────┘
                           ▼
       ┌──── 第一道闸：成员关系校验（查 DB）────┐
       │  prisma.project.findUnique({            │
       │    where: { slug: "acme" },             │
       │    include: {                           │
       │      users: {                           │
       │        where: { userId: 当前用户 }       │ ← 只查当前用户那条！
       │        select: { role, ... }            │
       │      }                                  │
       │    }                                    │
       │  })                                     │
       │  涉及表：Project + ProjectUsers          │
       │  ┌─ workspace 不存在 → 404 not_found     │
       │  ├─ users 为空（不是成员）→ 查 ProjectInvite │
       │  │   ├─ 无邀请   → 404 not_found         │
       │  │   ├─ 邀请过期 → invite_expired        │
       │  │   └─ 待接受   → invite_pending        │
       │  └─ 是成员 → 拿到 role（owner/member/…）  │
       └───────────────────┬─────────────────────┘
                           ▼
       ┌──── 权限映射 + 校验 ──────────────────┐
       │  role → permissions（纯内存映射）       │
       │  检查 requiredPermissions: ["links.read"]│
       │  检查 requiredPlan（套餐）              │
       │  ┌─ 权限/套餐不够 → 403 forbidden        │
       │  └─ 通过 → workspace 对象注入给 handler  │
       └───────────────────┬─────────────────────┘
                           ▼
       ┌──── 第二道闸：业务查询（纯取数）──────┐
       │  getLinksForWorkspace({                │
       │    workspaceId: workspace.id           │
       │  })                                    │
       │  → WHERE projectId = ws_xxx            │ ← 隔离铁闸！
       │  → include tags（带 LinkTag + Tag）     │
       │  纯取数，不再判权限                      │
       └───────────────────┬─────────────────────┘
                           ▼
                    返回 JSON 给前端
```

**对应关系**：抽象概念"先查成员表确认身份 → 再查资源表取数"，在代码里就是第一道闸（`workspace.ts:387`）和第二道闸（`get-links-for-workspace.ts:94`）。

---

## 3. 请求①失败的分支：前端如何拦截

请求①（`GET /api/workspaces/acme`）同时承担两个职责：
- 拿 `workspace.id`（给请求②③用）
- 客户端鉴权（你能不能进这个 workspace）

withWorkspace 会返回不同的错误码，前端 `auth.tsx` 据此做不同处理。

```txt
              请求① GET /api/workspaces/acme
                       │
       ┌──────── withWorkspace 鉴权（见 §2）────────┐
       │  各种失败情况 → 返回不同 HTTP 错误码          │
       └─────────────────────┬───────────────────────┘
                             ▼
       ┌──────── 前端 useWorkspace 收到 error ─────────┐
       │  auth.tsx:13-31 根据 error.status 分流：       │
       │                                               │
       │  ┌─ loading: true                              │
       │  │   → 渲染 <LayoutLoader />（转圈等待）        │
       │  │                                             │
       │  ├─ error.status = "unauthorized" (401)        │
       │  │   说明：未登录（JWT 解失败）                   │
       │  │   理论分支，实际中间件层已重定向 /login         │
       │  │   处理：透传给 SWR error，UI 显示登录提示      │
       │  │                                             │
       │  ├─ error.status = "not_found" (404) ⭐        │
       │  │   说明：workspace 不存在 / 不是成员 / 无邀请   │
       │  │   处理：notFound() → 渲染 404 页              │
       │  │   注意：三种情况合并成一个错误码，             │
       │  │         故意不向无关用户暴露 workspace 是否存在 │
       │  │                                             │
       │  ├─ error.status = "invite_pending"            │
       │  │   说明：不是成员，但有未接受的邀请              │
       │  │   处理：redirect(/acme/invite) 显示邀请接受页 │
       │  │                                             │
       │  ├─ error.status = "invite_expired"            │
       │  │   说明：邀请存在但已过期                       │
       │  │   处理：redirect(/acme/invite) 显示邀请过期页 │
       │  │                                             │
       │  ├─ error.status = "forbidden" (403)           │
       │  │   说明：是成员，但权限/套餐不够                │
       │  │   处理：透传给 SWR error，UI 显示无权限提示    │
       │  │                                             │
       │  ├─ error.status = "rate_limit_exceeded" (429) │
       │  │   说明：请求太频繁，触发限流                   │
       │  │   处理：透传给 SWR error，UI 显示限流提示      │
       │  │                                             │
       │  └─ 无 error ✅                                │
       │      → 渲染 children（进入 dashboard）          │
       │      → 同时 workspace.id 就绪，触发请求②③       │
       └───────────────────────────────────────────────┘
```

### 为什么 not_found 把三种情况合并？

这是 Dub 的**安全设计**：不向无关用户暴露 workspace 是否存在。

想象一个攻击者探测 `acme` 这个 slug 是否被占用：
- 如果返回 "workspace 不存在" vs "你不是成员" 两种不同错误码，攻击者就能通过错误码差异判断"这个 slug 被人用了"
- 合并成统一的 `not_found`，攻击者无从分辨

**学习心得**：错误码不只是技术问题，还涉及信息泄露防护。`invite_pending` / `invite_expired` 单独返回，是因为它们服务于"有邀请在等你"这个合法场景。

---

## 4. 三个请求各自查了什么表

| 请求 | 第一道闸（必查） | 第二道闸（业务取数） | 额外 |
|------|----------------|---------------------|------|
| ① GET /api/workspaces/acme | Project + ProjectUsers | — | Domain 表（最多 100 条）+ Edge Config（本地环境短路） |
| ② GET /api/links | Project + ProjectUsers | Link + LinkTag + Tag | cursor 校验时再查 1 次 Link |
| ③ GET /api/links/count | Project + ProjectUsers | Link（count 聚合） | — |

**注意：第一道闸的 Project + ProjectUsers 查询，三个请求各查一遍（共 3 次）。** 这是为"每个 API 独立鉴权"付出的性能代价。

---

## 5. Redis 在整条链路里只用了这一处

| Redis key | 用途 | 触发 |
|-----------|------|------|
| `workspace:ratelimit:{userId}` | 限流（滑动窗口） | **每个 API 必查（3 次）** |

**反直觉但重要**：浏览器访问场景下，Redis 不缓存 session（因为是 JWT），也不缓存 workspace。整条链路 Redis 只为"限流"服务。

> 对比：API Key 请求（带 `Authorization: Bearer xxx`）会额外用 Redis 缓存 token（key: `dubTokenCache:{hashedKey}`），但浏览器请求不走这条路。

---

## 6. SWR 在这里的三个作用

1. **条件请求**：`useLinks` 写成 `workspaceId ? '/api/links' : null`，没拿到 id 时 key 是 null，SWR 不发请求 → 这就是为什么请求②③必须等①
2. **请求去重**：同一 key 在 dedupingInterval 内多次调用合并成 1 个网络请求
   - useWorkspace: 60 秒去重（`use-workspace.ts:38`）
   - useLinks: 20 秒去重（`use-links.ts:62`）
   - useLinksCount: 60 秒去重（`use-links-count.ts:43`）
3. **跨页面缓存共享**：切到 `/acme/analytics` 时 `useWorkspace` 命中缓存，零请求

---

## 7. 一个简化说法的澄清

"三次请求"是简化表述。严格说：
- `/api/links/count` 这个 endpoint 在 `/acme/links` 页面会被**多处调用**（按 tagId/domain/userId/folderId 等不同 groupBy 各发一次）
- 但 `/api/links` 因为 SWR key 完全一致，去重后只有 1 个实际请求

所以更准确的说法是"**三类 API**"或"**三条 SWR 数据流**"。

---

## 8. 阅读窍门

- 想理解"权限怎么挡人" → 看第 2 节第一道闸
- 想理解"数据怎么不串" → 看第 2 节第二道闸的 `WHERE projectId`
- 想理解"为什么发 3 个请求" → 看第 1 节时序图 + 第 6 节 SWR
- 想理解"中间件干了啥" → 看第 1 节最顶部（很轻，只解 JWT）
- 想理解"访问没权限的 workspace 会怎样" → 看第 3 节失败分支

---

## 涉及的关键文件

| 角色 | 文件 |
|------|------|
| 中间件总入口 | `apps/web/middleware.ts` |
| App 中间件 | `apps/web/lib/middleware/app.ts` |
| 页面鉴权组件 | `apps/web/app/app.dub.co/(dashboard)/[slug]/auth.tsx` |
| useWorkspace | `apps/web/lib/swr/use-workspace.ts` |
| useLinks | `apps/web/lib/swr/use-links.ts` |
| useLinksCount | `apps/web/lib/swr/use-links-count.ts` |
| withWorkspace | `apps/web/lib/auth/workspace.ts` |
| getLinksForWorkspace | `apps/web/lib/api/links/get-links-for-workspace.ts` |
