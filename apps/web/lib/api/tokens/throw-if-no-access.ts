import "server-only";
import { DubApiError } from "../errors";
import { PermissionAction } from "../rbac/permissions";
import { prefixWorkspaceId } from "../workspaces/workspace-id";

// Check if the required scope is in the list of user scopes
// 校验当前权限是否满足接口要求：
// 1. 如果接口没有声明 requiredPermissions，直接放行
// 2. 从 requiredPermissions 中找出当前缺失的权限
// 3. 如果没有缺失，说明有权访问，直接放行
// 4. 如果有缺失，则抛出 forbidden 错误
//    - 外部请求（API key）返回更具体的缺失权限提示
//    - 普通请求返回通用无权限提示
export const throwIfNoAccess = ({
  permissions,
  requiredPermissions,
  workspaceId,
  externalRequest = false,
}: {
  permissions: PermissionAction[]; // user or token permissions
  requiredPermissions: PermissionAction[];
  workspaceId: string;
  externalRequest?: boolean;
}) => {
  //如果这个接口没有声明任何必需权限，那就不用做权限检查，直接放行。
  if (requiredPermissions.length === 0) {
    return;
  }

  const missingPermissions = requiredPermissions.filter(
    (p) => !permissions.includes(p),
  );

  if (missingPermissions.length === 0) {
    return;
  }

  const message = externalRequest
    ? `The provided key does not have the required permissions for this endpoint on the workspace '${prefixWorkspaceId(workspaceId)}'. Having the '${missingPermissions.join(" ")}' permission would allow this request to continue.`
    : "You don't have the necessary permissions to complete this request.";

  throw new DubApiError({
    code: "forbidden",
    message,
  });
};
