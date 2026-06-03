"use client";

import { getPlanCapabilities } from "@/lib/plan-capabilities";
import { REFERRAL_ENABLED_PROGRAM_IDS } from "@/lib/referrals/constants";
import {
  SubmissionsCountByStatus,
  useBountySubmissionsCount,
} from "@/lib/swr/use-bounty-submissions-count";
import { useFraudGroupCount } from "@/lib/swr/use-fraud-groups-count";
import { usePartnerMessagesCount } from "@/lib/swr/use-partner-messages-count";
import { usePayoutsCount } from "@/lib/swr/use-payouts-count";
import useProgram from "@/lib/swr/use-program";
import { useProgramReferralsCount } from "@/lib/swr/use-program-referrals-count";
import useWorkspace from "@/lib/swr/use-workspace";
import useWorkspaces from "@/lib/swr/use-workspaces";
import { useRouterStuff } from "@dub/ui";
import {
  Bell,
  Brush,
  ConnectedDots,
  CubeSettings,
  DiamondTurnRight,
  Folder,
  Gauge6,
  Gear2,
  Gift,
  Globe,
  InvoiceDollar,
  Key,
  LifeRing,
  LinesY as LinesYStatic,
  MarketingTarget,
  MoneyBills2,
  Msgs,
  PaperPlane,
  Receipt2,
  ShieldCheck,
  ShieldKeyhole,
  Sliders,
  Tag,
  Trophy,
  UserCheck,
  UserPlus,
  Users,
  Users6,
  Webhook,
} from "@dub/ui/icons";
import { Session } from "next-auth";
import { useSession } from "next-auth/react";
import { useParams, usePathname } from "next/navigation";
import { ReactNode, useEffect, useMemo } from "react";
import { DubPartnersPopup } from "./dub-partners-popup";
import { Compass } from "./icons/compass";
import { ConnectedDots4 } from "./icons/connected-dots4";
import { CursorRays } from "./icons/cursor-rays";
import { Hyperlink } from "./icons/hyperlink";
import { LinesY } from "./icons/lines-y";
import { User } from "./icons/user";
import { SidebarNav, SidebarNavAreas, SidebarNavGroups } from "./sidebar-nav";
import { SidebarUsage } from "./sidebar-usage";
import { useProgramApplicationsCount } from "./use-program-applications-count";
import { WorkspaceDropdown } from "./workspace-dropdown";

// app.dub.co 后台侧边栏的业务数据结构。
// SidebarNav 是通用 UI 外壳，这里的 data 是菜单配置函数生成 href、active 状态和 badge 时需要的上下文。
type SidebarNavData = {
  slug: string;
  pathname: string;
  queryString: string;
  defaultProgramId?: string;
  session?: Session | null;
  showNews?: boolean;
  pendingPayoutsCount?: number;
  applicationsCount?: number;
  submittedBountiesCount?: number;
  unreadMessagesCount?: number;
  pendingFraudEventsCount?: number;
  pendingReferralsCount?: number;
  showConversionGuides?: boolean;
  partnerNetworkEnabled?: boolean;
};

// 左侧窄栏的一级入口配置。
// 这里不渲染右侧菜单，只负责在 64px 图标栏中切换大的产品区域。
const NAV_GROUPS: SidebarNavGroups<SidebarNavData> = ({
  slug,
  pathname,
  defaultProgramId,
}) => [
  {
    name: "Short Links",
    description:
      "Create, organize, and measure the performance of your short links.",
    learnMoreHref: "https://dub.co/links",
    icon: Compass,
    href: slug ? `/${slug}/links` : "/links",
    active:
      !!slug &&
      pathname.startsWith(`/${slug}`) &&
      !pathname.startsWith(`/${slug}/program`) &&
      !pathname.startsWith(`/${slug}/settings`),
  },
  {
    name: "Partner Program",
    description:
      "Kickstart viral product-led growth with powerful, branded referral and affiliate programs.",
    learnMoreHref: "https://dub.co/partners",
    icon: ConnectedDots4,
    href: slug ? `/${slug}/program` : "/program",
    active: pathname.startsWith(`/${slug}/program`),
    popup: DubPartnersPopup,
  },
];

