import {
  AnimatedSizeContainer,
  ArrowUpRight2,
  BookOpen,
  ChevronLeft,
  ClientOnly,
  Icon,
  Lock,
  NavWordmark,
  Tooltip,
  useScrollProgress,
} from "@dub/ui";
import { cn } from "@dub/utils";
import { ChevronDown } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ComponentType,
  CSSProperties,
  PropsWithChildren,
  ReactNode,
  Suspense,
  useMemo,
  useRef,
  useState,
} from "react";
import { UserDropdown } from "./user-dropdown";

export type NavItemCommon = {
  name: string;
  href: `/${string}`;
  exact?: boolean;
  isActive?: (pathname: string, href: string) => boolean;
  badge?: ReactNode;
  arrow?: boolean;
  locked?: boolean;
};

export type NavSubItemType = NavItemCommon;

export type NavItemType = NavItemCommon & {
  icon: Icon;
  items?: NavSubItemType[];
};

export type NavGroupType = {
  name: string;
  icon: Icon;
  href: string;
  active: boolean;
  onClick?: () => void;
  popup?: ComponentType<{
    referenceElement: HTMLElement | null;
  }>;
  badge?: ReactNode;

  description: string;
  learnMoreHref?: string;
};

export type SidebarNavGroups<T extends Record<any, any>> = (
  args: T,
) => NavGroupType[];

export type SidebarNavAreas<T extends Record<any, any>> = Record<
  string,
  (args: T) => {
    title?: string | ReactNode;
    backHref?: string;
    showNews?: boolean; // show news segment – TODO: enable this for Partner Program too
    hideSwitcherIcons?: boolean; // hide workspace switcher + product icons for this area
    direction?: "left" | "right";
    content: {
      name?: string;
      items: NavItemType[];
    }[];
  }
>;

const SIDEBAR_WIDTH = 304;
const SIDEBAR_GROUPS_WIDTH = 64;
const SIDEBAR_AREAS_WIDTH = SIDEBAR_WIDTH - SIDEBAR_GROUPS_WIDTH;

