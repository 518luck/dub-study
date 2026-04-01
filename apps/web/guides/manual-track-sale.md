您还可以使用 Dub 的 [server-side SDKs](https://dub.co/docs/sdks/overview) 或 [REST API](https://dub.co/docs/api-reference/introduction) 手动跟踪销售事件。

以下示例演示了如何使用 [Dub TypeScript SDK](https://dub.co/docs/sdks/typescript) 在 Node.js 中跟踪销售。

```typescript
import { Dub } from "dub";

const dub = new Dub({
  // 可选，默认为 DUB_API_KEY 环境变量
  token: process.env.DUB_API_KEY,
});

await dub.track.sale({
  customerExternalId: "cus_oFUYbZYqHFR0knk0MjsMC6b0",
  amount: 3000, // 销售金额（以分为单位）
  currency: "usd",
  paymentProcessor: "stripe",
  eventName: "Invoice paid",
  invoiceId: "INV_1234567890",
});
```

如果您想使用 REST API，可以参考以下示例：

```javascript
const response = await fetch("https://api.dub.co/track/sale", {
  method: "POST",
  headers: {
    Authorization: "Bearer dub_xxxxxx",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    customerExternalId: "cus_oFUYbZYqHFR0knk0MjsMC6b0",
    amount: 3000, // 销售金额（以分为单位）
    paymentProcessor: "stripe",
    eventName: "Invoice paid",
    invoiceId: "INV_1234567890",
    currency: "usd",
  }),
});

const data = await response.json();
```

请确保在 Authorization 请求头中包含您的 API 密钥，并将相关的销售数据以 JSON 格式传递到请求正文中。

---

有关可用参数和响应格式的详细信息，请参阅 [track sale API reference](https://dub.co/docs/api-reference/endpoint/track-sale)。

Dub 还支持其他语言的 server-side SDK，包括：

- [Python](https://dub.co/docs/sdks/python)
- [PHP](https://dub.co/docs/sdks/php)
- [Ruby](https://dub.co/docs/sdks/ruby)
- [Go](https://dub.co/docs/sdks/go)
