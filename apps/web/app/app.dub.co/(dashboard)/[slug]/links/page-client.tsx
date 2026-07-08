"use client";

import useCurrentFolderId from "@/lib/swr/use-current-folder-id";
import {
  useCheckFolderPermission,
  useFolderPermissions,
} from "@/lib/swr/use-folder-permissions";
import useLinks from "@/lib/swr/use-links";
import useWorkspace from "@/lib/swr/use-workspace";
import { useWorkspaceStore } from "@/lib/swr/use-workspace-store";
import { FolderDropdown } from "@/ui/folders/folder-dropdown";
import {
  FolderInfoPanel,
  FolderInfoPanelControls,
} from "@/ui/folders/folder-info-panel";
import { RequestFolderEditAccessButton } from "@/ui/folders/request-edit-button";
import { PageContentWithSidePanel } from "@/ui/layout/page-content/page-content-with-side-panel";
import { PageWidthWrapper } from "@/ui/layout/page-width-wrapper";
import LinkDisplay from "@/ui/links/link-display";
import LinksContainer from "@/ui/links/links-container";
import { LinksDisplayProvider } from "@/ui/links/links-display-provider";
import { useLinkFilters } from "@/ui/links/use-link-filters";
import { useAddEditTagModal } from "@/ui/modals/add-edit-tag-modal";
import { useDotLinkOfferModal } from "@/ui/modals/dot-link-offer-modal";
import { useExportLinksModal } from "@/ui/modals/export-links-modal";
import { useLinkBuilder } from "@/ui/modals/link-builder";
import { ThreeDots } from "@/ui/shared/icons";
import { SearchBoxPersisted } from "@/ui/shared/search-box";
import {
  Button,
  Filter,
  IconMenu,
  Popover,
  Tooltip,
  TooltipContent,
  useRouterStuff,
} from "@dub/ui";
import { Download, Globe, TableIcon, Tag } from "@dub/ui/icons";
import { useRouter, useSearchParams } from "next/navigation";
import { ReactNode, useEffect, useState } from "react";

export default function WorkspaceLinksClient() {
  // 获取当前页面正在查看的文件夹ID
  const { folderId } = useCurrentFolderId();

  return (
    // PageContentWithSidePanel
    // 含义：一个“页面主体 + 侧边栏”的页面壳组件
    // 作用：把这个页面按“标题区 / 控制区 / 主体区 / 侧边栏”组织起来
    <PageContentWithSidePanel
      // title 是一个“槽位”
      // 槽位可以理解成：这个位置在布局里的身份已经固定为“标题区”
      // 这里放进去的不是普通文本，而是 FolderDropdown
      // 说明这个页面顶部标题不是静态字符串，而是一个可交互的文件夹切换器
      title={
        <div className="-ml-2">
          <FolderDropdown hideFolderIcon={true} />
        </div>
      }
      // controls 也是一个槽位
      // 它代表页面顶部的“控制区 / 工具栏”
      // 当前页面的过滤、显示、搜索等控制逻辑，大概率都封装在 WorkspaceLinksPageControls 里
      controls={<WorkspaceLinksPageControls />}
      // sidePanel 是“右侧边栏槽位”
      // 这里不是一直显示，而是条件显示
      // 当 folderId 存在时，才渲染右侧 Folder 信息面板
      sidePanel={
        folderId
          ? {
              title: "Folder",
              content: <FolderInfoPanel />,
              controls: <FolderInfoPanelControls />,
            }
          : undefined
      }
    >
      {/*
      LinksDisplayProvider
      Provider 结尾的组件通常可以先理解成“上下文提供者”
      它的职责不是直接渲染页面，而是给下面的组件提供共享状态/配置
      这里很可能是在管理 links 的显示方式，比如 card / row、排序等
    */}
      <LinksDisplayProvider>
        {/*
        WorkspaceLinks
        这是页面主体内容区真正的核心组件
        links 列表、空状态（No links yet）、链接卡片等内容
        大概率都在这个组件或它的下游组件里
      */}
        <WorkspaceLinks />
      </LinksDisplayProvider>
    </PageContentWithSidePanel>
  );
}

