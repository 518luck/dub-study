配置 NextAuth，以便在有新用户注册时跟踪 lead 转换事件。

1. 使用 NextAuth 的 [`signIn` 事件](https://next-auth.js.org/configuration/events#signin) 来检测是否有新用户注册。
2. 如果用户是新注册用户，则检查 `dub_id` cookie 是否存在。
3. 如果存在 `dub_id` cookie，则使用 `dub.track.lead` 向 Dub 发送 lead 事件。
4. 删除 `dub_id` cookie。

在底层，Dub 会将用户记录为客户，并将其与他们来自的点击事件相关联。用户的唯一 ID 现在是所有未来事件的单一数据源——因此我们不再需要 `dub_id` cookie。

```javascript
// app/api/auth/[...nextauth]/options.ts
import type { NextAuthOptions } from "next-auth";
import { cookies } from "next/headers";
import { dub } from "@/lib/dub";

export const authOptions: NextAuthOptions = {
  ...otherAuthOptions, // 您的其他 NextAuth 选项
  events: {
    async signIn(message) {
      // 如果是新用户注册
      if (message.isNewUser) {
        // 检查 dub_id cookie 是否存在
        const dub_id = (await cookies()).get("dub_id")?.value;

        if (dub_id) {
          // 向 Dub 发送 lead 事件
          await dub.track.lead({
            clickId: dub_id,
            eventName: "Sign Up",
            customerExternalId: message.user.id,
            customerName: message.user.name,
            customerEmail: message.user.email,
            customerAvatar: message.user.image,
          });

          // 删除 dub_id cookie
          (await cookies()).set("dub_id", "", {
            expires: new Date(0),
          });
        }
      }
    },
  },
};
```