// sidebar = 侧边栏 | nav = 导航
export function SidebarNav<T extends Record<any, any>>({
  groups, // 组
  areas, // 区域
  currentArea, // 当前区域
  data, // 数据
  toolContent, // 工具内容
  newsContent, // 新闻内容
  switcher, // 切换器
  bottom, // 底部
}: {
  groups: SidebarNavGroups<T>;
  areas: SidebarNavAreas<T>;
  currentArea: string | null;
  data: T;
  toolContent?: ReactNode;
  newsContent?: ReactNode;
  switcher?: ReactNode;
  bottom?: ReactNode;
}) {
  return (
    <div
      className={cn(
        "h-full w-[var(--sidebar-width)] transition-[width] duration-300",
      )}
      style={
        {
          "--sidebar-width": `${currentArea === null ? SIDEBAR_GROUPS_WIDTH : SIDEBAR_WIDTH}px`,
          "--sidebar-groups-width": `${SIDEBAR_GROUPS_WIDTH}px`,
          "--sidebar-areas-width": `${SIDEBAR_AREAS_WIDTH}px`,
        } as CSSProperties
      }
    >
      <ClientOnly className="size-full">
        <nav className="grid size-full grid-cols-[var(--sidebar-groups-width)_1fr]">
          {/* 左侧主导航区 */}
          <div className="flex flex-col items-center justify-between">
            {/* 左侧顶部 */}
            <div className="flex flex-col items-center p-2">
              <div className="pb-1 pt-2">
                <Link
                  href="/"
                  className="block overflow-visible rounded-lg px-1 py-4 outline-none transition-opacity focus-visible:ring-2 focus-visible:ring-black/50"
                >
                  <NavWordmark className="h-5 overflow-visible" isInApp />
                </Link>
              </div>
              {/* 没有 currentArea 或 当前 area 没有设置 hideSwitcherIcons → 显示
              switcher 和 groups 图标 */}
              {/* 控制“左侧主导航图标区”要不要显示，并把 switcher 和多个 NavGroupItem 竖着渲染出来。 */}
              {(!currentArea ||
                !areas[currentArea](data).hideSwitcherIcons) && (
                <div className="flex flex-col gap-3">
                  {switcher}
                  {groups(data).map((group) => (
                    <NavGroupItem key={group.name} group={group} />
                  ))}
                </div>
              )}
            </div>
            {/* 左侧底部 */}
            <div className="flex flex-col items-center gap-3 py-3">
              <Suspense fallback={null}>{toolContent}</Suspense>
              <div className="flex size-12 items-center justify-center">
                <UserDropdown />
              </div>
            </div>
          </div>
          {/* 右侧区域内容区 */}
          <div
            className={cn(
              "size-full overflow-hidden py-2 pr-2 transition-opacity duration-300",
              currentArea === null && "opacity-0",
            )}
          >
            <SidebarAreasPanel
              areas={areas}
              data={data}
              currentArea={currentArea}
              newsContent={newsContent}
              bottom={bottom}
            />
          </div>
        </nav>
      </ClientOnly>
    </div>
  );
}
// areas = 区域 | panel = 面板
// 右侧菜单面板：负责渲染当前区域的标题、菜单分组、滚动遮罩和底部固定内容。
function SidebarAreasPanel<T extends Record<any, any>>({
  areas,
  data,
  currentArea,
  newsContent,
  bottom,
}: {
  areas: SidebarNavAreas<T>;
  data: T;
  currentArea: string | null;
  newsContent?: ReactNode;
  bottom?: ReactNode;
}) {
  // 右侧菜单滚动容器，用来计算滚动进度并控制底部渐变遮罩透明度。
  const scrollRef = useRef<HTMLDivElement>(null);
  const { scrollProgress, updateScrollProgress } = useScrollProgress(scrollRef);

  // 当前 area 配置了 showNews 时，右侧底部才显示 newsContent。
  const showNews = currentArea && areas[currentArea]?.(data).showNews;

  // 菜单项数量超过阈值时，右侧菜单区开启纵向滚动并显示底部渐变提示。
  const hasOverflow = useMemo(() => {
    if (!currentArea) return false;
    const { content } = areas[currentArea](data);
    const totalItems = content.flatMap((c) => c.items).length;
    return totalItems > 10;
  }, [currentArea, areas, data]);

  return (
    // 右侧 area 外层：固定为右侧菜单栏宽度，使用圆角浅灰背景。
    <div className="flex h-full w-[calc(var(--sidebar-areas-width)-0.5rem)] flex-col rounded-xl bg-neutral-100">
      {/* 右侧上半部分：可滚动菜单内容区，底部会按需叠加渐变遮罩。 */}
      <div className="relative min-h-0 flex-1 overflow-hidden">
        {/* 真正的滚动容器：菜单很多时允许纵向滚动，否则隐藏滚动。 */}
        <div
          ref={scrollRef}
          onScroll={updateScrollProgress}
          className={cn(
            "scrollbar-hide h-full overflow-x-hidden rounded-xl",
            hasOverflow ? "overflow-y-auto" : "overflow-hidden",
          )}
        >
          {/* 菜单内容内边距和默认文字颜色。 */}
          <div className="relative flex flex-col p-3 text-neutral-500">
            {/* 所有 area 都放在这个相对定位容器里，Area 组件负责只显示当前 area。 */}
            <div className="relative w-full grow">
              {Object.entries(areas).map(([area, areaConfig]) => {
                // area 是区域 key，例如 default / program / workspaceSettings。
                // areaConfig(data) 会用运行时 data 生成该区域的标题和菜单内容。
                const { title, backHref, content, direction } =
                  areaConfig(data);

                // 如果有 backHref，标题区就是可点击返回链接；否则只是普通容器。
                const TitleContainer = backHref ? Link : "div";

                return (
                  <Area
                    key={area}
                    visible={area === currentArea}
                    direction={direction ?? "right"}
                  >
                    {/* 区域标题区：支持字符串标题，也支持传入自定义 ReactNode。 */}
                    {title &&
                      (typeof title === "string" ? (
                        <TitleContainer
                          href={backHref ?? "#"}
                          className="group mb-2 flex items-center gap-3 px-3 py-2"
                        >
                          {/* 有 backHref 时显示左箭头，表示可以返回上一级/默认区域。 */}
                          {backHref && (
                            <div
                              className={cn(
                                "text-content-muted bg-bg-emphasis flex size-6 items-center justify-center rounded-lg",
                                "group-hover:bg-bg-inverted/10 group-hover:text-content-subtle transition-[transform,background-color,color] duration-150 group-hover:-translate-x-0.5",
                              )}
                            >
                              <ChevronLeft className="size-3 [&_*]:stroke-2" />
                            </div>
                          )}
                          <span className="text-content-emphasis text-lg font-semibold">
                            {title}
                          </span>
                        </TitleContainer>
                      ) : (
                        title
                      ))}
                    {/* 菜单分组区：content 是若干组，每组有可选分组名和一组菜单项。 */}
                    <div className="flex flex-col gap-8">
                      {content.map(({ name, items }, idx) => (
                        <div key={idx} className="flex flex-col gap-0.5">
                          {/* 分组标题，例如 Insights / Library / Developer。 */}
                          {name && (
                            <div className="mb-2 pl-3 text-sm text-neutral-500">
                              {name}
                            </div>
                          )}
                          {/* 当前分组下的具体菜单项。 */}
                          {items.map((item) => (
                            <NavItem key={item.name} item={item} />
                          ))}
                        </div>
                      ))}
                    </div>
                  </Area>
                );
              })}
            </div>
          </div>
        </div>
        {/* 底部滚动渐变遮罩：只有菜单溢出产生滚动时才显示。 */}
        {hasOverflow && (
          <div
            className="pointer-events-none absolute bottom-0 left-0 z-10 h-16 w-full rounded-b-lg bg-gradient-to-t from-neutral-100 to-transparent"
            style={{ opacity: 1 - Math.pow(scrollProgress, 2) }}
          />
        )}
      </div>

      {/* 右侧底部固定区：不参与上方菜单滚动，始终贴在面板底部。 */}
      <div className="flex flex-shrink-0 flex-col gap-2 rounded-b-xl">
        {/* Conversion Tracking 引导：只在 data.showConversionGuides 为 true 时展示。 */}
        {data.showConversionGuides && (
          <div className="px-3 pb-2">
            <Link
              href={`/${data.slug}/settings/tracking`}
              className="flex items-center gap-2 rounded-lg bg-neutral-200/75 px-2.5 py-2 text-xs text-neutral-700 transition-colors hover:bg-neutral-200"
            >
              <BookOpen className="size-4" />
              Set up conversion tracking
            </Link>
          </div>
        )}

        {/* News / Usage 区：由当前 area 的 showNews 和外部传入的 newsContent 共同控制。 */}
        <AnimatePresence>
          {showNews && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              transition={{
                duration: 0.1,
                ease: "easeInOut",
              }}
            >
              {newsContent}
            </motion.div>
          )}
        </AnimatePresence>

        {/* 额外底部插槽：调用方可以传入自定义底部内容。 */}
        {bottom && <div className="flex flex-col">{bottom}</div>}
      </div>
    </div>
  );
}

