// =============================================================================
// AddEditTokenModal —— 创建 / 编辑 API Key 的弹窗组件
// -----------------------------------------------------------------------------
// 这个 modal 在 workspace settings 的 tokens 页面被唤起，负责：
//   · 创建新的 API key（dub_ 开头的 restricted token）
//   · 编辑已有 key 的 name 和 scopes
//
// 表单字段：
//   Name        → key 的显示名称
//   Type        → You（绑定当前用户）/ Machine（创建独立 bot 用户）
//   Permissions → All / Read Only / Restricted 三档预设 + 资源级细粒度
//
// 提交后：
//   · 新建 → POST  /api/tokens       → 返回明文 token（仅显示一次）
//   · 编辑 → PATCH /api/tokens/:id   → 只改 name / scopes
// =============================================================================

import { ResourceKey, RESOURCES } from "@/lib/api/rbac/resources";
import {
  getScopesByResourceForRole,
  Scope,
  scopePresets,
} from "@/lib/api/tokens/scopes";
import { clientAccessCheck } from "@/lib/client-access-check";
import useWorkspace from "@/lib/swr/use-workspace";
import {
  AnimatedSizeContainer,
  Button,
  ButtonProps,
  InfoTooltip,
  Label,
  Modal,
  RadioGroup,
  RadioGroupItem,
  ToggleGroup,
} from "@dub/ui";
import { cn } from "@dub/utils";
import {
  Dispatch,
  FormEvent,
  SetStateAction,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { toast } from "sonner";
import { mutate } from "swr";

// 表单数据的结构定义，对应后端 createTokenSchema
type APIKeyProps = {
  id?: string;
  name: string;
  // scopes 按 resource 分组：{ links: "links.write", domains: "domains.read" }
  // 值为 Scope 字符串（如 "apis.all"），最终提交时会拍平成数组
  scopes: { [key: string]: Scope };
  // 是否创建 Machine User（独立 bot 账号，不随创建者离开而删除）
  isMachine: boolean;
};

// Permissions 区的三档预设值，对应 scopePresets（scopes.ts 里定义）
type ScopePreset = "all_access" | "read_only" | "restricted";

// 新建 token 时的表单初始值
// 默认 All access（apis.all = 拥有所有 API 权限）
const newToken: APIKeyProps = {
  name: "",
  scopes: { api: "apis.all" },
  isMachine: false,
};

// 主组件：弹窗内容 + 表单逻辑
function AddEditTokenModal({
  showAddEditTokenModal, // 控制弹窗显示/隐藏的布尔状态
  setShowAddEditTokenModal, // 设置弹窗显示状态（关闭时调用）
  token, // 传入 = 编辑模式；不传 = 新建模式
  onTokenCreated, // 新建成功后回调，把明文 token 传出去（用于展示一次）
  setSelectedToken, // 清空当前选中的 token（关闭弹窗时重置外部状态）
}: {
  showAddEditTokenModal: boolean;
  setShowAddEditTokenModal: Dispatch<SetStateAction<boolean>>;
  token?: APIKeyProps;
  onTokenCreated?: (token: string) => void;
  setSelectedToken: Dispatch<SetStateAction<null>>;
}) {
  const [saving, setSaving] = useState(false);
  // 当前 workspace 的上下文：id 用于拼请求 URL，role/isOwner 控制 Machine 选项可用性
  const { id: workspaceId, role, isOwner, flags } = useWorkspace();
  // 表单数据：编辑模式用传入的 token 初始化，新建模式用默认值
  const [data, setData] = useState<APIKeyProps>(token || newToken);
  // 当前选中的 Permissions 预设（默认 All access）
  const [preset, setPreset] = useState<ScopePreset>("all_access");

  // 编辑模式下，根据已有 token 的 scopes 反推它属于哪个预设
  // · 包含 apis.all  → all_access
  // · 包含 apis.read → read_only
  // · 其他           → restricted
  useEffect(() => {
    if (!token) {
      return;
    }

    const scopes = Object.values(token.scopes);

    if (scopes.includes("apis.all")) {
      setPreset("all_access");
    } else if (scopes.includes("apis.read")) {
      setPreset("read_only");
    } else {
      setPreset("restricted");
    }
  }, [token]);

  // 根据新建/编辑模式，决定提交的 endpoint 和 method
  const endpoint = useMemo(() => {
    if (token) {
      return {
        method: "PATCH",
        url: `/api/tokens/${token.id}?workspaceId=${workspaceId}`,
        successMessage: "API key updated!",
      };
    } else {
      return {
        method: "POST",
        url: `/api/tokens?workspaceId=${workspaceId}`,
        successMessage: "API key created!",
      };
    }
  }, [token]);

  // 表单提交：发请求 → 成功后刷新列表 + 关闭弹窗 + 回调
  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);

    const response = await fetch(endpoint.url, {
      method: endpoint.method,
      headers: {
        "Content-Type": "application/json",
      },
      // scopes 从 {resource: scope} 对象拍平成字符串数组，过滤掉空值
      // 后端会 join(" ") 存到 restrictedToken.scopes 字段
      body: JSON.stringify({
        ...data,
        scopes: Object.values(scopes).filter((v) => v),
      }),
    });

    const result = await response.json();

    if (response.ok) {
      // 刷新 tokens 列表（SWR cache 失效重取）
      mutate(`/api/tokens?workspaceId=${workspaceId}`);
      toast.success(endpoint.successMessage);
      setShowAddEditTokenModal(false);
      setSelectedToken(null);

      // 新建模式下，把明文 token 通过回调传给调用方
      // 调用方通常会弹一个"请复制保存，仅显示一次"的二次确认窗
      if (!token) {
        onTokenCreated?.(result.token);
      }
    } else {
      setSaving(false);
      toast.error(result.error.message);
    }
  };

  const { name, scopes } = data;
  // 按钮禁用条件：名字为空，或者名字和 scopes 都没变化（编辑模式）
  const buttonDisabled =
    (!name || token?.name === name) && token?.scopes === scopes;

  // 根据当前用户角色，拿到这个角色「能授予」的所有 scope，按 resource 分组
  // 然后转成 UI 需要的结构（合并 RESOURCES 里的展示信息）
  // Restricted 模式下会渲染成一张资源 × 权限的表格
  const scopesByResources = transformScopesForUI(
    getScopesByResourceForRole(role),
  ).filter(({ name }) => name);

  return (
    <>
      <Modal
        showModal={showAddEditTokenModal}
        setShowModal={setShowAddEditTokenModal}
        className="max-w-lg"
        onClose={() => setSelectedToken(null)}
      >
        {/* 弹窗标题：编辑模式显示 "Edit API Key"，新建模式显示 "Create New API Key" */}
        <h3 className="border-b border-neutral-200 px-4 py-4 text-lg font-medium sm:px-6">
          {token ? "Edit" : "Create New"} API Key
        </h3>

        <form
          onSubmit={onSubmit}
          className="flex flex-col space-y-4 bg-neutral-50 px-4 py-8 text-left sm:px-10"
        >
          {/* ============ 字段 1：Name ============ */}
          <div>
            <label htmlFor="name">
              <h2 className="text-sm font-medium text-neutral-900">Name</h2>
            </label>
            <div className="relative mt-2 rounded-md shadow-sm">
              <input
                id="name"
                className="block w-full rounded-md border-neutral-300 text-neutral-900 placeholder-neutral-400 focus:border-neutral-500 focus:outline-none focus:ring-neutral-500 sm:text-sm"
                required
                value={name}
                onChange={(e) => setData({ ...data, name: e.target.value })}
                autoFocus
                autoComplete="off"
              />
            </div>
          </div>

          {/* ============ 字段 2：Type（仅新建模式显示，编辑时不能改类型） ============ */}
          {/* Can't change the type of the token */}
          {!token && (
            <div>
              <h2 className="text-sm font-medium text-neutral-900">Type</h2>
              <RadioGroup
                className="mt-2 flex"
                defaultValue="user"
                required
                onValueChange={(value) =>
                  setData({ ...data, isMachine: value === "machine" })
                }
              >
                {/* You：key 绑定到当前用户，用户被移除时 key 一起删除 */}
                <div className="flex w-1/2 items-center space-x-2 rounded-md border border-neutral-300 bg-white transition-all hover:bg-neutral-50 active:bg-neutral-100">
                  <RadioGroupItem value="user" id="user" className="ml-3" />
                  <Label
                    htmlFor="user"
                    className="flex flex-1 cursor-pointer items-center justify-between space-x-1 p-3 pl-0"
                  >
                    <p className="text-neutral-600">You</p>
                    <InfoTooltip content="This API key will be tied to your user account – if you are removed from the workspace, it will be deleted. [Learn more](https://dub.co/docs/api-reference/tokens)" />
                  </Label>
                </div>
                {/* Machine：创建独立的 bot 用户，key 不随创建者离开而删除 */}
                {/* 只有 workspace owner 才能创建 Machine User */}
                <div
                  className={cn(
                    "flex w-1/2 items-center space-x-2 rounded-md border border-neutral-300 bg-white transition-all hover:bg-neutral-50 active:bg-neutral-100",
                    {
                      "cursor-not-allowed opacity-75": !isOwner,
                    },
                  )}
                >
                  <RadioGroupItem
                    value="machine"
                    id="machine"
                    className="ml-3"
                    disabled={!isOwner}
                  />
                  <Label
                    htmlFor="machine"
                    className={cn(
                      "flex flex-1 cursor-pointer items-center justify-between space-x-1 p-3 pl-0",
                      {
                        "cursor-not-allowed": !isOwner,
                      },
                    )}
                  >
                    <p className="text-neutral-600">Machine</p>
                    <InfoTooltip
                      content={
                        isOwner
                          ? "A new bot member will be added to your workspace, and the key will be associated with it. Since the key is not tied to your account, it will not be deleted even if you leave the workspace. [Learn more](https://dub.co/docs/api-reference/tokens#machine-users)"
                          : "Only the workspace owner can create machine users."
                      }
                    />
                  </Label>
                </div>
              </RadioGroup>
            </div>
          )}

          {/* ============ 字段 3：Permissions（三档预设） ============ */}
          <div className="flex flex-col gap-2">
            <h2 className="text-sm font-medium text-neutral-900">
              Permissions
            </h2>

            {/* ToggleGroup 渲染 scopePresets：All / Read Only / Restricted */}
            <ToggleGroup
              options={scopePresets}
              selected={preset}
              selectAction={(value: ScopePreset) => {
                setPreset(value);

                // 切换预设时，同步更新表单里的 scopes 值
                if (value === "all_access") {
                  // All → apis.all（拥有全部 API 权限）
                  setData({ ...data, scopes: { api: "apis.all" } });
                } else if (value === "read_only") {
                  // Read Only → apis.read（只读所有资源）
                  setData({ ...data, scopes: { api: "apis.read" } });
                } else {
                  // Restricted → 清空，展开资源级勾选让用户自选
                  setData({ ...data, scopes: {} });
                }
              }}
              className="grid grid-cols-3 rounded-md border border-neutral-300 bg-neutral-100"
              optionClassName="w-full h-8 flex items-center justify-center text-sm text-neutral-800"
              indicatorClassName="rounded-md bg-white border border-neutral-300 shadow-sm"
            />
          </div>

          {/* 动态高度容器：内容变化时平滑过渡 */}
          <AnimatedSizeContainer height>
            {/* 提示语：根据当前预设动态显示，例如 "full access to all resources" */}
            <div className="p-1 pt-0 text-sm text-neutral-500">
              This API key will have{" "}
              <span className="font-medium text-neutral-700">
                {scopePresets.find((p) => p.value === preset)?.description}
              </span>
            </div>
            {/* ============ Restricted 模式：展开资源级权限勾选表 ============ */}
            {preset === "restricted" && (
              <div className="flex flex-col divide-y text-sm">
                {/* 遍历所有可用的资源（links / domains / tags / webhooks ...）
                    每个资源一行，可选 None / Read / Write 等权限 */}
                {scopesByResources.map((resource) => (
                  <div
                    className="flex items-center justify-between py-4"
                    key={resource.key}
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-medium text-neutral-800">
                        {resource.name}
                      </span>
                      <InfoTooltip content={resource.description} />
                    </div>
                    <div>
                      {/* 单个资源的权限单选组：None / Read / Write ...
                          选中后写入 scopes[resourceKey] */}
                      <RadioGroup
                        defaultValue={scopes[resource.key] || ""}
                        className="flex gap-4"
                        onValueChange={(v: Scope) => {
                          setData({
                            ...data,
                            scopes: {
                              ...scopes,
                              [resource.key]: v,
                            },
                          });
                        }}
                      >
                        {/* None：不勾选，清掉该资源的 scope */}
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="" />
                          <div>None</div>
                        </div>
                        {/* 该资源支持的所有 scope 类型（read / write / all） */}
                        {resource.scopes.map((scope) => (
                          <div
                            className="flex items-center space-x-2"
                            key={scope.scope}
                          >
                            <RadioGroupItem value={scope.scope} />
                            <div className="text-sm font-normal capitalize text-neutral-800">
                              {scope.type}
                            </div>
                          </div>
                        ))}
                      </RadioGroup>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </AnimatedSizeContainer>

          {/* 提交按钮：编辑显示 "Save changes"，新建显示 "Create API key" */}
          <Button
            text={token ? "Save changes" : "Create API key"}
            disabled={buttonDisabled}
            loading={saving}
          />
        </form>
      </Modal>
    </>
  );
}

// 触发弹窗的按钮组件（带权限校验 tooltip）
// 没有 tokens.write 权限的用户点击会被禁用并显示原因
function AddTokenButton({
  setShowAddEditTokenModal,
  buttonProps,
}: {
  setShowAddEditTokenModal: Dispatch<SetStateAction<boolean>>;
  buttonProps?: Partial<ButtonProps>;
}) {
  const { role } = useWorkspace();

  return (
    <div>
      <Button
        text="Create API key"
        onClick={() => setShowAddEditTokenModal(true)}
        // 前端权限预检：role 没有 tokens.write 时禁用按钮并显示提示
        // 真正的权限拦截在后端 withWorkspace.requiredPermissions 里
        disabledTooltip={
          clientAccessCheck({
            action: "tokens.write",
            role,
            customPermissionDescription: "create new API keys",
          }).error || undefined
        }
        className="h-9 px-3"
        {...buttonProps}
      />
    </div>
  );
}

// 自定义 Hook：封装弹窗的状态管理 + 对外暴露 Modal 组件和触发按钮
// 用法：
//   const { AddEditTokenModal, AddTokenButton } = useAddEditTokenModal({...});
//   return <><AddTokenButton /><AddEditTokenModal /></>
export function useAddEditTokenModal({
  token,
  onTokenCreated,
  setSelectedToken,
}: {
  token?: APIKeyProps;
  onTokenCreated?: (token: string) => void;
  setSelectedToken: Dispatch<SetStateAction<null>>;
}) {
  const [showAddEditTokenModal, setShowAddEditTokenModal] = useState(false);

  // Modal 组件用 useCallback 包裹，避免父组件重渲染时重新 mount
  const AddEditTokenModalCallback = useCallback(() => {
    return (
      <AddEditTokenModal
        showAddEditTokenModal={showAddEditTokenModal}
        setShowAddEditTokenModal={setShowAddEditTokenModal}
        token={token}
        onTokenCreated={onTokenCreated}
        setSelectedToken={setSelectedToken}
      />
    );
  }, [showAddEditTokenModal, setShowAddEditTokenModal]);

  // 按钮组件同样用 useCallback 包裹
  const AddTokenButtonCallback = useCallback(() => {
    return (
      <AddTokenButton setShowAddEditTokenModal={setShowAddEditTokenModal} />
    );
  }, [setShowAddEditTokenModal]);

  // 对外返回稳定引用的组件工厂和 setter
  return useMemo(
    () => ({
      setShowAddEditTokenModal,
      AddEditTokenModal: AddEditTokenModalCallback,
      AddTokenButton: AddTokenButtonCallback,
    }),
    [
      setShowAddEditTokenModal,
      AddEditTokenModalCallback,
      AddTokenButtonCallback,
    ],
  );
}

// 工具函数：把「按 resource 分组的 scope 字典」转成 UI 可渲染的数组
// 输入：{ links: [scope1, scope2], domains: [scope3] }
// 输出：[{ ...RESOURCES.links, scopes: [scope1, scope2] }, ...]
// 合并 RESOURCES 后能拿到每个资源的展示名（name）和说明（description）
const transformScopesForUI = (scopedResources) => {
  return Object.keys(scopedResources).map((resourceKey: ResourceKey) => {
    return {
      ...RESOURCES.find((r) => r.key === resourceKey)!,
      scopes: scopedResources[resourceKey],
    };
  });
};
