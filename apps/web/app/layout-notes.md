# `app` 目录下不同 `layout.tsx` 的含义

这份笔记用来说明为什么 `UpgradeBanner`、`Toolbar`、`MainNav` 放在：

- `apps/web/app/app.dub.co/(dashboard)/layout.tsx`

而不是放在：

- `apps/web/app/app.dub.co/layout.tsx`
- `apps/web/app/layout.tsx`

## 先看结论

`layout.tsx` 放在哪一层，决定它会包住哪一层路由。

放得越外层，影响范围越大。
放得越内层，影响范围越小，但也越精确。

所以：

- `app/layout.tsx` 负责全站通用壳子
- `app/app.dub.co/layout.tsx` 负责 `app.dub.co` 子应用通用壳子
- `app/app.dub.co/(dashboard)/layout.tsx` 负责 dashboard 专属壳子

`UpgradeBanner`、`Toolbar`、`MainNav` 明显属于 dashboard 页面专属 UI，所以放在 `(dashboard)` 这一层最合理。

## 1. `apps/web/app/layout.tsx`

这是最外层根布局。

它负责的是全站都要有的内容，比如：

- `<html>` / `<body>`
- 全局样式
- 全局 providers
- 全局脚本

如果把 `UpgradeBanner` 或 `Toolbar` 放在这里，整个站点都会受到影响，包括：

- 登录页
- 营销页
- embed 页
- 其他根本不属于 dashboard 的页面

所以这一层只适合放“全站都通用”的东西，不适合放 dashboard UI。

## 2. `apps/web/app/app.dub.co/layout.tsx`

这是 `app.dub.co` 这个子站点的公共布局。

它当前负责的是这个子应用级别的运行环境，比如：

- `SessionProvider`
- `ModalProvider`

这类内容的特点是：

- `app.dub.co` 下的大多数页面都需要
- 但它们不是具体页面视觉结构的一部分

如果把 `UpgradeBanner`、`MainNav`、`Toolbar` 放在这里，那么 `app.dub.co` 下所有页面都会带上这套 dashboard 外壳。

这通常不合适，因为：

- 有些页面可能不需要左侧导航
- 有些页面不应该显示 onboarding
- 有些页面不需要顶部升级横幅的布局偏移

所以这一层适合放“子应用公共能力”，不适合放“dashboard 页面骨架”。

## 3. `apps/web/app/app.dub.co/(dashboard)/layout.tsx`

这是 dashboard 路由组的布局。

`(dashboard)` 是 Next.js 的 route group：

- 用来分组路由
- 可以挂独立布局
- 但目录名不一定出现在 URL 里

这一层最适合放 dashboard 共享的视觉结构和交互壳子，比如：

- `UpgradeBanner`
- `MainNav`
- `AppSidebarNav`
- `ReferButton`
- `HelpButton`
- `Toolbar`

因为这些内容的作用范围正好是：

- 只服务 dashboard 页面
- 不污染 `app.dub.co` 的其他页面
- 不影响整个网站

## 为什么 `UpgradeBanner` 要放在 `(dashboard)` 这一层

因为它不只是一个提示条，它还会影响 dashboard 整体布局。

例如 `MainNav` 会根据 `useUpgradeBannerVisible()` 的结果：

- 给页面顶部留出 48px 空间
- 调整侧边栏高度
- 调整内容区域高度

这说明 `UpgradeBanner` 和 dashboard 布局是耦合的。

既然它会改 dashboard 的整体壳子，那它最自然就应该和 `MainNav` 一起放在 dashboard layout 里。

## 为什么 `Toolbar` 要放在 `(dashboard)` 这一层

因为这个工具栏是 dashboard 专属的右下角悬浮工具区。

例如这里会放：

- onboarding 按钮
- help 按钮

这些都不是全站通用元素，而是 dashboard 使用过程中的辅助入口。

如果把它放到更外层：

- 会让无关页面也出现这个工具栏
- 会让布局职责变乱

所以它应该放在 dashboard 这一层。

## 一个判断标准

遇到组件不知道该放哪一层时，可以问 3 个问题：

1. 它是全站都要的吗？
如果是，考虑放根 layout。

2. 它是某个子应用都要的吗？
如果是，考虑放子应用 layout。

3. 它只是某一组页面共享的吗？
如果是，放那组页面自己的 layout。

## 这份结构在这个项目里的真实含义

- `app/layout.tsx`
  全站运行壳

- `app/app.dub.co/layout.tsx`
  `app.dub.co` 子应用运行壳

- `app/app.dub.co/(dashboard)/layout.tsx`
  dashboard 页面视觉壳 + 导航壳 + 工具壳

## 一句话总结

这些组件不是“作者随手放的”，而是在用 Next.js layout 层级控制 UI 的作用范围：

- 越外层越通用
- 越内层越具体

`UpgradeBanner` 和 `Toolbar` 属于 dashboard 专属布局，所以应该放在 `app.dub.co/(dashboard)/layout.tsx`。