// 右侧展开区域的菜单配置。
// key 会被 currentArea 选中，比如 default / program / workspaceSettings / userSettings。
const NAV_AREAS: SidebarNavAreas<SidebarNavData> = {
  // 短链接主区域：处理 links、domains、analytics、events、customers 等日常功能。
  default: ({ slug, pathname, queryString, showNews }) => ({
    title: "Short Links",
    showNews,
    direction: "left",
    content: [
      {
        items: [
          {
            name: "Links",
            icon: Hyperlink,
            href: `/${slug}/links${pathname === `/${slug}/links` ? "" : queryString}`,
            isActive: (pathname: string, href: string) => {
              const basePath = href.split("?")[0];

              // 基础链接列表页需要精确匹配。
              if (pathname === basePath) return true;

              // 链接详情页的第一个路径片段通常是 domain，里面会包含点号。
              if (pathname.startsWith(basePath + "/")) {
                const nextSegment = pathname
                  .slice(basePath.length + 1)
                  .split("/")[0];
                return nextSegment.includes(".");
              }

              return false;
            },
          },
          {
            name: "Domains",
            icon: Globe,
            href: `/${slug}/links/domains`,
          },
        ],
      },
      {
        name: "Insights",
        items: [
          {
            name: "Analytics",
            icon: LinesY,
            href: `/${slug}/analytics${pathname === `/${slug}/analytics` ? "" : queryString}`,
          },
          {
            name: "Events",
            icon: CursorRays,
            href: `/${slug}/events${pathname === `/${slug}/events` ? "" : queryString}`,
          },
          {
            name: "Customers",
            icon: User,
            href: `/${slug}/customers`,
          },
        ],
      },
      {
        name: "Library",
        items: [
          {
            name: "Folders",
            icon: Folder,
            href: `/${slug}/links/folders`,
          },
          {
            name: "Tags",
            icon: Tag,
            href: `/${slug}/links/tags`,
          },
          {
            name: "UTM Templates",
            icon: DiamondTurnRight,
            href: `/${slug}/links/utm`,
          },
        ],
      },
    ],
  }),

  // Partner Program 区域：推广计划、合作伙伴、佣金、风控等菜单都在这里。
  program: ({
    slug,
    showNews,
    pendingPayoutsCount,
    applicationsCount,
    submittedBountiesCount,
    unreadMessagesCount,
    pendingFraudEventsCount,
    pendingReferralsCount,
    partnerNetworkEnabled,
  }) => ({
    title: "Partner Program",
    showNews,
    direction: "left",
    content: [
      {
        items: [
          {
            name: "Overview",
            icon: Gauge6,
            href: `/${slug}/program`,
            exact: true,
          },
          {
            name: "Payouts",
            icon: MoneyBills2,
            href: `/${slug}/program/payouts?status=pending`,
            // 待处理 payout 数量来自 usePayoutsCount，用于提醒 program owner 处理付款。
            badge: pendingPayoutsCount
              ? pendingPayoutsCount > 99
                ? "99+"
                : pendingPayoutsCount
              : undefined,
          },
          {
            name: "Messages",
            icon: Msgs,
            href: `/${slug}/program/messages`,
            // 未读消息数量来自 usePartnerMessagesCount。
            badge: unreadMessagesCount
              ? unreadMessagesCount > 99
                ? "99+"
                : unreadMessagesCount
              : undefined,
          },
        ],
      },
      {
        name: "Partners",
        items: [
          {
            name: "All Partners",
            icon: Users,
            href: `/${slug}/program/partners`,
            // applications 是 partners 的子路径，但它有独立菜单项，避免 All Partners 一起高亮。
            isActive: (pathname: string, href: string) =>
              pathname.startsWith(href) &&
              !pathname.startsWith(`${href}/applications`),
          },
          {
            name: "Groups",
            icon: Users6,
            href: `/${slug}/program/groups`,
          },
          ...(partnerNetworkEnabled
            ? [
                {
                  name: "Partner Network",
                  icon: UserPlus,
                  href: `/${slug}/program/network` as `/${string}`,
                  badge: "New",
                },
              ]
            : []),
          {
            name: "Applications",
            icon: UserCheck,
            href: `/${slug}/program/partners/applications`,
            badge: applicationsCount
              ? applicationsCount > 99
                ? "99+"
                : applicationsCount
              : undefined,
          },
        ],
      },
      {
        name: "Insights",
        items: [
          {
            name: "Analytics",
            icon: LinesYStatic,
            href: `/${slug}/program/analytics`,
          },
          {
            name: "Customers",
            icon: User,
            href: `/${slug}/program/customers`,
            // 这里只在指定 program 开启 referrals 时展示待处理 referral 数量。
            badge: pendingReferralsCount
              ? pendingReferralsCount > 99
                ? "99+"
                : pendingReferralsCount
              : undefined,
          },
          {
            name: "Commissions",
            icon: InvoiceDollar,
            href: `/${slug}/program/commissions`,
          },
          {
            name: "Fraud Detection",
            icon: ShieldKeyhole,
            href: `/${slug}/program/fraud`,
            badge: pendingFraudEventsCount
              ? pendingFraudEventsCount > 99
                ? "99+"
                : pendingFraudEventsCount
              : undefined,
          },
        ],
      },
      {
        name: "Engagement",
        items: [
          {
            name: "Bounties",
            icon: Trophy,
            href: `/${slug}/program/bounties`,
            badge: submittedBountiesCount
              ? submittedBountiesCount > 99
                ? "99+"
                : submittedBountiesCount
              : "",
          },
          {
            name: "Email Campaigns",
            icon: PaperPlane,
            href: `/${slug}/program/campaigns` as `/${string}`,
          },
          {
            name: "Resources",
            icon: LifeRing,
            href: `/${slug}/program/resources`,
          },
        ],
      },
      {
        name: "Configuration",
        items: [
          {
            name: "Rewards",
            icon: Gift,
            href: `/${slug}/program/groups/default/rewards`,
            arrow: true,
            // 这些配置项跳到默认 group 的具体配置页，不在当前侧边栏里保持高亮。
            isActive: () => false,
          },
          {
            name: "Links",
            icon: Sliders,
            href: `/${slug}/program/groups/default/links`,
            arrow: true,
            isActive: () => false,
          },
          {
            name: "Branding",
            icon: Brush,
            arrow: true,
            href: `/${slug}/program/groups/default/branding`,
            isActive: () => false,
          },
        ],
      },
    ],
  }),

  // Workspace 设置区域：workspace 级别配置，例如成员、域名、API key、webhook 等。
  workspaceSettings: ({ slug }) => ({
    title: "Settings",
    backHref: `/${slug}`,
    content: [
      {
        name: "Workspace",
        items: [
          {
            name: "General",
            icon: Gear2,
            href: `/${slug}/settings`,
            exact: true,
          },
          {
            name: "Billing",
            icon: Receipt2,
            href: `/${slug}/settings/billing`,
          },
          {
            name: "Domains",
            icon: Globe,
            href: `/${slug}/settings/domains`,
          },
          {
            name: "Members",
            icon: Users6,
            href: `/${slug}/settings/members`,
          },
          {
            name: "Integrations",
            icon: ConnectedDots,
            href: `/${slug}/settings/integrations`,
          },
          {
            name: "Security",
            icon: ShieldCheck,
            href: `/${slug}/settings/security`,
          },
        ],
      },
      {
        name: "Developer",
        items: [
          {
            name: "API Keys",
            icon: Key,
            href: `/${slug}/settings/tokens`,
          },
          {
            name: "Tracking",
            icon: MarketingTarget,
            href: `/${slug}/settings/tracking`,
          },
          {
            name: "Webhooks",
            icon: Webhook,
            href: `/${slug}/settings/webhooks`,
          },
          {
            name: "OAuth Apps",
            icon: CubeSettings,
            href: `/${slug}/settings/oauth-apps`,
          },
        ],
      },
      {
        name: "Account",
        items: [
          {
            name: "Notifications",
            icon: Bell,
            href: `/${slug}/settings/notifications`,
          },
        ],
      },
    ],
  }),

  // 用户账号设置区域：路径没有 workspace slug，所以需要依赖下方的 slug 推断逻辑提供返回地址。
  userSettings: ({ slug }) => ({
    title: "Settings",
    backHref: `/${slug}`,
    hideSwitcherIcons: true,
    content: [
      {
        name: "Account",
        items: [
          {
            name: "General",
            icon: Gear2,
            href: "/account/settings",
            exact: true,
          },
          {
            name: "Security",
            icon: ShieldCheck,
            href: "/account/settings/security",
          },
          {
            name: "Referrals",
            icon: Gift,
            href: "/account/settings/referrals",
          },
          {
            name: "Notifications",
            icon: Bell,
            href: `/${slug}/settings/notifications`,
            arrow: true,
          },
        ],
      },
    ],
  }),
};

