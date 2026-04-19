"use client";
//  它是一个自定义的“全局 Provider 容器”
//  它的作用是把一些“全站都可能要用的能力”统一挂到应用根部。这样页面里
//  的任意组件都能直接使用这些能力。

// 一般 Provider 可以做这些事：
// - 提供全局状态，比如当前用户、主题、语言、权限
// - 提供全局行为，比如弹 toast、打开 tooltip、监听快捷键
// - 提供第三方能力，比如埋点、监控、认证、数据请求缓存
// - 做一次性的全局初始化，比如注册事件、挂载 portal 容器、同步浏览器
//   状态
import { Analytics as DubAnalytics } from "@dub/analytics/react";
import { KeyboardShortcutProvider, TooltipProvider } from "@dub/ui";
import PlausibleProvider from "next-plausible";
import { ReactNode } from "react";
import { Toaster } from "sonner";

export default function RootProviders({ children }: { children: ReactNode }) {
  return (
    // Tooltip 是“提示浮层”。  Provider 表示它在上层提供 tooltip 运行所需的上下文
    <TooltipProvider>
      {/* Plausible 是一个开源的网站统计工具。
      next-plausible 是 Next.js 官方推荐的 Plausible 官方库。 */}
      <PlausibleProvider domain="dub.co" revenue />
      {/* KeyboardShortcutProvider 提供了快捷键能力。 */}
      <KeyboardShortcutProvider>
        {/* Toaster 是一个轻量级的通知组件，用于显示短暂的提示信息。 */}
        <Toaster className="pointer-events-auto" closeButton />
        {children}
        {/* DubAnalytics 是一个用于网站统计的组件。 */}
        <DubAnalytics
          apiHost="/_proxy/dub" //以后相关请求发到哪个后端地址
          cookieOptions={{
            domain: process.env.VERCEL === "1" ? ".dub.co" : "localhost", //就是“analytics 在浏览器里保存 cookie 时怎么保存”。
          }}
          domainsConfig={{
            refer: "refer.dub.co", //看名字就是“推荐/邀请/referral”相关的短域名配置。
          }}
        />
      </KeyboardShortcutProvider>
    </TooltipProvider>
  );
}
