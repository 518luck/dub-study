或者，如果您不使用 Stripe 的结账会话创建流程，也可以在 [Stripe 客户创建流程](https://docs.stripe.com/api/customers/create) 中传递用户 ID 和点击事件 ID (`dub_id`)。

当您 [创建一个 Stripe 客户](https://docs.stripe.com/api/customers/create) 时，请在 `metadata` 字段中将数据库中用户的唯一 ID 作为 `dubCustomerExternalId` 值传递。

```javascript
import { stripe } from "@/lib/stripe";

const user = {
  id: "user_123",
  email: "user@example.com",
  teamId: "team_xxxxxxxxx",
};

const dub_id = req.headers.get("dub_id");

await stripe.customers.create({
  email: user.email,
  name: user.name,
  metadata: {
    dubCustomerExternalId: user.id,
    dubClickId: dub_id,
  },
});
```

或者，您也可以在 [Stripe 客户更新流程](https://docs.stripe.com/api/customers/update) 的 `metadata` 字段中传递 `dubCustomerExternalId` 和 `dubClickId` 值：

```javascript
import { stripe } from "@/lib/stripe";

const user = {
  id: "user_123",
  email: "user@example.com",
  teamId: "team_xxxxxxxxx",
};

const dub_id = req.headers.get("dub_id");

await stripe.customers.update(user.id, {
  metadata: {
    dubCustomerExternalId: user.id,
    dubClickId: dub_id,
  },
});
```

这样，当客户进行购买时，Dub 将自动将购买详情（发票金额、货币等）与原始点击事件关联。
