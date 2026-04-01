配置 Better Auth，以便在有新用户注册时跟踪 lead 转换事件。

## 第一步：安装 @dub/better-auth 插件

首先，通过您偏好的包管理器安装 [`@dub/better-auth` 插件](https://www.npmjs.com/package/@dub/better-auth)：

```bash
npm install @dub/better-auth
yarn add @dub/better-auth
pnpm add @dub/better-auth
bun add @dub/better-auth
```

## 第二步：配置插件

然后，将该插件添加到您的 better-auth 配置文件中：

```ts auth.ts
import { dubAnalytics } from "@dub/better-auth";
import { betterAuth } from "better-auth";
import { Dub } from "dub";

const dub = new Dub();

export const auth = betterAuth({
  plugins: [
    dubAnalytics({
      dubClient: dub,
    }),
  ],
});
```

