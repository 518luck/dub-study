import { geistMono, inter, satoshi } from "@/styles/fonts";
import "@/styles/globals.css";
import { cn, constructMetadata } from "@dub/utils";
import Script from "next/script";
import RootProviders from "./providers";

// 全站默认元信息
export const metadata = constructMetadata();

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={cn(satoshi.variable, inter.variable, geistMono.variable)}
    >
      <body>
        {/*
          RootProviders 是客户端组件边界。
          它自身和直接 import 的依赖属于客户端。
          但传进来的 children 仍然可以是服务端组件，不会被自动客户端化。
        */}
        <RootProviders>{children}</RootProviders>

        {/* embed/referrals 页面启动前主题同步 */}
        {/* next/script 是 Next.js 提供的脚本优化组件，用来替代原生 <script> 标签。
        beforeInteractive	页面可交互前加载（最早）
        afterInteractive	页面可交互后立即加载（默认）
        lazyOnload	浏览器空闲时才加载（最晚）
        worker	在 Web Worker 中加载
        主要优势是可以通过 strategy 属性控制脚本的加载时机： */}
        <Script id="set-theme" strategy="beforeInteractive">
          {`
          (() => {
            // Only run on referrals embed page for now
            if (window.location.pathname !== '/embed/referrals') return;

            const urlParams = new URLSearchParams(window.location.search);
            const theme = urlParams.get('theme');

            if (theme === 'dark' || (theme === 'system' && window.matchMedia("(prefers-color-scheme: dark)").matches)) {
              document.body.classList.add("dark");
            } else {
              document.body.classList.remove("dark");
            }
          })();
        `}
        </Script>
      </body>
    </html>
  );
}
