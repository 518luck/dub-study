// =============================================================================
// Token Scopes & Permissions —— API Key 的权限范围映射体系
// -----------------------------------------------------------------------------
// 这个文件是「受限 API Key（RestrictedToken）权限系统」的核心数据源，
// 回答了三个根本问题：
//   ① 一个 scope（如 "links.write"）到底代表哪些实际权限？
//   ② 某种 workspace 角色（owner / member / viewer / billing）能授予哪些 scope？
//   ③ 前端界面上「全部 / 只读 / 限制」三档预设分别对应什么 scope？
//
// 数据流（与外部的关系）：
//   · 前端 modal（add-edit-token-modal.tsx）：用户勾选权限 → 生成 scopes 数组
//   · 后端 schema（token.ts）：用 SCOPES 做 z.enum 校验，只认这里登记的合法值
//   · 后端路由（tokens/[id]/route.ts）：保存时 join(" ")，读取时 split(" ")
//   · 鉴权（workspace.ts）：用 SCOPE_PERMISSIONS_MAP 把 scope 展开成权限放行
//
// 两类 scope（理解全表的关键）：
//   · 资源级 scope：形如 "links.write"、"domains.read"，精确到「某资源 + 读/写」
//   · 通配 scope：apis.all（全部 API 权限）、apis.read（全部只读权限），是多个资源级权限的「宏」
// =============================================================================
import { WorkspaceRole } from "@dub/prisma/client";
import { PermissionAction } from "../rbac/permissions";
import { ResourceKey } from "../rbac/resources";

// -----------------------------------------------------------------------------
// SCOPES —— 所有合法 scope 字符串的「户口本」
// -----------------------------------------------------------------------------
// 这里登记了系统里所有可能出现的 scope。它的两个作用：
//   ① 作为 zod 校验的合法值集合（token.ts 里 z.enum(SCOPES) 用到）
//   ② 派生出 Scope 字面量联合类型，让 TS 在编码期能自动补全 + 检查拼写
//
// 想新增一个 scope？第一步就是往这里加一行。
// -----------------------------------------------------------------------------
export const SCOPES = [
  "links.read",
  "links.write",
  "tags.read",
  "tags.write",
  "folders.read",
  "folders.write",
  "analytics.read",
  "domains.read",
  "domains.write",
  "workspaces.read",
  "workspaces.write",
  "webhooks.read",
  "webhooks.write",
  "groups.read",
  "groups.write",
  "apis.all", // All API scopes —— 通配：拥有所有 API 的读写权限
  "apis.read", // All read scopes —— 通配：拥有所有资源的只读权限
] as const;

// Scope 类型：把上面数组里的每个字符串「升级」成 TS 字面量联合类型
// 效果：之后任何标注为 Scope 的变量，只能填这 17 个字符串之一，填别的 TS 会报错
export type Scope = (typeof SCOPES)[number];

