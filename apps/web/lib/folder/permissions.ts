"server-only";

import { Folder, FolderPermission } from "@/lib/types";
import { prisma } from "@dub/prisma";
import {
  FolderUser,
  FolderUserRole,
  Project,
  WorkspaceRole,
} from "@dub/prisma/client";
import { DubApiError } from "../api/errors";
import { getPlanCapabilities } from "../plan-capabilities";
import {
  FOLDER_USER_ROLE_TO_PERMISSIONS,
  FOLDER_WORKSPACE_ACCESS_TO_FOLDER_USER_ROLE,
} from "./constants";
import { getFolderOrThrow } from "./get-folder-or-throw";

// 服务端文件夹权限工具：把工作区角色、文件夹成员角色和访问级别转换为可执行权限。
export const verifyFolderAccess = async ({
  workspace,
  userId,
  folderId,
  requiredPermission,
}: {
  workspace: Pick<Project, "id" | "plan"> & {
    users: { role: WorkspaceRole }[];
  };
  userId: string;
  folderId: string;
  requiredPermission: FolderPermission;
}) => {
  const folder = await getFolderOrThrow({
    workspaceId: workspace.id,
    folderId,
    userId,
  });

  // 工作区所有者默认拥有所有文件夹权限。
  if (workspace.users[0]?.role === WorkspaceRole.owner) {
    return folder;
  }

  const { canManageFolderPermissions } = getPlanCapabilities(workspace.plan);

  // 当前套餐不支持文件夹权限时，跳过细粒度权限校验。
  if (!canManageFolderPermissions) {
    return folder;
  }

  const folderUserRole = findFolderUserRole({
    folder,
    user: folder.user,
    workspaceRole: workspace.users[0]?.role,
  });

  if (!folderUserRole) {
    throw new DubApiError({
      code: "forbidden",
      message: "You are not allowed to perform this action on this folder.",
    });
  }

  const permissions = getFolderPermissions(folderUserRole);

  if (!permissions.includes(requiredPermission)) {
    throw new DubApiError({
      code: "forbidden",
      message: "You are not allowed to perform this action on this folder.",
    });
  }

  return folder;
};

// 批量判断多个文件夹是否拥有指定权限，返回每个文件夹的校验结果。
export const verifyFolderAccessBulk = async ({
  workspace,
  userId,
  folderIds,
  requiredPermission,
}: {
  workspace: Pick<Project, "id" | "plan"> & {
    users: { role: WorkspaceRole }[];
  };
  userId: string;
  folderIds: string[];
  requiredPermission: FolderPermission;
}) => {
  // 工作区所有者默认拥有所有文件夹权限。
  if (workspace.users[0]?.role === WorkspaceRole.owner) {
    return folderIds.map((folderId) => ({
      folderId,
      hasPermission: true,
    }));
  }

  const folders = await prisma.folder.findMany({
    where: {
      projectId: workspace.id,
      id: {
        in: folderIds,
      },
    },
    include: {
      users: {
        where: {
          userId,
        },
        take: 1,
      },
    },
  });

  return folders.map((folder) => {
    const folderUserRole = findFolderUserRole({
      folder,
      user: folder.users[0],
      workspaceRole: workspace.users[0]?.role,
    });

    if (folderUserRole == null) {
      return {
        folderId: folder.id,
        hasPermission: false,
      };
    }

    const permissions = getFolderPermissions(folderUserRole);

    return {
      folderId: folder.id,
      hasPermission: permissions.includes(requiredPermission),
    };
  });
};

// 推导用户在文件夹中的角色：优先显式成员角色，其次使用文件夹的工作区访问级别。
export const findFolderUserRole = ({
  folder,
  user,
  workspaceRole,
}: {
  folder: Pick<Folder, "accessLevel">;
  user: Pick<FolderUser, "role"> | null;
  workspaceRole: WorkspaceRole;
}) => {
  if (workspaceRole === WorkspaceRole.owner) {
    return FolderUserRole.owner;
  }

  if (user) {
    return user.role;
  }

  if (!folder.accessLevel) {
    return null;
  }

  return FOLDER_WORKSPACE_ACCESS_TO_FOLDER_USER_ROLE[folder.accessLevel];
};

// 根据文件夹角色获取对应的权限点列表。
export const getFolderPermissions = (role: string | null) => {
  if (!role) {
    return [];
  }

  return FOLDER_USER_ROLE_TO_PERMISSIONS[role] || [];
};
