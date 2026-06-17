"use client";

// SWR hook：获取当前用户的合作伙伴（Partner）信息
import usePartnerProfile from "@/lib/swr/use-partner-profile";
// 用户头像组件
import { UserAvatar } from "@/ui/users/user-avatar";
import {
  ArrowsOppositeDirectionX, // 切换账户图标
  Gift, // 推荐赚佣图标
  Icon,
  Popover, // 弹出层组件
  useCurrentSubdomain, // 获取当前子域名（如 "app" / "partners"）
  User, // 用户图标
} from "@dub/ui";
import { APP_DOMAIN, cn, PARTNERS_DOMAIN } from "@dub/utils";
import { LogOut } from "lucide-react";
import { signOut, useSession } from "next-auth/react";
import Link from "next/link";
import {
  ComponentPropsWithoutRef,
  ElementType,
  useMemo,
  useState,
} from "react";

/**
 * 用户下拉菜单组件
 * 渲染在侧边栏底部，点击头像后弹出菜单，包含账户设置、切换工作区、退出登录等选项。
 * 根据当前子域名（app / partners）动态展示不同的菜单项。
 */
export function UserDropdown() {
  // 获取当前登录用户的 session 信息
  const { data: session } = useSession();
  // 获取当前用户的合作伙伴资料
  const { partner } = usePartnerProfile();
  // 控制下拉弹窗的开关状态
  const [openPopover, setOpenPopover] = useState(false);
  // 获取当前页面的子域名，用于判断所在平台
  const { subdomain } = useCurrentSubdomain();

  // 根据当前子域名和用户身份，动态构建菜单选项列表
  const menuOptions = useMemo(() => {
    const options: Array<{
      label: string;
      icon: any;
      href?: string;
      type?: string;
      onClick?: () => void;
    }> = [
      // 始终显示的第一项：账户设置
      {
        label: "Account settings",
        icon: User,
        href: "/account/settings",
        onClick: () => setOpenPopover(false),
      },
    ];

    // 在合作伙伴子域名下，显示切换回工作区的选项
    if (subdomain === "partners") {
      options.push({
        label: "Switch to workspace",
        icon: ArrowsOppositeDirectionX,
        href: APP_DOMAIN,
      });
    }

    // 在主应用子域名下，显示推荐赚佣和切换到合作伙伴账户的选项
    if (subdomain === "app") {
      options.push({
        label: "Refer and earn",
        icon: Gift,
        href: "/account/settings/referrals",
        onClick: () => setOpenPopover(false),
      });

      // 仅当用户已关联合作伙伴身份时，才显示切换到合作伙伴账户的入口
      if (partner) {
        options.push({
          label: "Switch to partner account",
          icon: ArrowsOppositeDirectionX,
          href: PARTNERS_DOMAIN,
        });
      }
    }

    // 最后一项：退出登录
    options.push({
      type: "button",
      label: "Log out",
      icon: LogOut,
      onClick: () => {
        signOut({
          callbackUrl: "/login",
        });
      },
    });

    return options;
  }, [subdomain, partner, setOpenPopover]);

  return (
    <Popover
      content={
        <div className="flex w-full flex-col space-y-px rounded-md bg-white p-2 sm:min-w-56">
          {/* 用户信息区域：显示用户名和邮箱，未加载时展示骨架屏 */}
          {session?.user ? (
            <div className="px-2 pb-4 sm:pb-2">
              <p className="truncate text-base font-medium text-neutral-900 sm:text-sm">
                {session.user.name || session.user.email?.split("@")[0]}
              </p>
              <p className="truncate text-base text-neutral-500 sm:text-sm">
                {session.user.email}
              </p>
            </div>
          ) : (
            <div className="grid gap-2 px-2 py-3">
              <div className="h-3 w-12 animate-pulse rounded-full bg-neutral-200" />
              <div className="h-3 w-20 animate-pulse rounded-full bg-neutral-200" />
            </div>
          )}
          {/* 菜单选项列表 */}
          {menuOptions.map((menuOption, idx) => (
            <UserOption
              key={idx}
              as={menuOption.href ? Link : "button"}
              {...menuOption}
            />
          ))}
        </div>
      }
      align="start"
      openPopover={openPopover}
      setOpenPopover={setOpenPopover}
    >
      {/* 触发按钮：点击切换下拉菜单的显示状态 */}
      <button
        onClick={() => setOpenPopover(!openPopover)}
        className={cn(
          "group relative flex size-11 items-center justify-center rounded-lg transition-all",
          "hover:bg-bg-inverted/5 active:bg-bg-inverted/10 data-[state=open]:bg-bg-inverted/10 transition-colors duration-150",
          "outline-none focus-visible:ring-2 focus-visible:ring-black/50",
        )}
      >
        {session?.user ? (
          <UserAvatar
            user={session.user}
            className="size-7 border-none duration-75 sm:size-7"
          />
        ) : (
          <div className="size-7 animate-pulse rounded-full bg-neutral-100" />
        )}
      </button>
    </Popover>
  );
}

/** 菜单选项组件的 props 类型 */
type UserOptionProps<T extends ElementType> = {
  as?: T; // 渲染的元素类型，默认 "button"，有 href 时传 Link
  label: string; // 选项文字
  icon: Icon; // 选项图标
};

/**
 * 通用菜单选项组件
 * 支持作为 <button> 或 <Link> 渲染，由 as 属性决定。
 */
function UserOption<T extends ElementType = "button">({
  as,
  label,
  icon: Icon,
  children,
  ...rest
}: UserOptionProps<T> &
  Omit<ComponentPropsWithoutRef<T>, keyof UserOptionProps<T>>) {
  const Component = as ?? "button";

  return (
    <Component
      className="flex items-center gap-x-4 rounded-md px-2.5 py-1.5 text-base transition-all duration-75 hover:bg-neutral-200/50 active:bg-neutral-200/80 sm:text-sm"
      {...rest}
    >
      <Icon className="size-5 text-neutral-500 sm:size-4" />
      <span className="block truncate text-neutral-600">{label}</span>
      {children}
    </Component>
  );
}