// tooltip = 工具提示 | group = 分组 | nav = 导航
// 左侧一级图标 Tooltip：悬停图标时展示名称，延迟后展开描述和 learn more 链接。
export function NavGroupTooltip({
  name,
  description,
  learnMoreHref,
  disabled,
  children,
}: PropsWithChildren<{
  name: string;
  description?: string;
  learnMoreHref?: string;
  disabled?: boolean;
}>) {
  return (
    // Tooltip 显示在图标右侧；disabled 为 true 时完全不显示。
    <Tooltip
      side="right"
      delayDuration={100}
      disabled={disabled}
      className="rounded-lg bg-black px-3 py-1.5 text-sm font-medium text-white"
      content={
        <div>
          {/* Tooltip 主标题。 */}
          <span>{name}</span>
          {/* Tooltip 详情区：只有 description 存在才展示，并使用 motion 做延迟展开动画。 */}
          {description && (
            <motion.div
              initial={{ opacity: 0, width: 0, height: 0 }}
              animate={{ opacity: 1, width: "auto", height: "auto" }}
              transition={{ delay: 0.5, duration: 0.25, type: "spring" }}
              className="overflow-hidden"
            >
              <div className="w-44 py-1 text-xs tracking-tight">
                <p className="text-content-muted">{description}</p>
                {/* 可选的外部学习链接。 */}
                {learnMoreHref && (
                  <div className="mt-2.5">
                    <Link
                      href={learnMoreHref}
                      target="_blank"
                      className="font-semibold text-white underline"
                    >
                      Learn more
                    </Link>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </div>
      }
    >
      {children}
    </Tooltip>
  );
}

// item = 项目
// 左侧窄栏的一级入口按钮：例如 Short Links / Partner Program 这种大区域入口。
function NavGroupItem({
  group: {
    name,
    description,
    learnMoreHref,
    icon: Icon,
    href,
    active,
    badge,
    onClick,
    popup: Popup,
  },
}: {
  group: NavGroupType;
}) {
  // element 是可选 Popup 的定位锚点，只有配置 popup 的入口才需要记录。
  const [element, setElement] = useState<HTMLAnchorElement | null>(null);

  // hovered 会透传给 Icon，部分自定义图标会根据 data-hovered 做动画。
  const [hovered, setHovered] = useState(false);

  return (
    <>
      {/* 图标按钮外层包 Tooltip：悬停时显示入口名称、说明和学习链接。 */}
      <NavGroupTooltip
        name={name}
        description={description}
        learnMoreHref={learnMoreHref}
      >
        <div>
          {/* 真正的一级入口链接：点击后跳到该大区域对应的 href。 */}
          <Link
            ref={Popup ? setElement : undefined}
            href={href}
            onPointerEnter={() => setHovered(true)}
            onPointerLeave={() => setHovered(false)}
            onClick={onClick}
            className={cn(
              "relative flex size-11 items-center justify-center rounded-lg transition-colors duration-150",
              "outline-none focus-visible:ring-2 focus-visible:ring-black/50",
              active
                ? "bg-white"
                : "hover:bg-bg-inverted/5 active:bg-bg-inverted/10",
            )}
          >
            <Icon
              className="text-content-default size-5"
              data-hovered={hovered}
            />
            {/* 右上角 badge：用于展示未读数、New 标记等。 */}
            {badge && (
              <div className="absolute right-0.5 top-0.5 flex size-3.5 items-center justify-center rounded-full bg-blue-600 text-[0.625rem] font-semibold text-white">
                {badge}
              </div>
            )}
          </Link>
        </div>
      </NavGroupTooltip>
      {/* 可选弹层：例如某个一级入口需要在图标旁展示额外说明或引导。 */}
      {Popup && element && <Popup referenceElement={element} />}
    </>
  );
}

// 右侧菜单项：同时支持普通菜单项和带 items 的可展开父菜单项。
function NavItem({ item }: { item: NavItemType | NavSubItemType }) {
  const { name, href, exact, isActive: customIsActive, locked } = item;

  // 子菜单项可能没有 icon/items，所以这里用 "in" 做类型判断。
  const Icon = "icon" in item ? item.icon : undefined;
  const items = "items" in item ? item.items : undefined;

  // hovered 会透传给 Icon，用于图标 hover 动画。
  const [hovered, setHovered] = useState(false);

  const pathname = usePathname();

  // 默认根据当前 pathname 和 href 判断是否高亮；如果传入 customIsActive 就使用自定义逻辑。
  const isActive = useMemo(() => {
    if (customIsActive) {
      return customIsActive(pathname, href);
    }

    const hrefWithoutQuery = href.split("?")[0];
    return exact
      ? pathname === hrefWithoutQuery
      : pathname.startsWith(hrefWithoutQuery);
  }, [pathname, href, exact, customIsActive]);

  return (
    <div>
      {/* 单个菜单链接：处理跳转、高亮、禁用、hover 和右侧附加标记。 */}
      <Link
        href={locked ? "#" : href}
        data-active={isActive}
        onPointerEnter={() => !locked && setHovered(true)}
        onPointerLeave={() => !locked && setHovered(false)}
        className={cn(
          "text-content-default group flex h-8 items-center justify-between rounded-lg p-2 text-sm leading-none transition-[background-color,color,font-weight] duration-75",
          "outline-none focus-visible:ring-2 focus-visible:ring-black/50",
          isActive && !items
            ? "bg-blue-100/50 font-medium text-blue-600 hover:bg-blue-100/80 active:bg-blue-100"
            : locked
              ? "cursor-not-allowed opacity-75"
              : "hover:bg-bg-inverted/5 active:bg-bg-inverted/10",
        )}
        aria-disabled={locked}
      >
        {/* 菜单左侧：锁图标或菜单图标 + 菜单名称。 */}
        <span className="flex items-center gap-2.5">
          {locked ? (
            <Lock className="size-4" />
          ) : (
            Icon && (
              <Icon
                className={cn(
                  "size-4",
                  !items && "group-data-[active=true]:text-blue-600",
                )}
                data-hovered={hovered}
              />
            )
          )}
          {name}
        </span>
        {/* 菜单右侧：badge、子菜单展开箭头、外跳箭头。 */}
        <span className="ml-2 flex items-center gap-2">
          {"badge" in item && item.badge && (
            <span
              className={cn(
                "flex items-center justify-center rounded px-1.5 py-0.5 text-xs font-semibold",
                isActive && !items
                  ? "bg-blue-600 text-white"
                  : "bg-blue-100 text-blue-600",
              )}
            >
              {item.badge}
            </span>
          )}
          {items && (
            <ChevronDown className="size-3.5 text-neutral-500 transition-transform duration-75 group-data-[active=true]:rotate-180" />
          )}
          {item.arrow && (
            <ArrowUpRight2 className="text-content-default size-3.5 transition-transform duration-75 group-hover:-translate-y-px group-hover:translate-x-px" />
          )}
        </span>
      </Link>
      {/* 子菜单区域：父菜单项配置 items 时渲染；当前父级 active 时展开。 */}
      {items && (
        <AnimatedSizeContainer
          height
          transition={{ duration: 0.2, ease: "easeInOut" }}
        >
          <div
            className={cn(
              "transition-opacity duration-200",
              isActive ? "h-auto" : "h-0 opacity-0",
            )}
            aria-hidden={!isActive}
          >
            <div className="pl-px pt-1">
              <div className="pl-3.5">
                <div className="flex flex-col gap-0.5 border-l border-neutral-200 pl-2">
                  {items.map((item) => (
                    <NavItem key={item.name} item={item} />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </AnimatedSizeContainer>
      )}
    </div>
  );
}

// 单个右侧 area 的动画容器。
// 所有 area 都会被渲染出来，但只有 visible 的 area 可见、可交互。
export function Area({
  visible,
  direction,
  children,
}: PropsWithChildren<{ visible: boolean; direction: "left" | "right" }>) {
  // 非当前 area 会绝对定位、透明并向左/右移出，用于区域切换动画。
  return (
    <div
      className={cn(
        "left-0 top-0 flex size-full flex-col md:transition-[opacity,transform] md:duration-300",
        visible
          ? "opacity-1 relative"
          : cn(
              "pointer-events-none absolute opacity-0",
              direction === "left" ? "-translate-x-full" : "translate-x-full",
            ),
      )}
      aria-hidden={!visible ? "true" : undefined}
      inert={!visible}
    >
      {/* 当前 area 的具体标题和菜单内容由 SidebarAreasPanel 传入。 */}
      {children}
    </div>
  );
}
