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
  const router = useRouter();
  const { isValidating } = useLinks();
  const searchParams = useSearchParams();
  const workspace = useWorkspace();
  const { LinkBuilder, CreateLinkButton } = useLinkBuilder();
  const { AddEditTagModal, setShowAddEditTagModal } = useAddEditTagModal();

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

  const { folderId } = useCurrentFolderId();
  const { isLoading } = useFolderPermissions();
  const canCreateLinks = useCheckFolderPermission(
    folderId,
    "folders.links.write",
  );

  const [dotLinkOfferDismissed, _, { loading: loadingDotLinkOfferDismissed }] =
    useWorkspaceStore<string>("dotLinkOfferDismissed");

  const [showedDotLinkModal, setShowedDotLinkModal] = useState(false);
  const { setShowDotLinkOfferModal, DotLinkOfferModal } =
    useDotLinkOfferModal();

  useEffect(() => {
    if (showedDotLinkModal) return;

    // We show the .link offer modal if:
    // - The upgraded modal is not open
    // - The user has a paid plan (and valid stripe ID)
    // - The user has no custom domains
    // - The user has not claimed their .link domain
    // - The user has not dismissed the .link offer modal
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

      {/* 页面顶部控制区 */}
      <div className="flex w-full items-center">
        <PageWidthWrapper className="flex flex-col gap-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex w-full grow gap-2 md:w-auto">
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
                <LinkDisplay />
              </div>
            </div>
            <div className="flex gap-x-2 max-md:w-full">
              <div className="w-full md:w-56 xl:w-64">
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

              {isLoading ? (
                <div className="h-10 w-[2.125rem] animate-pulse rounded-md bg-neutral-200" />
              ) : canCreateLinks ? (
                <MoreLinkOptions />
              ) : (
                <div className="w-fit">
                  <RequestFolderEditAccessButton
                    folderId={folderId!}
                    workspaceId={workspace.id!}
                    variant="primary"
                  />
                </div>
              )}
            </div>
          </div>
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

      {/* 页面主体内容区：真正的 links 列表与空状态 */}
      <div className="mt-3">
        <LinksContainer
          CreateLinkButton={canCreateLinks ? CreateLinkButton : () => <></>}
        />
      </div>
    </>
  );
}

const MoreLinkOptions = () => {
  const { queryParams } = useRouterStuff();
  const [openPopover, setOpenPopover] = useState(false);
  const [_state, setState] = useState<"default" | "import">("default");
  const { ExportLinksModal, setShowExportLinksModal } = useExportLinksModal();

  useEffect(() => {
    if (!openPopover) setState("default");
  }, [openPopover]);

  return (
    <>
      <ExportLinksModal />
      <Popover
        content={
          <div className="w-full md:w-52">
            <div className="grid gap-px p-2">
              <p className="mb-1.5 mt-1 flex items-center gap-2 px-1 text-xs font-medium text-neutral-500">
                Import Links
              </p>
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
            <div className="border-t border-neutral-200" />
            <div className="grid gap-px p-2">
              <p className="mb-1.5 mt-1 flex items-center gap-2 px-1 text-xs font-medium text-neutral-500">
                Export Links
              </p>
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

function ImportOption({
  children,
  onClick,
}: {
  children: ReactNode;
  onClick: () => void;
}) {
  const { slug, exceededLinks, plan, nextPlan } = useWorkspace();

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
    <button
      onClick={onClick}
      className="w-full rounded-md p-2 hover:bg-neutral-100 active:bg-neutral-200"
    >
      {children}
    </button>
  );
}