// -----------------------------------------------------------------------------
// RESOURCE_SCOPES —— scope 的「权威解释表」（整张表的灵魂）
// -----------------------------------------------------------------------------
// 每一项把一个 scope 解释成四个维度：
//   · scope       ：scope 名（对应 SCOPES 里的某一项）
//   · roles       ：哪些 workspace 角色能「授予」这个 scope
//                   （注意是「能授予」，不是「拥有」——viewer 默认读权限，但也可能被授予只读 key）
//   · permissions ：这个 scope 实际展开成哪些细粒度权限（鉴权时真正放行的就是这些）
//   · type        ：read / write（仅资源级 scope 有，通配 scope 不填）
//   · resource    ：属于哪个资源（仅资源级 scope 有，通配 scope 不填）
//
// ★ 关键规律（看几组对照就能发现）：
//   1. xxx.write 的 permissions 永远「隐含」对应的 xxx.read
//      （能写就一定能读，所以 links.write → ["links.write", "links.read"]）
//   2. 写权限通常只有 owner + member 能授；读权限四种角色都能授
//      （唯独 domains/workspaces/webhooks.write 是 owner 独占——更敏感）
//   3. apis.all / apis.read 没有 resource/type，因为它们是「横跨所有资源」的通配 scope
// -----------------------------------------------------------------------------
// Scopes available for Workspace API keys
export const RESOURCE_SCOPES: {
  scope: Scope;
  roles: WorkspaceRole[];
  permissions: PermissionAction[];
  type?: "read" | "write";
  resource?: ResourceKey;
}[] = [
  // ---------- Links（短链）----------
  {
    scope: "links.read",
    roles: ["owner", "member", "viewer", "billing"],
    permissions: ["links.read"],
    type: "read",
    resource: "links",
  },
  {
    scope: "links.write",
    roles: ["owner", "member"],
    permissions: ["links.write", "links.read"], // 写隐含读
    type: "write",
    resource: "links",
  },
  // ---------- Tags（标签）----------
  {
    scope: "tags.read",
    roles: ["owner", "member", "viewer", "billing"],
    permissions: ["tags.read"],
    type: "read",
    resource: "tags",
  },
  {
    scope: "tags.write",
    roles: ["owner", "member"],
    permissions: ["tags.write", "tags.read"],
    type: "write",
    resource: "tags",
  },
  // ---------- Folders（文件夹）----------
  {
    scope: "folders.read",
    roles: ["owner", "member", "viewer", "billing"],
    permissions: ["folders.read"],
    type: "read",
    resource: "folders",
  },
  {
    scope: "folders.write",
    roles: ["owner", "member"],
    permissions: ["folders.write", "folders.read"],
    type: "write",
    resource: "folders",
  },
  // ---------- Domains（域名）----------
  // 注意：domains.write 只有 owner 能授——域名是高敏感资源
  {
    scope: "domains.read",
    roles: ["owner", "member", "viewer", "billing"],
    permissions: ["domains.read"],
    type: "read",
    resource: "domains",
  },
  {
    scope: "domains.write",
    roles: ["owner"],
    permissions: ["domains.write", "domains.read"],
    type: "write",
    resource: "domains",
  },
  // ---------- Groups（分组）----------
  {
    scope: "groups.read",
    roles: ["owner", "member", "viewer", "billing"],
    permissions: ["groups.read"],
    type: "read",
    resource: "groups",
  },
  {
    scope: "groups.write",
    roles: ["owner", "member"],
    permissions: ["groups.write", "groups.read"],
    type: "write",
    resource: "groups",
  },
  // ---------- Workspaces（工作区本身）----------
  // 注意：workspaces.write 只有 owner 能授——改 workspace 设置是最高敏感操作
  {
    scope: "workspaces.read",
    roles: ["owner", "member", "viewer", "billing"],
    permissions: ["workspaces.read"],
    type: "read",
    resource: "workspaces",
  },
  {
    scope: "workspaces.write",
    roles: ["owner"],
    permissions: ["workspaces.write", "workspaces.read"],
    type: "write",
    resource: "workspaces",
  },
  // ---------- Analytics（数据分析）----------
  // 只有读，没有写——分析数据是只读的，不存在「写分析」
  {
    scope: "analytics.read",
    roles: ["owner", "member", "viewer", "billing"],
    permissions: ["analytics.read"],
    type: "read",
    resource: "analytics",
  },
  // ---------- Webhooks（回调）----------
  // webhooks.write 同样只限 owner
  {
    scope: "webhooks.read",
    roles: ["owner", "member", "viewer", "billing"],
    permissions: ["webhooks.read"],
    type: "read",
    resource: "webhooks",
  },
  {
    scope: "webhooks.write",
    roles: ["owner"],
    permissions: ["webhooks.write", "webhooks.read"],
    type: "write",
    resource: "webhooks",
  },
  // ---------- 通配 scope（apis.*）：跨资源的「打包权限」----------
  // apis.read = 所有资源的「读」打包；四种角色都能授
  // 注意它没有 resource / type 字段（因为不属于单一资源）
  {
    scope: "apis.read",
    roles: ["owner", "member", "viewer", "billing"],
    permissions: [
      "links.read",
      "tags.read",
      "folders.read",
      "domains.read",
      "workspaces.read",
      "analytics.read",
      "groups.read",
    ],
  },
  // apis.all = 所有资源的「读 + 写」打包；只有 owner + member 能授
  // 这是权限最大的 scope，对应界面的「All」按钮
  {
    scope: "apis.all",
    roles: ["owner", "member"],
    permissions: [
      "links.read",
      "links.write",
      "tags.read",
      "tags.write",
      "folders.read",
      "folders.write",
      "domains.read",
      "domains.write",
      "workspaces.read",
      "workspaces.write",
      "analytics.read",
      "groups.read",
      "groups.write",
    ],
  },
];

// -----------------------------------------------------------------------------
// 下面三个常量都是用 reduce 把 RESOURCE_SCOPES「转换视角」重新整理出来的查找表。
// 同一份数据，按不同维度索引，方便不同场景 O(1) 查询。
// -----------------------------------------------------------------------------

