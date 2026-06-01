import { WorkspaceRole } from "@dub/prisma/client";
import { combineWords } from "@dub/utils";
import { PermissionAction, ROLE_PERMISSIONS } from "./api/rbac/permissions";

/**
 * 在客户端检查当前 workspace 角色是否有权限执行某个操作。
 *
 * 这个函数主要用于前端 UI 层：
 * - 判断按钮、菜单、快捷键等交互是否应该可用
 * - 在无权限时生成可直接展示给用户的提示文案
 *
 * 注意：这只是客户端体验层面的权限检查，不是安全边界。
 * 真正的权限校验仍然必须在服务端 API 中完成，因为客户端逻辑可以被绕过。
 */
export const clientAccessCheck = ({
  action,
  role,
  customPermissionDescription,
}: {
  /** 要检查的权限动作，例如 "links.write"、"tokens.write"、"billing.write"。 */
  action: PermissionAction;

  /** 当前用户在 workspace 中的角色，例如 owner、member、viewer、billing。 */
  role: WorkspaceRole;

  /**
   * 自定义无权限提示中的操作描述。
   *
   * 如果不传，会使用 ROLE_PERMISSIONS 中该 action 对应的默认 description。
   * 例如默认描述是 "manage API keys"，某个页面可以覆盖为
   * "update or delete API keys"，让提示更贴合当前操作。
   */
  customPermissionDescription?: string;
}) => {
  // 根据传入的 action，从统一的角色权限映射表中找到对应权限配置。
  // 这里使用非空断言 `!`，是因为 action 的类型来自 PermissionAction，
  // 理论上每个合法 action 都应该在 ROLE_PERMISSIONS 中有对应配置。
  const permission = ROLE_PERMISSIONS.find((p) => p.action === action)!;

  // 这个 action 允许哪些 workspace 角色执行，例如 ["owner", "member"]。
  const allowedWorkspaceRoles = permission.roles;

  // 当前用户角色是否在允许列表中。
  const allowed = allowedWorkspaceRoles.includes(role);

  if (allowed) {
    // 有权限时不需要错误提示。error 返回 false，方便调用方直接做真假判断。
    return {
      allowed,
      error: false,
    };
  }

  // 无权限时，返回一段适合展示在 tooltip / disabled state 中的文案。
  // billing 角色特殊处理成 "billing user"，避免生成不自然的 "billings"。
  // combineWords 会把 ["owners", "members"] 拼成 "owners and members"。
  return {
    allowed,
    error: `Only workspace ${combineWords(allowedWorkspaceRoles.map((r) => `${r === "billing" ? "billing user" : r}s`))} can ${customPermissionDescription || permission.description}.`,
  };
};
