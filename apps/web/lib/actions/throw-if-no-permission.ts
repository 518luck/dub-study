import { WorkspaceRole } from "@dub/prisma/client";
import {
  getPermissionsByRole,
  PermissionAction,
} from "../api/rbac/permissions";

/**
 * Server action variant: Throws an error if the user's role doesn't have the required role(s) or permission(s)
 * @param role - The workspace role of the user
 * @param requiredRoles - Array of required roles (optional)
 * @param requiredPermissions - Array of required permissions (optional)
 */
// Server Action 使用的权限守卫：角色或权限不满足时直接抛错，阻止后续业务执行。
export function throwIfNoPermission({
  role,
  requiredRoles,
  requiredPermissions,
}: {
  role: WorkspaceRole;
  requiredRoles?: WorkspaceRole[];
  requiredPermissions?: PermissionAction[];
}) {
  // 如果指定了必须具备的角色，当前角色不在列表中就拒绝访问。
  if (
    requiredRoles &&
    requiredRoles.length > 0 &&
    !requiredRoles.includes(role)
  ) {
    throw new Error(
      `You don't have the required role to access this endpoint. Required role(s): ${requiredRoles.join(", ")}.`,
    );
  }

  // 如果指定了必须具备的权限，先根据当前角色换算出实际权限列表。
  if (requiredPermissions && requiredPermissions.length > 0) {
    const permissions = getPermissionsByRole(role);

    // 找出当前角色缺少的权限点。
    const missingPermissions = requiredPermissions.filter(
      (p) => !permissions.includes(p),
    );

    // 没有缺失权限，说明校验通过。
    if (missingPermissions.length === 0) {
      return;
    }

    throw new Error(
      `You don't have the necessary permissions to complete this request. Required permission(s): ${missingPermissions.join(", ")}.`,
    );
  }
}
