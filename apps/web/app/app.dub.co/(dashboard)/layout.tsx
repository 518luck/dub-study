import { MainNav } from "@/ui/layout/main-nav";
import { AppSidebarNav } from "@/ui/layout/sidebar/app-sidebar-nav";
import { HelpButton } from "@/ui/layout/sidebar/help-button";
import { NewsRSC } from "@/ui/layout/sidebar/news-rsc";
import { ReferButton } from "@/ui/layout/sidebar/refer-button";
import Toolbar from "@/ui/layout/toolbar/toolbar";
import { UpgradeBanner } from "@/ui/layout/upgrade-banner";
import { constructMetadata } from "@dub/utils";
import { ReactNode } from "react";

//“Next.js，请按 force-static 这个策略处理这个路由段。” 强制这一段路由按“静态内容”来处理。
// 不是每次用户请求都重新算一遍
// 而是提前生成好，或者尽量缓存复用
// 更接近“固定内容页面”
export const dynamic = "force-static";
export const metadata = constructMetadata();

export default async function Layout({ children }: { children: ReactNode }) {
  return (
    <>
      <div className="min-h-screen w-full bg-white">
        {/* <UpgradeBanner /> 
        是一个顶部升级提醒横幅，用来在用户当前工作区出现套餐/付款问题时提
        醒并引导操作。 */}
        <UpgradeBanner />
        <MainNav
          sidebar={AppSidebarNav} //把 AppSidebarNav 这个组件传给 MainNav，作为“侧边栏主体”。
          toolContent={
            //传一段额外的工具区内容进去，这段内容包括：
            <>
              <ReferButton />
              <HelpButton />
            </>
          }
          // 传一个新闻内容区域进去，内容是 NewsRSC 这个组件渲染出来的结果。
          newsContent={<NewsRSC />}
        >
          {children}
        </MainNav>
      </div>
      <Toolbar show={["onboarding"]} />
    </>
  );
}
