# withWorkspace 流程详解

`apps/web/lib/auth/workspace.ts` 里的 `withWorkspace` 是 Dub API Route 的总门卫。

它负责把“用户是谁、用什么方式访问、属于哪个 workspace、是什么角色、有什么权限、套餐够不够、有没有超限流”全部检查完，最后才允许真正的接口逻辑执行。

## 总体流程

```txt
请求进来
  ↓
解析 params / searchParams / headers
  ↓
读取 Authorization
  ↓
判断是 API key 请求，还是普通登录 session 请求
  ↓
找到 workspace
  ↓
确认用户属于 workspace
  ↓
根据 role 算 permissions
  ↓
如果是 restricted token，再用 token scopes 缩小权限
  ↓
检查 requiredPermissions
  ↓
检查 requiredRoles
  ↓
检查 featureFlag
  ↓
检查 requiredPlan
  ↓
通过后执行真正的 handler
  ↓
出错则统一返回错误响应
```

## 核心函数

```ts
withWorkspace(handler, {
  requiredPermissions,
  requiredRoles,
  requiredPlan,
  featureFlag,
});
```

含义：包装一个 API 接口，在进入真正业务逻辑前，先做 workspace 相关的身份和权限检查。

示例：

```ts
withWorkspace(
  async ({ workspace, session }) => {
    // 真正业务逻辑
  },
  {
    requiredPermissions: ["folders.write"],
    requiredPlan: ["pro", "business", "enterprise"],
  },
);
```

## 1. 读取 Authorization Header

它先看请求头里有没有：

```txt
Authorization
```

如果有，必须是：

```txt
Bearer xxx
```

如果格式不对，会返回：

```txt
bad_request
```

含义：请求传了 API key，但格式不正确。

## 2. 判断 Workspace 从哪里来

它会尝试从这些地方拿 workspace 标识：

```ts
params.idOrSlug
searchParams.workspaceId
params.slug
searchParams.projectSlug
```

如果拿到了：

```txt
ws_xxx 开头 -> 当成 workspaceId
否则 -> 当成 workspaceSlug
```

作用：后面要根据 id 或 slug 查询 workspace。

## 3. 判断是否 Restricted Token

```ts
const isRestrictedToken = apiKey?.startsWith("dub_");
```

意思是：如果 API key 以 `dub_` 开头，就认为它是受限 token。

受限 token 的特点：

```txt
绑定某个 workspace
有自己的 scopes
最终权限 = 用户角色权限 ∩ token scopes 权限
```

## 4. 没有 WorkspaceId 时的特殊判断

如果没有 workspace id/slug，并且也不是 restricted token，会进入特殊分支。

它会判断是不是匿名创建短链：

```ts
requestHeaders.has("dub-anonymous-link-creation")
```

并且路径是：

```txt
/links
/api/links
```

如果是，就允许继续。

如果不是，并且也没有 Authorization，会返回：

```txt
unauthorized: Missing Authorization header
```

如果有 Authorization 但没 workspaceId，会返回：

```txt
not_found: 找不到 workspace ID
```

## 5. 判断是不是 Analytics / Events 请求

```ts
const isAnalytics =
  url.pathname.includes("/analytics") ||
  url.pathname.includes("/events");
```

作用：analytics / events 请求有单独的限流规则。

## API Key 分支

如果请求带了 API key，就走 API key 鉴权流程。

### 6. Hash API Key

```ts
const hashedKey = await hashToken(apiKey);
```

作用：不直接用明文 API key 查数据库，而是用 hash 后的 key，提高安全性。

### 7. 先查 Token Cache

```ts
const cachedToken = await tokenCache.get({ hashedKey });
```

判断：缓存里有没有这个 token。

如果有，直接用缓存。

如果没有，再查数据库。

作用：避免每次 API 请求都查数据库。

### 8. 根据 Token 类型查不同表

```ts
if (isRestrictedToken) {
  token = await prisma.restrictedToken.findUnique(...);
} else {
  token = await prisma.token.findUnique(...);
}
```

含义：

```txt
restricted token -> 查 restrictedToken 表
普通 token       -> 查 token 表
```