export function WorkspaceLinksPageControls() {
  // #region useLinkBuilder 学习笔记
  // 这个 hook 不只是返回数据，还返回“可直接渲染的组件”。
  // 它把“创建链接”这套交互封装起来了，包括：
  // 1. 弹窗是否打开的状态
  // 2. 弹窗本体 LinkBuilder
  // 3. 打开弹窗的按钮 CreateLinkButton
  //
  // 这样页面调用时只需要：
  // const { LinkBuilder, CreateLinkButton } = useLinkBuilder();
  //
  // 然后直接渲染：
  // <LinkBuilder />
  // <CreateLinkButton />
  //
  // 而不需要自己重复写：
  // - useState 管理弹窗开关
  // - onClick 打开弹窗
  // - 把 show / setShow 手动传给弹窗
  //
  // 这里的知识点包括：
  // - 自定义 Hook
  // - useState 管理弹窗开关
  // - useCallback 缓存返回的函数组件
  // - useMemo 缓存最终返回对象
  // - hook 返回“组件能力”而不只是普通数据
  // #endregion
  const { LinkBuilder, CreateLinkButton } = useLinkBuilder();

  return (
    <>
      <LinkBuilder />
      <div className="hidden sm:block">
        <CreateLinkButton className="h-9" />
      </div>
    </>
  );
}

