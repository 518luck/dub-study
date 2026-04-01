您还可以使用 Dub 的 [server-side SDKs](https://dub.co/docs/sdks/overview) 或 [REST API](https://dub.co/docs/api-reference/introduction) 手动跟踪 lead (潜在客户) 事件。

以下示例演示了如何使用 [Dub TypeScript SDK](https://dub.co/docs/sdks/typescript) 在 Node.js 中跟踪 lead。

```typescript
import { Dub } from "dub";

const dub = new Dub({
  // 可选，默认为 DUB_API_KEY 环境变量
  token: process.env.DUB_API_KEY,
});

await dub.track.lead({
  clickId: "rLnWe1uz9t282v7g",
  eventName: "Sign up",
  customerExternalId: "cus_oFUYbZYqHFR0knk0MjsMC6b0",
  customerName: "John Doe",
  customerEmail: "john.doe@example.com",
  customerAvatar: "https://example.com/avatar.png",
});
```

如果您想改用 REST API，可以参考以下示例：

```javascript
const response = await fetch("https://api.dub.co/track/lead", {
  method: "POST",
  headers: {
    Authorization: "Bearer dub_xxxxxx",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    clickId: "rLnWe1uz9t282v7g",
    eventName: "Sign up",
    customerExternalId: "cus_oFUYbZYqHFR0knk0MjsMC6b0",
    customerName: "John Doe",
    customerEmail: "john.doe@example.com",
    customerAvatar: "https://example.com/avatar.png",
  }),
});

const data = await response.json();
```

请确保在 Authorization 请求头中包含您的 API 密钥，并以 JSON 格式在请求正文中传递相关的 lead 数据。

---

有关可用参数和响应格式的详细信息，请参阅 [track lead API 参考](https://dub.co/docs/api-reference/endpoint/track-lead)。

Dub 还支持其他语言的 server-side SDK，包括：

- [Python](https://dub.co/docs/sdks/python)
- [PHP](https://dub.co/docs/sdks/php)
- [Ruby](https://dub.co/docs/sdks/ruby)
- [Go](https://dub.co/docs/sdks/go)
