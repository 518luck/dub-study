配置 Appwrite，以便在注册过程中跟踪 lead (潜在客户) 转换事件。

## 第一步

前往 [Appwrite Cloud](https://apwr.dev/appwrite-dub) 并创建一个新项目。

![Appwrite Cloud 上的新项目](https://mintlify.s3.us-west-1.amazonaws.com/dub/images/conversions/appwrite/appwrite-new-project.png)

创建一个启用 `sessions.write` 作用域的新 API key，并保存该 API key 以备后用。您还可以从项目的设置 (Settings) 页面复制您的项目 ID (Project ID) 和 endpoint (端点)。

![Appwrite Cloud 项目中的 API key](https://mintlify.s3.us-west-1.amazonaws.com/dub/images/conversions/appwrite/appwrite-api-key.png)

然后，在您的 Next.js 应用中安装 Appwrite Node.js SDK。

```bash
npm i node-appwrite
```

## 第二步

将以下环境变量添加到您的应用中。

```bash
NEXT_PUBLIC_APPWRITE_ENDPOINT=https://cloud.appwrite.io/v1
NEXT_PUBLIC_APPWRITE_PROJECT=<APPWRITE_PROJECT_ID>
NEXT_APPWRITE_KEY=<APPWRITE_API_KEY>
NEXT_DUB_API_KEY=<DUB_API_KEY>
```

## 第三步

从 `@dub/analytics` 包中将 `DubAnalytics` 组件添加到应用的根布局 (root layout) 中。

```javascript
import type { Metadata } from "next";
import { Analytics as DubAnalytics } from "@dub/analytics/react";

export const metadata: Metadata = {
  title: "Appwrite Dub Leads Example",
  description: "Appwrite Dub Leads Tracking example app with Next.js",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
      <DubAnalytics />
    </html>
  );
}
```

## 第四步

创建 Appwrite Session 和 Admin client (对于 SSR 应用是必需的，详见 [Appwrite 文档](https://appwrite.io/docs/products/auth/server-side-rendering))。此外，创建一个验证用户登录的函数。

```javascript
"use server";
import { Client, Account } from "node-appwrite";
import { cookies } from "next/headers";

export async function createSessionClient() {
  const client = new Client()
    .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT as string)
    .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT as string);

  const session = (await cookies()).get("my-custom-session");
  if (!session || !session.value) {
    throw new Error("No session");
  }

  client.setSession(session.value);

  return {
    get account() {
      return new Account(client);
    },
  };
}

export async function createAdminClient() {
  const client = new Client()
    .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT as string)
    .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT as string)
    .setKey(process.env.NEXT_APPWRITE_KEY as string);

  return {
    get account() {
      return new Account(client);
    },
  };
}
```

## 第五步

创建 Dub client，并使用 `dub.track.lead()` 函数将 lead 发送到 Dub。

```javascript
import type { Models } from "node-appwrite";
import { Dub } from "dub";

const dub = new Dub({
  token: process.env.NEXT_DUB_API_KEY,
});

export function addDubLead(
  user: Models.User<Models.Preferences>,
  dub_id: string,
) {
  dub.track.lead({
    clickId: dub_id,
    eventName: "Sign Up",
    customerExternalId: user.$id,
    customerName: user.name,
    customerEmail: user.email,
  });
}
```

## 第六步

在 `/auth` 页面中，使用 Appwrite Admin client 允许用户注册。在注册后，检查 `dub_id` cookie 是否存在，如果存在则向 Dub 发送 lead 事件，并删除 `dub_id` cookie。

```javascript
import { ID } from "node-appwrite";
import { createAdminClient, getLoggedInUser } from "@/lib/server/appwrite";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { addDubLead } from "@/lib/server/dub";

async function signUpWithEmail(formData: any) {
  "use server";

  // 从表单获取注册信息
  const email = formData.get("email");
  const password = formData.get("password");
  const name = formData.get("name");

  // 使用 Appwrite 创建账户和 session
  const { account } = await createAdminClient();

  const user = await account.create(ID.unique(), email, password, name);
  const session = await account.createEmailPasswordSession(email, password);

  (await cookies()).set("my-custom-session", session.secret, {
    path: "/",
    httpOnly: true,
    sameSite: "strict",
    secure: true,
  });

  // 检查 cookies 中是否存在 Dub ID，如果存在则跟踪 lead
  const dub_id = (await cookies()).get("dub_id")?.value;
  if (dub_id) {
    addDubLead(user, dub_id);
    (await cookies()).delete("dub_id");
  }

  // 重定向到成功页面
  redirect("/auth/success");
}

export default async function SignUpPage() {
  // 验证活跃的用户 session，如果找到则重定向到成功页面
  const user = await getLoggedInUser();
  if (user) redirect("/auth/success");

  return (
    <>
      <form action={signUpWithEmail}>
        <input
          id="email"
          name="email"
          placeholder="Email"
          type="email"
          required
        />
        <input
          id="password"
          name="password"
          placeholder="Password"
          minLength={8}
          type="password"
          required
        />
        <input id="name" name="name" placeholder="Name" type="text" required />
        <button type="submit">Sign up</button>
      </form>
    </>
  );
}
```