export function AppSidebarNav({
  toolContent,
  newsContent,
}: {
  toolContent?: ReactNode;
  newsContent?: ReactNode;
}) {
  const { slug: paramsSlug } = useParams() as { slug?: string };
  const pathname = usePathname();
  const { getQueryString } = useRouterStuff();
  const { data: session, status } = useSession();
  const { plan, defaultProgramId } = useWorkspace();
  const { workspaces } = useWorkspaces();

  // 记录最近访问的 workspace。
  // /account/settings 这类账号页面没有 slug 参数，但侧边栏仍然需要知道返回哪个 workspace。
  useEffect(() => {
    if (paramsSlug) {
      sessionStorage.setItem("dub_last_workspace", paramsSlug);
    }
  }, [paramsSlug]);

  // 如果用户退出登录，或者已经没有访问上次 workspace 的权限，就清掉本地记录。
  useEffect(() => {
    if (status === "unauthenticated") {
      // 退出登录后避免下个用户继续使用上一个用户的 workspace 记录。
      sessionStorage.removeItem("dub_last_workspace");
      return;
    }

    if (workspaces && typeof window !== "undefined") {
      const storedSlug = sessionStorage.getItem("dub_last_workspace");
      if (storedSlug && !paramsSlug) {
        // 只在非 workspace 页面校验，避免正常切换 workspace 的过程中被误清理。
        const hasAccess = workspaces.some((w) => w.slug === storedSlug);
        if (!hasAccess) {
          // 用户已经没有这个 workspace 的访问权限，清理本地缓存。
          sessionStorage.removeItem("dub_last_workspace");
        }
      }
    }
  }, [workspaces, status, paramsSlug]);

  // 当前侧边栏使用的 workspace slug 优先级：
  // 1. URL 参数中的 slug
  // 2. sessionStorage 里记录的最近访问 workspace
  // 3. session.user.defaultWorkspace
  const slug =
    paramsSlug ||
    (typeof window !== "undefined" && workspaces
      ? (() => {
          const storedSlug = sessionStorage.getItem("dub_last_workspace");
          // 使用前再次确认当前用户仍然有权限访问这个 workspace。
          if (storedSlug && workspaces.some((w) => w.slug === storedSlug)) {
            return storedSlug;
          }
          return null;
        })()
      : null) ||
    session?.user?.["defaultWorkspace"];

  // 根据当前路径决定右侧菜单区域。
  // 返回 null 时 SidebarNav 会收窄，只保留左侧图标栏，适合沉浸式详情页。
  const currentArea = useMemo(() => {
    return pathname.startsWith("/account/settings")
      ? "userSettings"
      : pathname.startsWith(`/${slug}/settings`)
        ? "workspaceSettings"
        : pathname.includes("/program/campaigns/") ||
            pathname.includes("/program/messages/") ||
            pathname.endsWith("/program/payouts/success")
          ? null
          : pathname.startsWith(`/${slug}/program`)
            ? "program"
            : "default";
  }, [slug, pathname]);

  // 下面这些 program 相关请求只在 program 区域启用，避免普通 links 页面多发无关请求。
  const { program } = useProgram({
    enabled: Boolean(currentArea === "program" && defaultProgramId),
  });

  const { payoutsCount: pendingPayoutsCount } = usePayoutsCount<
    number | undefined
  >({
    eligibility: "eligible",
    status: "pending",
    ignoreParams: true,
    enabled: Boolean(currentArea === "program" && defaultProgramId),
  });

  const applicationsCount = useProgramApplicationsCount({
    enabled: Boolean(currentArea === "program" && defaultProgramId),
  });

  const { submissionsCount } = useBountySubmissionsCount<
    SubmissionsCountByStatus[]
  >({
    ignoreParams: true,
    enabled: Boolean(currentArea === "program" && defaultProgramId),
  });

  const submittedBountiesCount =
    submissionsCount?.find(({ status }) => status === "submitted")?.count || 0;

  // 消息菜单在部分 program 子页面也需要显示未读数，所以只判断 currentArea === "program"。
  const { count: unreadMessagesCount } = usePartnerMessagesCount({
    enabled: Boolean(currentArea === "program"),
    query: {
      unread: true,
    },
  });

  const { fraudGroupCount: pendingFraudEventsCount } = useFraudGroupCount<
    number | undefined
  >({
    query: { status: "pending" },
    enabled: Boolean(currentArea === "program" && defaultProgramId),
    ignoreParams: true,
  });

  const { data: pendingReferralsCount } = useProgramReferralsCount<number>({
    query: { status: "pending" },
    ignoreParams: true,
    enabled: Boolean(
      currentArea === "program" &&
        defaultProgramId &&
        REFERRAL_ENABLED_PROGRAM_IDS.includes(defaultProgramId),
    ),
  });

  // 根据套餐能力决定是否展示 conversion tracking 引导。
  const { canTrackConversions } = getPlanCapabilities(plan);

  return (
    <SidebarNav
      groups={NAV_GROUPS} // 左侧一级入口配置
      areas={NAV_AREAS} // 右侧菜单区域配置
      currentArea={currentArea} // 当前应该展开的右侧菜单区域
      // 传给 NAV_GROUPS / NAV_AREAS 的运行时数据。
      data={{
        slug: slug || "", // 当前 workspace slug
        pathname, // 当前路由路径
        queryString: getQueryString(undefined, {
          include: ["folderId"],
        }), // 从当前 URL 中保留侧边栏跳转需要继承的查询参数
        session: session || undefined, // 当前登录 session
        showNews: true, // 是否展示右侧底部 news / usage 区域
        defaultProgramId: defaultProgramId || undefined, // 当前 workspace 的默认 program id
        pendingPayoutsCount, // 待处理 payout 数量
        applicationsCount, // 待处理 partner application 数量
        submittedBountiesCount, // 已提交 bounty 数量
        unreadMessagesCount, // 未读 program message 数量
        pendingFraudEventsCount, // 待处理风控事件数量
        pendingReferralsCount, // 待处理 referral 数量
        showConversionGuides:
          canTrackConversions && pathname.startsWith(`/${slug}/links`), // 是否显示转化引导
        partnerNetworkEnabled:
          program && program.partnerNetworkEnabledAt !== null, // 是否启用 partner network
      }}
      toolContent={toolContent} // 工具区内容
      newsContent={plan && (plan === "free" ? <SidebarUsage /> : newsContent)} // free 套餐展示用量，其他套餐展示新闻内容
      switcher={<WorkspaceDropdown />} // 工作区切换器
    />
  );
}
