如果您使用的是 [Stripe 支付链接 (Payment Links)](https://docs.stripe.com/payment-links)，只需在 Dub 上缩短链接时添加 `?dub_client_reference_id=1` 查询参数即可。

然后，当用户点击缩短后的链接时，Dub 将自动将唯一的点击 ID 作为 `client_reference_id` [查询参数](https://docs.stripe.com/payment-links/url-parameters) 附加到支付链接中。

![带有 Dub 点击 ID 的 Stripe 支付链接](https://assets.dub.co/cms/conversions-payment-links.jpg)

最后，当用户完成结账流程时，Dub 将自动跟踪销售事件，并使用其 Stripe 客户 ID 更新客户的 `externalId` 以供将来参考。

或者，如果您有一个营销网站且用户首先会被重定向到该网站，您可以按照以下步骤操作：

1. [安装 @dub/analytics 客户端 SDK](https://dub.co/docs/sdks/client-side/introduction)，它会自动检测 URL 中的 `dub_id` 并将其作为第一方 cookie 存储在您的网站上。
2. 然后，获取 `dub_id` 值并将其作为 `client_reference_id` 参数附加到定价页面/CTA 按钮上的支付链接中（以 `dub_id_` 为前缀）。

```javascript
https://buy.stripe.com/xxxxxx?client_reference_id=dub_id_xxxxxxxxxxxxxx
```

## 如果我使用的是 Stripe 定价表 (Pricing Tables) 怎么办？

如果您使用的是 [Stripe 定价表 (Pricing Tables)](https://docs.stripe.com/payments/checkout/pricing-table) —— 您需要将 Dub 点击 ID 作为 [`client-reference-id` 属性](https://docs.stripe.com/payments/checkout/pricing-table#handle-fulfillment-with-the-stripe-api) 传递：

```html
<body>
  <h1>我们提供助力任何业务的方案！</h1>
  <!-- 在此处粘贴您的嵌入代码脚本。 -->
  <script async src="https://js.stripe.com/v3/pricing-table.js"></script>
  <stripe-pricing-table
    pricing-table-id="{{PRICING_TABLE_ID}}"
    publishable-key="pk_test_51ODHJvFacAXKeDpJsgWLQJSzBIDtCUFN6MoB4IIXKJDfWdFmiEO4JuvAU1A0Y2Ri4m4q1egIfwYy3s72cUBRCwXC00GQhEZuXa"
    client-reference-id="dub_id_xxxxxxxxxxxxxx"
  >
  </stripe-pricing-table>
</body>
```