function WorkspaceLinks() {
  // router：编程式跳转（比如点 "Add domain" 跳到域名设置页）
  const router = useRouter();
  // isValidating：links 列表是否正在请求中（用于搜索框的 loading 动画）
  const { isValidating } = useLinks();
  // searchParams：读取 URL 查询参数（这里用来判断是否带 ?upgraded 等）
  const searchParams = useSearchParams();
  // workspace：当前工作区信息（plan、域名、slug 等）
  const workspace = useWorkspace();
  // 复用"创建链接"能力：LinkBuilder 弹窗 + CreateLinkButton 按钮
  const { LinkBuilder, CreateLinkButton } = useLinkBuilder();
  // 标签相关弹窗：AddEditTagModal 是弹窗本体，setShowAddEditTagModal 控制开关
  const { AddEditTagModal, setShowAddEditTagModal } = useAddEditTagModal();

  // 筛选器相关状态与方法（由 useLinkFilters 统一管理）
  // filters：全部可用的筛选项定义
  // activeFilters：当前已激活的筛选条件
  // onSelect / onRemove / onRemoveFilter / onRemoveAll：增删筛选条件
  // setSearch / setSelectedFilter：搜索词与当前选中筛选项
  const {
    filters,
    activeFilters,
    onSelect,
    onRemove,
    onRemoveFilter,
    onRemoveAll,
    setSearch,
    setSelectedFilter,
  } = useLinkFilters();

  // 当前所在文件夹（没进文件夹时为 undefined）
  const { folderId } = useCurrentFolderId();
  // 文件夹权限数据是否还在加载（决定右上角按钮显示骨架还是按钮）
  const { isLoading } = useFolderPermissions();
  // 检查当前用户在 folderId 下是否有"写链接"权限
  // canCreateLinks 为 false 时，会显示"申请编辑权限"按钮而不是创建按钮
  const canCreateLinks = useCheckFolderPermission(
    folderId,
    "folders.links.write",
  );

  // useWorkspaceStore：把"是否已关闭 .link 推广弹窗"持久化到本地（localStorage）
  // 返回 [值, setValue, { loading }]，第三项的 loading 表示 store 初始化中
  // dotLinkOfferDismissed === undefined 表示"还没记录过用户的选择"
  const [dotLinkOfferDismissed, _, { loading: loadingDotLinkOfferDismissed }] =
    useWorkspaceStore<string>("dotLinkOfferDismissed");

  // 本组件内的标记：本次会话是否已经弹过 .link 推广弹窗（避免重复弹）
  const [showedDotLinkModal, setShowedDotLinkModal] = useState(false);
  // .link 推广弹窗：setShowDotLinkOfferModal 控制开关，DotLinkOfferModal 是弹窗本体
  const { setShowDotLinkOfferModal, DotLinkOfferModal } =
    useDotLinkOfferModal();

  useEffect(() => {
    // 本次会话已经弹过就不再弹
    if (showedDotLinkModal) return;

    // 弹出 .link 域名推广弹窗的条件（全部满足才弹）：
    // - URL 里没有 ?upgraded（不是刚升级完跳回来的场景，避免抢焦点）
    // - 有 stripeId 且 plan 非 free（付费用户才有资格领取）
    // - 还没有任何自定义域名（才有推广价值）
    // - 还没领取过 .link 域名（dotLinkClaimed）
    // - 本地没有记录过"已关闭推广"的选择（dotLinkOfferDismissed === undefined）
    // - store 已初始化完成（loadingDotLinkOfferDismissed 为 false）
    if (
      !searchParams.has("upgraded") &&
      workspace.stripeId &&
      workspace.plan &&
      workspace.plan !== "free" &&
      workspace.domains?.length === 0 &&
      !workspace.dotLinkClaimed &&
      !loadingDotLinkOfferDismissed &&
      dotLinkOfferDismissed === undefined
    ) {
      setShowDotLinkOfferModal(true);
      setShowedDotLinkModal(true);
    }
  }, [
    showedDotLinkModal,
    searchParams,
    workspace,
    loadingDotLinkOfferDismissed,
    dotLinkOfferDismissed,
  ]);

  // 这个组件是 /acme/links 页面主体区的“总装配器”
  // 它自己不直接渲染 link 列表细节，而是负责：
  // 1. 组装顶部控制区
  // 2. 挂载弹窗
  // 3. 把真正的列表渲染交给 LinksContainer

  // router / searchParams：处理跳转和 URL 参数
  // useWorkspace / useLinks：拿当前 workspace 和 links 数据
  // useLinkBuilder / useAddEditTagModal：挂载创建链接和标签相关弹窗
  // useLinkFilters：管理筛选条件
  // useFolderPermissions / useCheckFolderPermission：控制是否允许创建 link
  return (
    <>
      {/* 页面相关弹窗和交互层 */}
      {/* Modal 几乎直接说明：这是个弹窗组件 */}
      <DotLinkOfferModal />
      {/* 但 Builder 这种名字在业务里常常表示“构建器/编辑器/表单容器”
        结合这个页面是 links 页面，很容易推断它和“创建/编辑链接”有关 */}
      <LinkBuilder />
      <AddEditTagModal />

      {/* 页面顶部控制区：筛选 / 显示切换 / 搜索 / 更多操作 */}
      <div className="flex w-full items-center">
        <PageWidthWrapper className="flex flex-col gap-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex w-full grow gap-2 md:w-auto">
              {/* 筛选器下拉（mega workspace 不显示，因为它通常是聚合视图） */}
              {!workspace.isMegaWorkspace && (
                <div className="grow basis-0 md:grow-0">
                  <Filter.Select
                    filters={filters}
                    activeFilters={activeFilters}
                    onSelect={onSelect}
                    onRemove={onRemove}
                    onSearchChange={setSearch}
                    onSelectedFilterChange={setSelectedFilter}
                    className="w-full"
                    // emptyState：当某个筛选项下"没有任何可选项"时展示的空状态
                    // tagIds：没有标签 → 引导去创建标签
                    // domain：没有域名 → 引导去添加自定义域名
                    emptyState={{
                      tagIds: (
                        <div className="flex flex-col items-center gap-2 p-2 text-center text-sm">
                          <div className="flex items-center justify-center rounded-2xl border border-neutral-200 bg-neutral-50 p-3">
                            <Tag className="size-6 text-neutral-700" />
                          </div>
                          <p className="mt-2 font-medium text-neutral-950">
                            No tags found
                          </p>
                          <p className="mx-auto mt-1 w-full max-w-[180px] text-neutral-700">
                            Add tags to organize your links
                          </p>
                          <div>
                            <Button
                              className="mt-1 h-8"
                              onClick={() => setShowAddEditTagModal(true)}
                              text="Add tag"
                            />
                          </div>
                        </div>
                      ),
                      domain: (
                        <div className="flex flex-col items-center gap-2 p-2 text-center text-sm">
                          <div className="flex items-center justify-center rounded-2xl border border-neutral-200 bg-neutral-50 p-3">
                            <Globe className="size-6 text-neutral-700" />
                          </div>
                          <p className="mt-2 font-medium text-neutral-950">
                            No domains found
                          </p>
                          <p className="mx-auto mt-1 w-full max-w-[180px] text-neutral-700">
                            Add a custom domain to match your brand
                          </p>
                          <div>
                            <Button
                              className="mt-1 h-8"
                              onClick={() =>
                                router.push(
                                  `/${workspace.slug}/settings/domains`,
                                )
                              }
                              text="Add domain"
                            />
                          </div>
                        </div>
                      ),
                    }}
                  />
                </div>
              )}
              <div className="grow basis-0 md:grow-0">
                {/* LinkDisplay：链接展示方式切换（列表/卡片视图等） */}
                <LinkDisplay />
              </div>
            </div>
            <div className="flex gap-x-2 max-md:w-full">
              <div className="w-full md:w-56 xl:w-64">
                {/* 搜索框：输入关键词搜索链接（loading 态绑定到 links 请求的 isValidating） */}
                <SearchBoxPersisted
                  loading={isValidating}
                  inputClassName="h-10"
                  placeholder={
                    workspace.isMegaWorkspace
                      ? "Search by short link"
                      : "Search by short link or URL"
                  }
                />
              </div>

              {/* 右上角按钮三态：加载中 / 可创建（更多操作）/ 无权限（申请编辑） */}
              {isLoading ? (
                <div className="h-10 w-[2.125rem] animate-pulse rounded-md bg-neutral-200" />
              ) : canCreateLinks ? (
                <MoreLinkOptions />
              ) : (
                <div className="w-fit">
                  {/* 没有写权限时，引导用户向文件夹所有者申请编辑权限 */}
                  <RequestFolderEditAccessButton
                    folderId={folderId!}
                    workspaceId={workspace.id!}
                    variant="primary"
                  />
                </div>
              )}
            </div>
          </div>
          {/* 已激活筛选条件的列表展示（可逐个移除或全部清除） */}
          <Filter.List
            filters={filters}
            activeFilters={activeFilters}
            onSelect={onSelect}
            onRemove={onRemove}
            onRemoveFilter={onRemoveFilter}
            onRemoveAll={onRemoveAll}
          />
        </PageWidthWrapper>
      </div>

      {/* 页面主体内容区：真正的 links 列表与空状态
          LinksContainer 会渲染表格/卡片列表、"No links yet" 空状态等。
          把 CreateLinkButton 传进去：仅当用户有创建权限时才注入按钮，
          否则传一个返回空片段的组件，避免空状态下出现创建按钮。 */}
      <div className="mt-3">
        <LinksContainer
          CreateLinkButton={canCreateLinks ? CreateLinkButton : () => <></>}
        />
      </div>
    </>
  );
}