restricted token 会额外查：

```txt
scopes
projectId
installationId
project.plan
```

因为后面要做 scope 权限收缩和套餐限流。

### 9. 判断 Token 是否有效

```ts
if (!token || !token.user)
```

如果 token 不存在，或者没有关联 user，会返回：

```txt
unauthorized: Invalid API key
```

含义：API key 是假的，或者已经无效。

### 10. 判断 Token 是否过期

```ts
if (token.expires && token.expires < new Date())
```

如果过期，会返回：

```txt
unauthorized: Access token expired
```

### 11. 把 Token 写入缓存

如果这次是数据库查出来的 token，会后台写入缓存：

```ts
waitUntil(tokenCache.set(...));
```

作用：下次请求可以直接从缓存拿，减少数据库查询。

### 12. API Key 限流

它根据当前请求是不是 analytics，选择不同限流规则：

```txt
普通 API       -> api limit
analytics API -> analyticsApi limit
```

并且根据套餐拿限流配置：

```ts
getRatelimitForPlan(token.project?.plan || "free");
```

如果超过限制，会返回：

```txt
rate_limit_exceeded
```

### 13. Restricted Token 自动确定 WorkspaceId

```ts
if (isRestrictedToken && token?.projectId) {
  workspaceId = token.projectId;
}
```

意思是：restricted token 自己绑定 workspace，所以请求里可以不传 workspaceId。

### 14. 后台更新 Token LastUsed

它会异步更新：

```txt
token.lastUsed
```

但是最多每分钟更新一次。

作用：记录 API key 最近使用时间，同时避免每次请求都写数据库。

### 15. 把 API Key 用户包装成 Session

```ts
session = {
  user: {
    id,
    name,
    email,
    isMachine,
  },
};
```

作用：后面不需要区分“你是 API key 用户还是网页登录用户”，统一都用 `session.user`。

## 普通 Session 分支

如果没有 API key，就走普通登录用户流程。

### 16. 获取 Session

```ts
session = await getSession();
```

如果没有登录：

```ts
if (!session?.user?.id)
```

会返回：

```txt
unauthorized: Login required
```

### 17. Session 请求限流

普通登录用户也有限流：

```txt
普通 API       -> 600 / 1 min
analytics API -> 12 / 1 sec
```

如果超过限制，会返回：

```txt
rate_limit_exceeded
```

## Workspace 查询和成员检查

### 18. 查询 Workspace

```ts
prisma.project.findUnique({
  where: {
    id: workspaceId,
    slug: workspaceSlug,
  },
  include: {
    users: {
      where: {
        userId: session.user.id,
      },
    },
  },
});
```

重要点：`workspace.users` 不是 workspace 所有成员，而是“当前用户在这个 workspace 里的成员记录”。

如果用户属于 workspace：

```txt
workspace.users.length === 1
```

如果不属于：

```txt
workspace.users.length === 0
```

### 19. 判断 Workspace 是否存在

```ts
if (!workspace || !workspace.users)
```

如果不存在，会返回：

```txt
Workspace not found
```

### 20. 判断用户是否属于 Workspace

```ts
if (workspace.users.length === 0)
```

如果用户不是成员，会继续查邀请记录：

```ts
prisma.projectInvite.findUnique(...)
```

然后分三种情况。

没有邀请：

```txt
Workspace not found
```

这里故意返回 not_found，可能是为了避免泄露 workspace 是否存在。

邀请过期：

```txt
invite_expired
```

邀请还在等待接受：

```txt
invite_pending
```

## 权限计算

### 21. Machine User 视为 Owner

```ts
if (session.user.isMachine) {
  workspace.users[0].role = "owner";
}
```

意思是：机器用户默认拥有 owner 权限。

### 22. 根据 Role 计算 Permissions

```ts
permissions = getPermissionsByRole(workspace.users[0].role);
```

比如：

```txt
owner   -> 很多权限
member  -> 部分写权限
viewer  -> 多数只读权限
billing -> 账单相关权限
```

核心映射在：

```txt
apps/web/lib/api/rbac/permissions.ts
```

