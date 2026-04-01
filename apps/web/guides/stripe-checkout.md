如果您有使用 Stripe 的 `checkout.sessions.create` API 的自定义结账流程，您会希望将 [Stripe customer 对象](https://docs.stripe.com/api/customers/object) 与数据库中用户的唯一 ID 相关联。

这将允许 Dub 自动监听来自 Stripe 的购买事件，并将其与原始点击事件（以及延伸的用户来源链接）相关联。

在底层，Dub 会将用户记录为客户，并将其与他们来自的点击事件相关联。

然后，当用户进行购买时，Dub 将自动将结账会话详细信息（发票金额、货币等）与客户关联——并由此关联到原始点击事件。

接着，当您 [创建一个结账会话 (checkout session)](https://docs.stripe.com/api/checkout/sessions/create) 时，请在 `metadata` 字段中将数据库中客户的唯一用户 ID 作为 `dubCustomerExternalId` 值传递。

```javascript
import { stripe } from "@/lib/stripe";

const user = {
  id: "user_123",
  email: "user@example.com",
  teamId: "team_xxxxxxxxx",
};

const priceId = "price_xxxxxxxxx";

const stripeSession = await stripe.checkout.sessions.create({
  customer_email: user.email,
  success_url: "https://app.domain.com/success",
  line_items: [{ price: priceId, quantity: 1 }],
  mode: "subscription",
  client_reference_id: user.teamId,
  metadata: {
    dubCustomerExternalId: user.id, // 数据库中客户的唯一用户 ID
  },
});
```

这样，当客户完成结账会话时，Dub 将自动将结账会话详细信息（发票金额、货币等）与客户关联——并由此关联到原始点击事件。
