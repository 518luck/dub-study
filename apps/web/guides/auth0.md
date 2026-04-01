配置 Auth0，以在 `afterCallback` 函数中跟踪 lead 转换事件。

简而言之，其工作原理如下：

1. 在登录的 `afterCallback` 函数中，检查用户是否为新注册用户。
2. 如果是新注册用户，则检查是否存在 `dub_id` cookie。
3. 如果存在 `dub_id` cookie，则使用 `dub.track.lead` 向 Dub 发送 lead 事件。
4. 删除 `dub_id` cookie。

```javascript
import { handleAuth, handleCallback, type Session } from "@auth0/nextjs-auth0";
import { cookies } from "next/headers";
import { dub } from "@/lib/dub";

const afterCallback = async (req: Request, session: Session) => {
  const userExists = await getUser(session.user.email);

  if (!userExists) {
    createUser(session.user);
    // 检查 dub_id cookie 是否存在
    const clickId = cookies().get("dub_id")?.value;

    if (clickId) {
      // 向 Dub 发送 lead 事件
      await dub.track.lead({
        clickId,
        eventName: "Sign Up",
        customerExternalId: session.user.id,
        customerName: session.user.name,
        customerEmail: session.user.email,
        customerAvatar: session.user.image,
      });

      // 删除 dub_id cookie
      cookies().set("dub_id", "", {
        expires: new Date(0),
      });
    }
    return session;
  }
};

export default handleAuth({
  callback: handleCallback({ afterCallback }),
});
```