### 23. Restricted Token Scopes 收缩权限

如果是 restricted token：

```ts
permissions = mapScopesToPermissions(tokenScopes).filter((p) =>
  permissions.includes(p),
);
```

意思是：

```txt
最终权限 = token scopes 权限 ∩ 用户角色权限
```

举例：

```txt
用户是 owner，本来有 links.write
但 token 只有 links.read scope
最终只能 links.read
```

## 接口声明权限检查

### 24. 检查 RequiredPermissions

```ts
if (requiredPermissions.length > 0) {
  throwIfNoAccess(...);
}
```

比如接口声明：

```ts
requiredPermissions: ["folders.write"]
```

那当前用户最终权限里必须包含：

```txt
folders.write
```

否则返回：

```txt
forbidden
```

### 25. 检查 RequiredRoles

```ts
if (
  requiredRoles.length > 0 &&
  !requiredRoles.includes(workspace.users[0].role)
)
```

比如接口声明：

```ts
requiredRoles: ["owner"]
```

那只有 owner 能访问。

没有对应角色会返回：

```txt
forbidden
```

### 26. 检查 FeatureFlag

```ts
if (featureFlag) {
  const flags = await getFeatureFlags({ workspaceId: workspace.id });
}
```

如果接口要求某个 beta 功能，但当前 workspace 没开，会返回：

```txt
Unauthorized: Beta feature
```

### 27. 检查 RequiredPlan

```ts
if (!requiredPlan.includes(workspace.plan))
```

比如接口只允许：

```txt
business / enterprise
```

如果当前 workspace 是 free 或 pro，会返回：

```txt
Unauthorized: Need higher plan
```

### 28. 免费套餐 Analytics API 限制

```ts
if (
  workspace.plan === "free" &&
  apiKey &&
  url.pathname.includes("/analytics")
)
```

意思是：free plan 不能通过 API key 调用 analytics API。

不通过会返回：

```txt
Analytics API is only available on paid plans.
```

## 最后执行真正业务逻辑

所有检查都通过后，才执行：

```ts
return await handler({
  req: clonedReq,
  params,
  searchParams,
  headers: responseHeaders,
  session,
  workspace,
  permissions,
  token,
});
```

业务接口能拿到：

| 字段             | 含义                |
| -------------- | ----------------- |
| `req`          | 请求对象。             |
| `params`       | 路由参数。             |
| `searchParams` | 查询参数。             |
| `headers`      | 响应头，通常包含限流信息。     |
| `session`      | 当前用户。             |
| `workspace`    | 当前 workspace。     |
| `permissions`  | 当前用户最终权限。         |
| `token`        | API key token 信息。 |

## 错误处理

如果中间任何一步报错，会进入 `catch`。

对于特殊路径：

```txt
/track/lead
/track/sale
```

如果已经拿到了 workspace，会后台记录 conversion event 错误日志。

最后统一调用：

```ts
handleAndReturnErrorResponse(error, responseHeaders);
```

把错误转成标准 HTTP 响应。

## 和 Server Actions 的区别

`workspace.ts` 主要给 API Route 用。

`throw-if-no-permission.ts` 主要给 Server Actions 用。

区别：

```txt
API Route:
withWorkspace 统一处理登录、API key、workspace、权限、套餐、限流

Server Action:
authActionClient 先拿 user/workspace
再在 action 内部手动 throwIfNoPermission
```

可以这样记：

```txt
app/api/**/route.ts       -> withWorkspace
lib/actions/**/*.ts       -> authActionClient + throwIfNoPermission
```

## 阅读窍门

不要把它当成普通业务函数看。

它其实是一个“请求准入流程”：

```txt
身份是否合法？
workspace 是否存在？
用户是否属于 workspace？
角色有什么权限？
token 有没有进一步限制？
接口要求是否满足？
套餐是否满足？
```

以后读某个 API 时，只要看到：

```ts
withWorkspace(handler, options)
```

就先看 `options`：

```ts
requiredPermissions
requiredRoles
requiredPlan
featureFlag
```

这几个就是这个接口的权限门槛。