// MoreLinkOptions
// 右上角的"更多操作"按钮（三点按钮），点开后是一个 Popover 下拉菜单。
// 菜单内容分两块：
//   1. Import Links：从 Bitly / Rebrandly / Short.io / CSV 导入链接
//   2. Export Links：把当前链接导出为 CSV
// 导入的交互方式是往 URL 上写 ?import=xxx 参数，
// 由别的组件/路由监听该参数后再弹出对应的导入流程。
const MoreLinkOptions = () => {
  // useRouterStuff：封装好的 URL query 参数操作工具
  const { queryParams } = useRouterStuff();
  // Popover 的开关状态
  const [openPopover, setOpenPopover] = useState(false);
  // 预留的状态：用于在 Popover 内做"默认视图 / 导入视图"切换（目前未实际使用）
  const [_state, setState] = useState<"default" | "import">("default");
  // 导出链接的弹窗
  const { ExportLinksModal, setShowExportLinksModal } = useExportLinksModal();

  // Popover 关闭时，把内部状态重置回 default，下次打开从初始视图开始
  useEffect(() => {
    if (!openPopover) setState("default");
  }, [openPopover]);

  return (
    <>
      <ExportLinksModal />
      <Popover
        content={
          <div className="w-full md:w-52">
            {/* 第一块：导入链接 */}
            <div className="grid gap-px p-2">
              <p className="mb-1.5 mt-1 flex items-center gap-2 px-1 text-xs font-medium text-neutral-500">
                Import Links
              </p>
              {/* 从 Bitly 导入：写 ?import=bitly，由专门的导入流程接管 */}
              <ImportOption
                onClick={() => {
                  setOpenPopover(false);
                  queryParams({
                    set: {
                      import: "bitly",
                    },
                  });
                }}
              >
                <IconMenu
                  text="Import from Bitly"
                  icon={
                    <img
                      src="https://assets.dub.co/misc/icons/bitly.svg"
                      alt="Bitly logo"
                      className="h-4 w-4"
                    />
                  }
                />
              </ImportOption>
              {/* 从 Rebrandly 导入 */}
              <ImportOption
                onClick={() => {
                  setOpenPopover(false);
                  queryParams({
                    set: {
                      import: "rebrandly",
                    },
                  });
                }}
              >
                <IconMenu
                  text="Import from Rebrandly"
                  icon={
                    <img
                      src="https://assets.dub.co/misc/icons/rebrandly.svg"
                      alt="Rebrandly logo"
                      className="h-4 w-4"
                    />
                  }
                />
              </ImportOption>
              {/* 从 Short.io 导入 */}
              <ImportOption
                onClick={() => {
                  setOpenPopover(false);
                  queryParams({
                    set: {
                      import: "short",
                    },
                  });
                }}
              >
                <IconMenu
                  text="Import from Short.io"
                  icon={
                    <img
                      src="https://assets.dub.co/misc/icons/short.svg"
                      alt="Short.io logo"
                      className="h-4 w-4"
                    />
                  }
                />
              </ImportOption>
              {/* 通过 CSV 文件导入 */}
              <ImportOption
                onClick={() => {
                  setOpenPopover(false);
                  queryParams({
                    set: {
                      import: "csv",
                    },
                  });
                }}
              >
                <IconMenu
                  text="Import from CSV"
                  icon={<TableIcon className="size-4" />}
                />
              </ImportOption>
            </div>
            {/* 分隔线 */}
            <div className="border-t border-neutral-200" />
            {/* 第二块：导出链接 */}
            <div className="grid gap-px p-2">
              <p className="mb-1.5 mt-1 flex items-center gap-2 px-1 text-xs font-medium text-neutral-500">
                Export Links
              </p>
              {/* 导出为 CSV：打开 ExportLinksModal */}
              <button
                onClick={() => {
                  setOpenPopover(false);
                  setShowExportLinksModal(true);
                }}
                className="w-full rounded-md p-2 hover:bg-neutral-100 active:bg-neutral-200"
              >
                <IconMenu
                  text="Export as CSV"
                  icon={<Download className="h-4 w-4" />}
                />
              </button>
            </div>
          </div>
        }
        openPopover={openPopover}
        setOpenPopover={setOpenPopover}
        align="end"
      >
        {/* Popover 触发器：三点按钮 */}
        <Button
          onClick={() => setOpenPopover(!openPopover)}
          variant="secondary"
          className="w-auto px-1.5"
          icon={<ThreeDots className="h-5 w-5 text-neutral-500" />}
        />
      </Popover>
    </>
  );
};

