本快速入门指南将向您展示如何在您的 React 网站上开始使用 Dub。

### 第一步：安装包

使用您偏好的包管理器，将 `@dub/analytics` 包添加到您的项目中。

```bash
npm install @dub/analytics
```

### 第二步：在代码中初始化包

如果您使用的是 React 框架，可以使用 `<Analytics />` 组件来跟踪网站上的转化。

例如，如果您使用的是 Next.js，可以将 `<Analytics />` 组件添加到根布局 (root layout) 组件或任何其他您想跟踪转化的页面中。

```jsx
import { Analytics as DubAnalytics } from '@dub/analytics/react';

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh">
      <body>{children}</body>
      <DubAnalytics />
    </html>
  );
}
```

