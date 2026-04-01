配置 Supabase，以便在 auth 回调函数中跟踪 lead 转换事件。

简而言之，其工作原理如下：

1. 在 `/api/auth/callback` 路由中，检查：
   - `dub_id` cookie 是否存在。
   - 用户是否为新注册（在过去 10 分钟内创建）。
2. 如果 `dub_id` cookie 存在且用户是新注册的，则使用 `dub.track.lead` 向 Dub 发送 lead 事件。
3. 删除 `dub_id` cookie。

```javascript
// app/api/auth/callback/route.ts
import { dub } from "@/lib/dub";
import { createClient } from "@/lib/supabase/server";
import { waitUntil } from "@vercel/functions";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  // 如果参数中有 "next"，则将其用作重定向 URL
  const next = searchParams.get("next") ?? "/";

  if (code) {
    const supabase = createClient(await cookies());
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      const { user } = data;
      const dub_id = (await cookies()).get("dub_id")?.value;
      // 如果用户是在过去 10 分钟内创建的，则视为新用户
      const isNewUser =
        new Date(user.created_at) > new Date(Date.now() - 10 * 60 * 1000);
      // 如果是新用户且有 dub_id cookie，则跟踪 lead

      if (dub_id && isNewUser) {
        waitUntil(
          dub.track.lead({
            clickId: dub_id,
            eventName: "Sign Up",
            customerExternalId: user.id,
            customerName: user.user_metadata.name,
            customerEmail: user.email,
            customerAvatar: user.user_metadata.avatar_url,
          }),
        );

        // 删除 dub_id cookie
        (await cookies()).delete("dub_id");
      }

      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // 将用户返回到带有说明的错误页面
  return NextResponse.redirect(`${origin}/auth/auth-code-error`);
}
```