// ImportOption
// 导入选项的通用包装组件：负责"超额时禁用 + 提示升级"的统一处理。
// - 若 workspace 链接数已超额（且不是 enterprise），渲染为禁用态并包一层 Tooltip，
//   提示用户需要升级才能继续创建/导入链接。
// - 否则渲染为正常可点击按钮，点击时执行 onClick（通常是写 ?import=xxx）。
function ImportOption({
  children,
  onClick,
}: {
  children: ReactNode;
  onClick: () => void;
}) {
  const { slug, exceededLinks, plan, nextPlan } = useWorkspace();

  // 超额且非 enterprise：禁用 + 升级提示
  return exceededLinks && plan !== "enterprise" ? (
    <Tooltip
      content={
        <TooltipContent
          title="Your workspace has exceeded its monthly links limit. We're still collecting data on your existing links, but you need to upgrade to create more links."
          cta={nextPlan ? `Upgrade to ${nextPlan.name}` : "Contact support"}
          href={`/${slug}/upgrade`}
        />
      }
    >
      <div className="flex w-full cursor-not-allowed items-center justify-between space-x-2 rounded-md p-2 text-sm text-neutral-400 [&_img]:grayscale">
        {children}
      </div>
    </Tooltip>
  ) : (
    // 未超额：正常按钮，可点击触发导入流程
    <button
      onClick={onClick}
      className="w-full rounded-md p-2 hover:bg-neutral-100 active:bg-neutral-200"
    >
      {children}
    </button>
  );
}
