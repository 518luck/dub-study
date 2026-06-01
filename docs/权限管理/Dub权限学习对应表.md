# Dub 权限学习对应表

这张表是为了学习 Dub 权限系统时使用的简化索引。

我前面提到的学习版文件名，不一定是 Dub 里的真实文件名，但它们在 Dub 中都有对应实现。

| 学习版概念                       | Dub 实际位置                                                | 作用                                                                |
| --------------------------- | ------------------------------------------------------- | ----------------------------------------------------------------- |
| `permissions.ts`            | `apps/web/lib/api/rbac/permissions.ts`                  | 定义权限点、角色和权限的映射关系，例如 `links.write`、`folders.read`。                 |
| `throw-if-no-permission.ts` | `apps/web/lib/actions/throw-if-no-permission.ts`        | Server Actions 里使用的权限检查函数，用来判断当前角色是否有指定权限。                        |
| `with-auth.ts`              | `apps/web/lib/auth/workspace.ts`                        | Dub 实际叫 `withWorkspace`，用于 API Route 的登录、workspace、角色、权限、套餐等统一校验。 |
| `client-access-check.ts`    | `apps/web/lib/client-access-check.ts`                   | 前端权限判断工具，用来决定按钮是否禁用、是否展示权限不足提示。                                   |
| 业务接口使用 `withAuth`           | `apps/web/app/api/**/route.ts` 里使用 `withWorkspace(...)` | API 接口声明自己需要哪些权限，例如 `requiredPermissions: ["folders.write"]`。     |

## 简单理解

Dub 权限系统可以先按这条线理解：

```txt
角色 -> 权限点 -> 后端统一校验 -> 前端动态展示
```

如果是 API Route，主要看：

```txt
withWorkspace(...)
```

如果是 Server Action，主要看：

```txt
authActionClient + throwIfNoPermission(...)
```

真正学习时，可以先从 `apps/web/lib/api/rbac/permissions.ts` 开始看。
