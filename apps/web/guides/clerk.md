配置 Clerk，以便在有新用户注册时跟踪 lead 转换事件。

## 第一步：添加环境变量

将以下环境变量添加到您的应用中：

```bash
# 在此处获取：https://dashboard.clerk.com/apps/new
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your_publishable_key
CLERK_SECRET_KEY=your_secret_key

# 在此处获取：https://d.to/tokens
DUB_API_KEY=your_api_key
```

## 第二步：为您的 Clerk session token 添加自定义 claim

向您的 Clerk session token 添加以下 JSON 作为 [自定义 claim](https://clerk.com/docs/references/nextjs/add-onboarding-flow#add-custom-claims-to-your-session-token)：

```json
{
  "metadata": "{{user.public_metadata}}"
}
```

## 第三步：使用 Clerk 的 `useUser` hook 扩展 `@dub/analytics` 包

扩展 `@dub/analytics` 包以包含 `trackLead` server action。

```javascript
"use client";

import { trackLead } from "@/actions/track-lead";
import { useUser } from "@clerk/nextjs";
import { Analytics, AnalyticsProps } from "@dub/analytics/react";
import { useEffect } from "react";

export function DubAnalytics(props: AnalyticsProps) {
  const { user } = useUser();

  useEffect(() => {
    if (!user || user.publicMetadata.dubClickId) return;

    // 如果用户已加载但尚未持久化到 Dub，则跟踪 lead 事件
    trackLead({
      id: user.id,
      name: user.fullName!,
      email: user.primaryEmailAddress?.emailAddress,
      avatar: user.imageUrl,
    }).then(async (res) => {
      if (res.ok) await user.reload();
      else console.error(res.error);
    });

    // 您也可以使用 API route 代替 server action
    /*
      fetch("/api/track-lead", {
        method: "POST",
        body: JSON.stringify({
          id: user.id,
          name: user.fullName,
          email: user.primaryEmailAddress?.emailAddress,
          avatar: user.imageUrl,
        }),
      }).then(res => {
        if (res.ok) await user.reload();
        else console.error(res.statusText);
      });
      */
  }, [user]);

  return <Analytics {...props} />;
}
```

然后，将 `DubAnalytics` 组件添加到应用的根布局 (root layout) 组件中：

```javascript
import { DubAnalytics } from "@/components/dub-analytics";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html>
      <body>
        <DubAnalytics />
        {children}
      </body>
    </html>
  );
}
```

## 第四步：实现 `trackLead` server action

在服务器端，实现 `trackLead` server action。

```javascript
// 这是一个 server action
"use server";

import { dub } from "@/lib/dub";
import { clerkClient } from "@clerk/nextjs/server";
import { cookies } from "next/headers";

export async function trackLead({
  id,
  name,
  email,
  avatar,
}: {
  id: string;
  name?: string | null;
  email?: string | null;
  avatar?: string | null;
}) {
  try {
    const cookieStore = await cookies();
    const dubId = cookieStore.get("dub_id")?.value;

    if (dubId) {
      // 向 Dub 发送 lead 事件
      await dub.track.lead({
        clickId: dubId,
        eventName: "Sign Up",
        customerExternalId: id,
        customerName: name,
        customerEmail: email,
        customerAvatar: avatar,
      });

      // 删除 dub_id cookie
      cookieStore.set("dub_id", "", {
        expires: new Date(0),
      });
    }

    const clerk = await clerkClient();
    await clerk.users.updateUser(id, {
      publicMetadata: {
        dubClickId: dubId || "n/a",
      },
    });

    return { ok: true };
  } catch (error) {
    console.error("Error in trackLead:", error);
    return { ok: false, error: (error as Error).message };
  }
}
```

或者，您也可以改为创建一个 API route：

```javascript
// 这是一个 API route
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  // 从请求 cookies 中读取 dub_id
  const dubId = req.cookies.get("dub_id")?.value;
  if (dubId) {
    // 向 Dub 发送 lead 事件
    await dub.track.lead({
      clickId: dubId,
      eventName: "Sign Up",
      customerExternalId: id,
      customerName: name,
      customerEmail: email,
      customerAvatar: avatar,
    });
  }

  const clerk = await clerkClient();
  await clerk.users.updateUser(id, {
    publicMetadata: {
      dubClickId: dubId || "n/a",
    },
  });
  const res = NextResponse.json({ ok: true });
  // 删除 dub_id cookie
  res.cookies.set("dub_id", "", {
    expires: new Date(0),
  });
  return res;
}
```
