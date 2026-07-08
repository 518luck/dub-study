/*
 * ============================================================
 * FolderDropdown —— 文件夹下拉切换器
 * ============================================================
 *
 * 这个组件就是 /links 页面顶部那个「All Links ▾ / Marketing ▾」下拉框。
 * 用户通过它：
 *   1. 切换查看哪个文件夹下的链接
 *   2. 搜索文件夹（文件夹多了就走后端异步搜索）
 *   3. 创建新文件夹（列表底部那项）
 *   4. 跳到「文件夹管理页」（View All）
 *
 * 底层用 Combobox 组件（@dub/ui），它是个「可搜索的下拉选择」。
 * 这个组件本身是个「受控/半受控」组件：
 *   - 不传 selectedFolderId 时，自己读 URL 里的 folderId 决定选中谁
 *   - 传了 selectedFolderId 时，完全由外部控制（用在弹窗/表单里）
 *
 * 整体数据流：
 *   URL ?folderId  →  useFolder 拉详情  →  选中态  →  Combobox 展示
 *        ↑                                              ↓ 用户选
 *        └────────── queryParams 改 URL ←─── onSelect 回调
 */
"use client";

import { unsortedLinks } from "@/lib/folder/constants";
import { getPlanCapabilities } from "@/lib/plan-capabilities";
import useCurrentFolderId from "@/lib/swr/use-current-folder-id";
import useFolder from "@/lib/swr/use-folder";
import useFolders from "@/lib/swr/use-folders";
import useLinksCount from "@/lib/swr/use-links-count";
import useWorkspace from "@/lib/swr/use-workspace";
import { FolderLinkCount, FolderSummary } from "@/lib/types";
import { FOLDERS_MAX_PAGE_SIZE } from "@/lib/zod/schemas/folders";
import { Button, Combobox, TooltipContent, useRouterStuff } from "@dub/ui";
import { cn, nFormatter } from "@dub/utils";
import { ChevronsUpDown } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ReactNode, useEffect, useMemo, useState } from "react";
import { useDebounce } from "use-debounce";
import { useAddFolderModal } from "../modals/add-folder-modal";
import { FolderIcon } from "./folder-icon";

/*
 * Props 设计：这个组件要在两种场景下复用
 * ------------------------------------------------------------
 * 场景 A：/links 页面顶部（inline 内联）
 *   - 自己读 URL 决定选中谁，选中后改 URL
 *   - 是个「页面级」的导航控件
 *
 * 场景 B：弹窗/表单里（input 输入框样式）
 *   - 外部通过 selectedFolderId / onFolderSelect 控制
 *   - 不碰 URL，只把选中的文件夹传出去
 *
 * variant 用来切这两种样式：
 *   - "inline"：无边框、透明背景，像页面标题一样融入页面
 *   - "input" ：带边框，像个 input 控件
 */
interface FolderDropdownProps {
  variant?: "inline" | "input";
  onFolderSelect?: (folder: FolderSummary) => void;
  hideViewAll?: boolean;
  hideFolderIcon?: boolean;
  buttonClassName?: string;
  buttonTextClassName?: string;
  iconClassName?: string;
  // 创建文件夹成功后，要不要自动跳转过去（弹窗场景通常不要跳转）
  disableAutoRedirect?: boolean;
  // 外部受控：传了就听外面的，不传就读 URL
  selectedFolderId?: string;
  loadingPlaceholder?: ReactNode;
}

