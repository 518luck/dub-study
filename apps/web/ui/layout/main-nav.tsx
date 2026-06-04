"use client";

import { useMediaQuery } from "@dub/ui";
import { cn } from "@dub/utils";
import { usePathname } from "next/navigation";
import {
  ComponentType, // 类型：表示一个 React 组件类型，这里用于 sidebar: ComponentType<...>
  createContext, // 创建 React Context，用来跨组件共享状态
  Dispatch, // 类型：表示 setState 这种派发函数
  PropsWithChildren, // 类型：给 props 自动加上 children
  ReactNode, // 类型：表示任意可渲染的 React 内容，比如 JSX、字符串、null
  SetStateAction, // 类型：表示 setState 可以接收的值或更新函数
  useEffect, // Hook：处理副作用，比如路由变化后关闭侧边栏
  useState, // Hook：创建组件内部状态，比如 isOpen
} from "react";
import { useUpgradeBannerVisible } from "./upgrade-banner";

type SideNavContext = {
  isOpen: boolean;
  setIsOpen: Dispatch<SetStateAction<boolean>>;
};

export const SideNavContext = createContext<SideNavContext>({
  isOpen: false,
  setIsOpen: () => {},
});

export function MainNav({
  children,
  sidebar: Sidebar,
  toolContent,
  newsContent,
}: PropsWithChildren<{
  sidebar: ComponentType<{
    toolContent?: ReactNode;
    newsContent?: ReactNode;
  }>;
  toolContent?: ReactNode;
  newsContent?: ReactNode;
}>) {
  const pathname = usePathname();

  const { isMobile } = useMediaQuery();
  const [isOpen, setIsOpen] = useState(false);
  const isUpgradeBannerVisible = useUpgradeBannerVisible();

  // Prevent body scroll when side nav is open
  useEffect(() => {
    document.body.style.overflow = isOpen && isMobile ? "hidden" : "auto";
  }, [isOpen, isMobile]);

  // Close side nav when pathname changes
  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  return (
    <div className="min-h-screen md:grid md:grid-cols-[min-content_minmax(0,1fr)]">
      {/* Side nav backdrop */}
      <div
        className={cn(
          "fixed left-0 z-50 w-screen transition-[background-color,backdrop-filter] md:sticky md:z-auto md:w-full md:bg-transparent",
          isOpen
            ? "bg-black/20 backdrop-blur-sm"
            : "bg-transparent max-md:pointer-events-none",
          isUpgradeBannerVisible
            ? "top-12 h-[calc(100dvh-48px)]"
            : "top-0 h-dvh",
        )}
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            e.stopPropagation();
            setIsOpen(false);
          }
        }}
      >
        {/* Side nav */}
        <div
          className={cn(
            "relative h-full w-min max-w-full bg-neutral-200 transition-transform md:translate-x-0",
            !isOpen && "-translate-x-full",
          )}
        >
          <Sidebar toolContent={toolContent} newsContent={newsContent} />
        </div>
      </div>
      {/* 分栏主要内容区域 */}
      <div
        className={cn(
          "bg-neutral-200 pb-[var(--page-bottom-margin)] pt-[var(--page-top-margin)] [--page-bottom-margin:0px] [--page-top-margin:0px] md:pb-2 md:pr-2 md:[--page-bottom-margin:0.5rem] md:[--page-top-margin:0.5rem]",
          isUpgradeBannerVisible ? "mt-12 h-[calc(100vh-48px)]" : "h-screen",
        )}
      >
        <div className="relative h-full overflow-y-auto bg-neutral-100 pt-px md:rounded-xl md:bg-white">
          <SideNavContext.Provider value={{ isOpen, setIsOpen }}>
            {children}
          </SideNavContext.Provider>
        </div>
      </div>
    </div>
  );
}
