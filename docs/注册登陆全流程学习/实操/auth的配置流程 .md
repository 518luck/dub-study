# NextAuth v5 (Beta) 配置流程实操

## 1. 安装依赖

```bash
pnpm add next-auth@beta @auth/prisma-adapter bcryptjs
```

## 2. 规范化代码结构

接下来代码结构要统一成 v5 beta 规范：

1. **根目录**：新建 `auth.ts`。
2. **API 路由**：`app/api/auth/[...nextauth]/route.ts` 仅导出 `handlers`。
3. **适配器**：使用官方推荐的 `@auth/prisma-adapter`。
4. **架构更新**：不再使用 v4 中常见的 `authOptions` 分离模式，而是采用 v5 的直接导出方式。

## 3. 最小骨架实现

### 核心配置文件：`auth.ts`

```typescript
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { compare } from "bcryptjs";
import prisma from "@/lib/prisma";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: {
    strategy: "database | jwt", // database 会真正用到 Session 表 登录态存在数据库里, jwt 不依赖 Session 表保存会话, 登录态主要放在 cookie/JWT 里
  },
  providers: [
    Credentials({
      credentials: {
        email: {},
        password: {},
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string },
        });

        if (!user || !user.passwordHash) return null;
        if (!user.emailVerified) return null;

        const ok = await compare(
          credentials.password as string,
          user.passwordHash,
        );

        if (!ok) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
        };
      },
    }),
  ],
});
```

### API 路由：`app/api/auth/[...nextauth]/route.ts`

```typescript
import { handlers } from "@/auth";

export const { GET, POST } = handlers;
```