export const FolderDropdown = ({
  variant = "inline",
  onFolderSelect,
  hideViewAll = false,
  hideFolderIcon = false,
  buttonClassName,
  buttonTextClassName,
  iconClassName,
  disableAutoRedirect = false,
  selectedFolderId,
  loadingPlaceholder,
}: FolderDropdownProps) => {
  const router = useRouter();
  const { slug, plan, defaultFolderId } = useWorkspace();
  const { queryParams } = useRouterStuff();

  /*
   * 搜索：本地输入 + 防抖
   * ------------------------------------------------------------
   * search         —— 用户实时敲的字（每次按键都变）
   * debouncedSearch—— 防抖后的字（停顿 500ms 才更新）
   *
   * 为什么要防抖？因为下面异步搜索时要打后端，
   * 不能用户每敲一个字母就发一次请求，要等他「停下来」再发。
   */
  const [search, setSearch] = useState("");
  const [debouncedSearch] = useDebounce(search, 500);

  // 是否走后端异步搜索（文件夹多的时候才开启，见下面的 useEffect）
  const [useAsync, setUseAsync] = useState(false);

  /*
   * 拉文件夹列表
   * ------------------------------------------------------------
   * useAsync=false 时：不传 search，一次性拉全量（文件夹少时）
   * useAsync=true  时：传 debouncedSearch，走后端搜索（文件夹多时）
   *
   * keepPreviousData：切换搜索词时，先保留上一批数据不闪屏，
   *                   等新数据回来再替换（SWR 的一个优化选项）。
   */
  const { folders, loading } = useFolders({
    query: useAsync ? { search: debouncedSearch } : undefined,
    options: {
      keepPreviousData: true,
    },
  });

  /*
   * 智能切换：本地过滤 vs 后端搜索
   * ------------------------------------------------------------
   * 文件夹数量超过 FOLDERS_MAX_PAGE_SIZE（一页上限）时，
   * 说明一次性拉不全了，必须改成「按搜索词异步拉」。
   * 这是个性能优化：少的时候前端过滤又快又简单，多的时候只能上后端。
   */
  useEffect(() => {
    if (folders && !useAsync && folders.length >= FOLDERS_MAX_PAGE_SIZE)
      setUseAsync(true);
  }, [folders, useAsync]);

  /*
   * 统计每个文件夹下有多少链接
   * ------------------------------------------------------------
   * 后端按 folderId 分组 (groupBy) 返回每个文件夹的链接计数。
   * ignoreParams: true 表示忽略 URL 上其它筛选条件，
   *               要的是「这个文件夹总共有多少链接」，不是「筛选后的」。
   *
   * 返回类似：[{ folderId: "abc", _count: 42 }, { folderId: null, _count: 8 }]
   * folderId 为 null 的就是「未分组」的链接数。
   */
  const { data: folderLinksCount } = useLinksCount<FolderLinkCount[]>({
    query: {
      groupBy: "folderId",
    },
    ignoreParams: true,
  });

  const [openPopover, setOpenPopover] = useState(false);

  // 当前选中的文件夹（本地状态），默认是「未分组」那个虚拟文件夹
  const [selectedFolder, setSelectedFolder] = useState<FolderSummary | null>(
    unsortedLinks,
  );

  // 读 URL 上的 folderId（仅 inline 场景用）
  const { folderId: currentFolderId } = useCurrentFolderId();
  // 优先用外部传的 selectedFolderId，没有才读 URL —— 这就是「受控优先」
  const folderId = selectedFolderId || currentFolderId;

  // 拉选中文件夹的详情（拿到名字、图标、权限等）
  const { folder: selectedFolderData } = useFolder({
    folderId,
    enabled: !!folderId,
  });

  /*
   * 创建文件夹弹窗
   * ------------------------------------------------------------
   * useAddFolderModal 返回 [弹窗组件, 控制函数]。
   * onSuccess：创建成功后的回调——
   *   1. 更新本地选中态
   *   2. 通知外部（onFolderSelect）
   *   3. 默认自动跳转到新文件夹（除非 disableAutoRedirect）
   *
   * 注意跳转逻辑：
   *   folderId && folderId !== "unsorted" —— 当前已经在某个文件夹里，
   *   新建的也放进去；否则跳到新文件夹的 ?folderId。
   *   这块有点绕，大意是「在哪个上下文创建，就留在哪个上下文」。
   */
  const { AddFolderModal, setShowAddFolderModal } = useAddFolderModal({
    onSuccess: (folder) => {
      setSelectedFolder(folder);
      onFolderSelect?.(folder);

      if (!disableAutoRedirect) {
        router.push(
          `/${slug}/links${folderId && folderId !== "unsorted" ? `?folderId=${folder.id}` : ""}`,
        );
      }
    },
  });

  /*
   * 同步选中态：URL/外部 folderId 变了，本地选中要跟着变
   * ------------------------------------------------------------
   * 这是「URL 是真源」的体现。当 folderId 变化（比如用户直接改了地址栏，
   * 或者点浏览器前进后退），这里要把 selectedFolder 校准回去。
   *
   * 两种情况：
   *   1. folderId 有对应详情数据 → 选中它
   *   2. folderId 为空 / 是 "unsorted" → 选中虚拟的「未分组」
   */
  // Update selected folder when folderId changes and selectedFolderData is available
  useEffect(() => {
    if (selectedFolderData && folderId === selectedFolderData.id) {
      setSelectedFolder(selectedFolderData);
      onFolderSelect?.(selectedFolderData);
    } else if (!folderId || folderId === "unsorted") {
      setSelectedFolder(unsortedLinks);
      onFolderSelect?.(unsortedLinks);
    }
  }, [folderId, selectedFolderData]);

  // 当前套餐能不能新建文件夹（文件夹是 Pro 及以上才有）
  const { canAddFolder } = getPlanCapabilities(plan);

  /*
   * 构造 Combobox 的 options 列表
   * ------------------------------------------------------------
   * 这是个 useMemo，依赖 folders / selectedFolderData 等变化才重算。
   *
   * 列表内容（从上到下）：
   *   1. 「未分组」(unsortedLinks) —— 永远在第一个
   *   2. 后端返回的 folders
   *   3. 当前选中的文件夹（兜底：防止它没出现在 folders 列表里时消失）
   *   4. 「Create new folder」—— 列表底部，特殊项 value="create"
   *
   * 每个 option 的结构：
   *   value —— 唯一标识（文件夹 id）
   *   label —— 显示名
   *   icon  —— 左侧图标
   *   meta  —— 附带原始数据（下面要用：选中时取出来用）
   *            还算出 linksCount 塞进去（显示「42」那个数字）
   *   first —— 是否排第一（给 unsorted 用，可能有特殊样式）
   *
   * 「Create new folder」特殊处理：
   *   如果套餐不支持，挂一个 disabledTooltip，悬停时提示「升级到 Pro」。
   *
   * 顺手 prefetch：folderId 有值时预加载对应页面，用户真点过去时秒开。
   */
  const folderOptions = useMemo(() => {
    const allFolders = [
      unsortedLinks,
      ...(folders || []),
      // 兜底：当前选中项如果不在列表里（比如搜索被过滤了），强制补上
      ...(selectedFolderData &&
      !debouncedSearch &&
      !folders?.find(({ id }) => id === selectedFolderData.id)
        ? [selectedFolderData]
        : []),
    ];
    if (folderId) {
      router.prefetch(`/${slug}/links?folderId=${folderId}`);
    }

    return [
      ...allFolders.map((folder) => ({
        value: folder.id,
        label: folder.name,
        icon: <FolderIcon className="mr-1" folder={folder} shape="square" />,
        meta: {
          ...folder,
          // 把每个文件夹的链接数算出来塞进 meta
          linksCount:
            folderLinksCount?.find(
              ({ folderId }) =>
                folderId === folder.id ||
                // 「未分组」对应的 folderId 是 null
                (folder.id === "unsorted" && folderId === null),
            )?._count || 0,
        },
        first: folder.id === "unsorted",
      })),
      {
        value: "create",
        label: "Create new folder",
        icon: (
          <FolderIcon
            className="mr-1"
            folder={{ id: "new", accessLevel: null }}
            shape="square"
          />
        ),
        // 套餐不支持时，悬停显示「升级」提示
        disabledTooltip: !canAddFolder ? (
          <TooltipContent
            title="You can only use Link Folders on a Pro plan and above. Upgrade to Pro to continue."
            cta="Upgrade to Pro"
            href={`/${slug}/upgrade`}
          />
        ) : undefined,
      },
    ];
  }, [folders, selectedFolderData, canAddFolder, slug, debouncedSearch]);

  /*
   * 当前选中项（给 Combobox 显示用）
   * ------------------------------------------------------------
   * 把 selectedFolder 转成 Combobox 需要的 {value,label,icon,meta} 格式。
   * Combobox 拿它来渲染触发按钮上显示的内容（当前文件夹名+图标）。
   */
  const selectedOption = useMemo(() => {
    if (!selectedFolder) return null;
    return {
      value: selectedFolder.id,
      label: selectedFolder.name,
      icon: (
        <FolderIcon className="mr-1" folder={selectedFolder} shape="square" />
      ),
      meta: selectedFolder,
    };
  }, [selectedFolder]);

  // 加载态：有 folderId 但详情还没回来 → 显示骨架占位
  if (folderId && folderId !== "unsorted" && !selectedFolderData) {
    return loadingPlaceholder ?? <FolderDropdownPlaceholder />;
  }

  return (
    <>
      <AddFolderModal />
      <Combobox
        selected={selectedOption}
        /*
         * 选中某项时的处理 —— 这里是整个组件的「动作核心」
         * ------------------------------------------------------------
         * 分两种值：
         *   value === "create"：打开新建文件夹弹窗，不改变当前选中
         *   其它：切换选中文件夹
         *
         * 切换文件夹时：
         *   - 如果外部传了 onFolderSelect → 只回调通知，不改 URL（受控模式）
         *   - 否则 → 改 URL 的 folderId 参数（非受控模式，URL 驱动）
         *
         * URL 处理的细节：
         *   选「未分组」且 workspace 没设默认文件夹 → 删掉 folderId 参数
         *   其它情况 → set folderId
         *   （因为有些 workspace 把某个文件夹设成「默认主页」，
         *    那 unsorted 也要用 folderId 表示，不能直接删）
         */
        setSelected={(option) => {
          if (option?.value === "create") {
            setShowAddFolderModal(true);
            return;
          }

          const folder = option?.meta;
          if (folder) {
            setSelectedFolder(folder);
            onFolderSelect
              ? onFolderSelect(folder)
              : queryParams({
                  ...(folder.id === "unsorted" && !defaultFolderId
                    ? { del: "folderId" }
                    : { set: { folderId: folder.id } }),
                });
          }
        }}
        // 顶部右侧的「View All」按钮 → 跳到文件夹管理设置页
        inputRight={
          hideViewAll ? undefined : (
            <Link
              href={`/${slug}/settings/library/folders`}
              onClick={() => setOpenPopover(false)}
              className="rounded-md border border-neutral-200 px-2 py-1 text-xs transition-colors hover:bg-neutral-100"
            >
              View All
            </Link>
          )
        }
        options={loading ? undefined : folderOptions}
        /*
         * 触发按钮左侧的图标
         * ------------------------------------------------------------
         * 两种情况隐藏：
         *   1. 当前是「未分组」且 hideFolderIcon=true（page-client 里就这么用，
         *      那里不想显示「未分组」的文件夹图标）
         *   2. 没有选中文件夹
         * md:block：只在桌面显示，移动端省空间
         */
        icon={
          !(selectedFolder?.id === "unsorted" && hideFolderIcon) &&
          selectedFolder ? (
            <FolderIcon
              folder={selectedFolder}
              shape="square"
              className="hidden md:block"
              iconClassName={iconClassName}
            />
          ) : undefined
        }
        // 每个选项右侧的小数字：该文件夹里有多少链接
        optionRight={(option) =>
          option.meta && option.meta.linksCount ? (
            <span className="text-xs text-neutral-500">
              {option.meta.type === "mega"
                ? "10,000+" // mega workspace 太多，显示上限
                : nFormatter(option.meta.linksCount, { full: true })}
            </span>
          ) : undefined
        }
        caret={
          <ChevronsUpDown className="ml-2 size-4 shrink-0 text-neutral-400" />
        }
        buttonProps={{
          className: cn(
            "group flex items-center gap-2 rounded-lg px-2 py-1 w-fit",
            // inline 样式：去边框、去聚焦环、透明背景 —— 融入页面像标题
            variant === "inline" && "border-none !ring-0 bg-transparent",
            "transition-all hover:bg-neutral-100 active:bg-neutral-200 data-[state=open]:bg-neutral-100",
            buttonClassName,
          ),
          textWrapperClassName: cn(
            "min-w-0 truncate text-left text-lg font-semibold leading-7 text-content-emphasis",
            buttonTextClassName,
          ),
        }}
        optionClassName="md:min-w-[250px]"
        searchPlaceholder="Search folders..."
        // input 变体下，下拉宽度匹配触发器宽度；inline 下自适应
        matchTriggerWidth={variant === "input"}
        /*
         * 空状态：搜不到任何文件夹
         * ------------------------------------------------------------
         * 显示「No folders found」+ 一个「Create folder」按钮，
         * 把「搜不到」转化成「要不要新建一个」——很贴心的引导。
         * 同样处理套餐限制（disabledTooltip）。
         */
        emptyState={
          <div className="flex w-full flex-col items-center gap-2 py-4">
            No folders found
            <Button
              onClick={() => {
                setOpenPopover(false);
                setShowAddFolderModal(true);
              }}
              variant="primary"
              className="h-7 w-fit px-2"
              disabledTooltip={
                !canAddFolder ? (
                  <TooltipContent
                    title="You can only use Link Folders on a Pro plan and above. Upgrade to Pro to continue."
                    cta="Upgrade to Pro"
                    href={`/${slug}/upgrade`}
                  />
                ) : undefined
              }
              text="Create folder"
            />
          </div>
        }
        open={openPopover}
        onOpenChange={setOpenPopover}
        /*
         * shouldFilter：Combobox 自己要不要在前端做过滤
         * ------------------------------------------------------------
         * !useAsync = 文件夹少 → 前端过滤（cmdk 原生的 fuzzy 搜索）
         * useAsync  = 文件夹多 → 关掉前端过滤，结果完全由后端搜索决定
         *             （否则前端会再把后端的结果过滤一遍，导致丢数据）
         */
        shouldFilter={!useAsync}
        onSearchChange={setSearch}
      >
        {/* children = 触发按钮显示的文字，没选中时显示 "Links" */}
        {selectedFolder ? selectedFolder.name : "Links"}
      </Combobox>
    </>
  );
};

/*
 * 骨架占位：数据加载中时显示的灰色块
 * animate-pulse 让它有「呼吸」动画，是 loading 的常见视觉语言。
 */
const FolderDropdownPlaceholder = () => {
  return <div className="h-10 w-40 animate-pulse rounded-lg bg-neutral-200" />;
};