// SCOPES_BY_RESOURCE —— 「按资源分组」的索引
// 形如：{ links: [{scope, type, roles}, ...], domains: [...] }
// 用途：前端 Restricted 模式下，渲染「资源 × 读/写」勾选表格用
// （只收录带 resource 的资源级 scope，通配 apis.* 不进这张表）
export const SCOPES_BY_RESOURCE = RESOURCE_SCOPES.reduce((acc, scope) => {
  // 跳过没有 resource/type 的（即 apis.all / apis.read 这两个通配 scope）
  if (!scope.resource || !scope.type) {
    return acc;
  }

  // 给这个资源初始化一个空数组（第一次遇到时）
  if (!acc[scope.resource]) {
    acc[scope.resource] = [];
  }

  // 把「scope 名 + 读/写类型 + 可授予的角色」塞进去
  acc[scope.resource].push({
    scope: scope.scope,
    type: scope.type,
    roles: scope.roles,
  });

  return acc;
}, {});

// SCOPE_PERMISSIONS_MAP —— 「scope → 权限」的索引
// 形如：{ "links.write": ["links.write", "links.read"], "apis.all": [...12个] }
// 用途：鉴权时拿 token 的 scopes，查出每个 scope 对应的实际权限再放行
// （workspace.ts 里 mapScopesToPermissions 就是用这张表）
export const SCOPE_PERMISSIONS_MAP = RESOURCE_SCOPES.reduce((acc, scope) => {
  acc[scope.scope] = scope.permissions;
  return acc;
}, {});

// ROLE_SCOPES_MAP —— 「角色 → 可授予的 scope 列表」的索引
// 形如：{ owner: ["links.read", "links.write", ...所有], viewer: ["links.read", ...只读] }
// 用途：校验「某用户能不能给 token 授予这些 scope」（validateScopesForRole 用到）
// 这就是为什么 member 不能授 domains.write、viewer 只能授 .read 类 scope 的底层依据
export const ROLE_SCOPES_MAP = RESOURCE_SCOPES.reduce((acc, scope) => {
  // 遍历该 scope 允许的每一种角色
  scope.roles.forEach((role) => {
    if (!acc[role]) {
      acc[role] = [];
    }
    // 把这个 scope 挂到对应角色的「可授予权限池」里
    acc[role].push(scope.scope);
  });

  return acc;
}, {});

// =============================================================================
// 以下是一组「查询/校验函数」，都是对上面三张表的封装
// =============================================================================

// For each scope, get the permissions it grants access to and return array of permissions
// > 从 SCOPE_PERMISSIONS_MAP 中，用 scopes 数组里的每个 scope 去查对应的权限，拼成一个 permissions 数组并返回。
// 场景：鉴权时，把 token 携带的 scopes 展开成实际权限集合（如 ["links.write"] → ["links.write", "links.read"]）
export const mapScopesToPermissions = (scopes: Scope[]) => {
  const permissions: PermissionAction[] = [];

  scopes.forEach((scope) => {
    if (SCOPE_PERMISSIONS_MAP[scope]) {
      permissions.push(...SCOPE_PERMISSIONS_MAP[scope]);
    }
  });

  return permissions;
};

// Get SCOPES_BY_RESOURCE based on user role in a workspace
// > 根据用户角色，返回「该角色能授予的、按资源分组的 scope 集合」
// 场景：前端打开「创建/编辑 key」弹窗时调用，渲染 Restricted 表格——
//       不同角色看到的可选资源/操作不同（member 看不到 domains.write 这一行）
export const getScopesByResourceForRole = (role: WorkspaceRole) => {
  const groupedByResource = {};

  // 第一步：从全集里筛出该角色能授予的 scope（按 roles 字段过滤）
  const allowedScopes = RESOURCE_SCOPES.map((scope) => {
    if (scope.roles.includes(role)) {
      return scope;
    }
  }).filter(Boolean); // filter(Boolean) 去掉上面 map 返回的 undefined

  // 第二步：把筛出来的 scope 按 resource 重新分组
  allowedScopes.forEach((scope) => {
    if (scope && scope.resource) {
      if (!groupedByResource[scope.resource]) {
        groupedByResource[scope.resource] = [];
      }

      groupedByResource[scope.resource].push(scope);
    }
  });

  return groupedByResource;
};

