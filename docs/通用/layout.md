# 主页面路由划分

在web目录没有layout.tsx文件，
app下面有一层 layout.tsx文件，
app.dub.co下面有一层 layout.tsx文件，
分组路由(dashboard)下面有一层 layout.tsx文件，
[slug]这个似乎是动态路由下面也有一层layout.tsx文件

# 原因

先说结论：这四层不是为了“凑四层”，而是按“共享范围”来切的。**哪一批页面稳定地共享一类能力，就在那一层放一个 layout。**

怎么划分的

- 第 1 层 app/layout.tsx：全站共享。放 html/body、全局字体、全局 CSS、根 Provider、全站脚本。这种东西所有页面都要用，所以
  放最外层最合理。
- 第 2 层 app.dub.co/layout.tsx：只给 app.dub.co 这个子应用用。这里放 SessionProvider、ModalProvider，因为这些不是全站都
  要，但这个子应用里几乎都要。
- 第 3 层 (dashboard)/layout.tsx：只给 dashboard 区域用。这里放主导航、侧边栏、升级横幅、工具栏，也就是“后台壳子”。
- 第 4 层 [slug]/layout.tsx：只给某个 workspace 用。这里不是 UI 壳，而是 WorkspaceAuth，用来校验当前 slug 对应的工作区是否
  可访问，失败就 notFound 或 redirect。
