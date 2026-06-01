# Dub 权限管理体系

## 简短结论

Dub 这个项目有比较完整的“原子化权限 + 会员套餐 + 用量限制”体系。

它不是一个单独的权限中心，而是几层组合：

1. 角色权限 RBAC：比如 `links.write`、`billing.write`、`webhooks.write`
2. Workspace 角色：`owner`、`member`、`viewer`、`billing`
3. 套餐限制：免费版 / Pro / Business / Enterprise 能用不同功能
4. 用量限制：链接数量、点击数、文件夹数量、成员数量等
5. 前后端双重控制：前端禁用/提示升级，后端 API 再真正拦截

## 核心文件

## 1. 原子权限定义

文件位置：

```txt
apps/web/lib/api/rbac/permissions.ts
```

这里定义类似：

```txt
links.write
billing.write
webhooks.write
folders.write
workspaces.write
```

并把这些权限分配给不同角色。

可以理解成：

```txt
owner 能做最多，viewer 基本只能看，billing 只能管账单相关能力。
```

## 2. Workspace 角色和套餐字段

文件位置：

```txt
packages/prisma/schema/workspace.prisma
```

这里定义了：

```txt
WorkspaceRole
ProjectUsers.role
Project.plan
usageLimit
linksLimit
foldersLimit
usersLimit
```

也就是说，数据库里会记录：

```txt
你在某个 workspace 是什么角色，这个 workspace 是什么套餐，还剩多少额度。
```

## 3. 后端权限核心入口

文件位置：

```txt
apps/web/lib/auth/workspace.ts
```

这里的核心函数是：

```ts
withWorkspace(...)
```

API 路由会用它包起来，例如概念上类似：

```ts
withWorkspace(handler, {
  requiredPermissions: ["links.write"],
  requiredPlan: ["pro", "business", "enterprise"],
});
```

它会检查：

1. 用户有没有登录
2. 是否属于这个 workspace
3. role 是否有权限
4. plan 是否满足
5. API token scope 是否允许
6. 是否超过 rate limit / usage limit

这是后端真正的安全边界。

## 4. 前端权限检查

文件位置：

```txt
apps/web/lib/client-access-check.ts
```

前端会用类似：

```ts
clientAccessCheck({
  action: "links.write",
  role,
});
```

来判断按钮是否能点，或者展示 tooltip。

注意：这个只是用户体验，不是安全措施。

## 5. 会员功能能力判断

文件位置：

```txt
apps/web/lib/plan-capabilities.ts
```

这里根据套餐判断某些功能能不能用，比如：

1. 能不能创建 folder
2. 能不能管理 folder 权限
3. 能不能创建 webhook
4. 能不能使用 conversion tracking
5. 能不能导出 audit logs

这就是“会员才能用”的核心判断之一。

## 典型例子

## 创建 Link

前端：

```txt
apps/web/ui/modals/link-builder/index.tsx
```

会判断：

1. 用户有没有 `links.write`
2. workspace 是否超过 `linksLimit`

后端：

```txt
apps/web/app/api/links/route.ts
apps/web/lib/api/links/usage-checks.ts
```

会再次检查：

1. `requiredPermissions: ["links.write"]`
2. 是否超过 links 数量限制

## 创建 Folder

前端：

```txt
apps/web/ui/folders/folder-dropdown.tsx
```

低套餐可能会禁用创建按钮，并提示升级。

后端：

```txt
apps/web/app/api/folders/route.ts
```

会检查：

1. `requiredPermissions: ["folders.write"]`
2. `requiredPlan`
3. `foldersUsage >= foldersLimit`

## Webhooks

前端：

```txt
apps/web/ui/webhooks/add-edit-webhook-form.tsx
```

会检查：

```txt
webhooks.write
```

后端：

```txt
apps/web/app/api/webhooks/route.ts
```

会要求：

1. 有 `webhooks.write` 权限
2. plan 至少是 Business 或更高

## SAML SSO

这是 Enterprise-only 功能。

相关后端文件：

```txt
apps/web/app/api/workspaces/[idOrSlug]/saml/route.ts
apps/web/app/api/workspaces/[idOrSlug]/route.ts
```

如果不是 enterprise plan，会直接拒绝。

## 一句话理解

Dub 的权限系统可以这样理解：

```txt
前端负责“能不能点、要不要提示升级”；后端负责“你真的有没有权限执行”。
权限由 role + permission action + plan + usage limit 共同决定。
```