// -----------------------------------------------------------------------------
// scopePresets —— 前端「全部 / 只读 / 限制」三档预设的展示元数据
// -----------------------------------------------------------------------------
// 这是 ToggleGroup 组件的配置项，纯展示用：
//   · value       ：内部标识（add-edit-token-modal.tsx 里 selectAction 用它分支）
//   · label       ：按钮上显示的文字
//   · description ：选中后下方的说明文字
//
// 注意：这里只是「展示配置」，真正切换时往 scopes 里塞什么值，
//       是 modal 里的 selectAction 决定的（如 all_access → { api: "apis.all" }）
// -----------------------------------------------------------------------------
export const scopePresets = [
  {
    value: "all_access",
    label: "All",
    description: "full access to all resources",
  },
  {
    value: "read_only",
    label: "Read Only",
    description: "read-only access to all resources",
  },
  {
    value: "restricted",
    label: "Restricted",
    description: "restricted access to some resources",
  },
];

// -----------------------------------------------------------------------------
// scopesToName —— 反查：从 scopes 数组推断它属于哪个预设
// -----------------------------------------------------------------------------
// 场景：编辑已有 key 时，要根据它现有的 scopes 反推界面该高亮哪个预设按钮
// 判断顺序（重要，不能乱）：
//   ① 含 apis.all  → All access（最强，先判）
//   ② 含 apis.read → Read-only（次强）
//   ③ 其他         → Restricted（具体的资源级 scope 组合）
// -----------------------------------------------------------------------------
export const scopesToName = (scopes: string[]) => {
  if (scopes.includes("apis.all")) {
    return {
      name: "All access",
      description: "full access to all resources",
    };
  }

  if (scopes.includes("apis.read")) {
    return {
      name: "Read-only",
      description: "read-only access to all resources",
    };
  }

  return {
    name: "Restricted",
    description: "restricted access to some resources",
  };
};

// -----------------------------------------------------------------------------
// validateScopesForRole —— 校验「这些 scope 是否在该角色的可授予范围内」
// -----------------------------------------------------------------------------
// 场景：PATCH /api/tokens/:id 里调用，防止越权授予
//       例如 member 角色不能授 domains.write（只有 owner 能），就该拒绝
// 逻辑：用 ROLE_SCOPES_MAP[role] 拿到该角色的全部合法 scope，
//       只要传入的 scopes 里有任何一条不在这个范围内，就返回 false
// 返回：true = 全部合法 / false = 有越权
// -----------------------------------------------------------------------------
export const validateScopesForRole = (scopes: Scope[], role: WorkspaceRole) => {
  const allowedScopes = ROLE_SCOPES_MAP[role];
  // 找出传入 scopes 里「不在该角色合法范围内」的越权项
  const invalidScopes = scopes.filter(
    (scope) => !allowedScopes.includes(scope),
  );

  // 没有越权项才算通过
  return !(invalidScopes.length > 0);
};

// Get the scopes for a role
// > 返回某个角色的全部可授予 scope 列表（直接读 ROLE_SCOPES_MAP）
export const getScopesForRole = (role: WorkspaceRole) => {
  return ROLE_SCOPES_MAP[role];
};

// -----------------------------------------------------------------------------
// consolidateScopes —— 合并/去重 scopes，保留「最强」权限
// -----------------------------------------------------------------------------
// 场景：同一资源同时有 read 和 write scope 时，只保留 write（因为 write 隐含 read）
// 例如：["links.read", "links.write", "domains.read"]
//       → ["links.write", "domains.read"]   （links.read 被 links.write 吞掉）
// 逻辑：用 Set 去重；遍历时遇到 write 就写 write，
//       遇到 read 时如果已有对应 write 就跳过
// 注意：这个函数处理的是「资源级 scope」（形如 xxx.read / xxx.write），
//       对 apis.all / apis.read 这种通配 scope 不会正确处理
// -----------------------------------------------------------------------------
export const consolidateScopes = (scopes: string[]) => {
  const consolidated = new Set();

  scopes.forEach((scope) => {
    const [resource, action] = scope.split(".");

    if (action === "write") {
      // write 直接加入（write 是更强的权限）
      consolidated.add(`${resource}.write`);
    } else if (action === "read" && !consolidated.has(`${resource}.write`)) {
      // read 只有在「该资源还没有 write」时才加入，避免和 write 重复
      consolidated.add(`${resource}.read`);
    }
  });

  return Array.from(consolidated) as string[];
};
