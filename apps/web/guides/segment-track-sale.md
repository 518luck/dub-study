配置 Segment，以便在用户购买您的产品或服务时跟踪销售 (sale) 事件。

如果您已经设置了 Dub (Actions) 目的地，可以跳过前两个步骤，直接跳至 **添加映射** 部分。

## 第一步：添加 Dub (Actions) destination (目的地)

前往 [Segment Dub (Actions)](https://app.segment.com/goto-my-workspace/destinations/catalog/actions-dub) 并将该目的地添加到您的 Segment 工作区。

![Segment Dub (Actions) 目的地](https://mintlify.s3.us-west-1.amazonaws.com/dub/images/conversions/segment/segment-actions.png)

## 第二步：配置 Dub API Key

在 Dub (Actions) 目的地设置中，填写以下字段：

- **Name:** 输入一个名称，帮助您在 Segment 中识别此目的地。
- **API Key:** 输入您的 Dub API 密钥。您可以在 [Dub 控制面板](https://app.dub.co/settings/tokens) 中找到它。
- **Enable Destination:** 开启此开关以允许 Segment 向 Dub 发送数据。

完成后，点击 **Save Changes**。

![Segment Dub (Actions) 基础设置](https://mintlify.s3.us-west-1.amazonaws.com/dub/images/conversions/segment/segment-basic-settings.png)

## 第三步：添加 Mapping (映射)

接下来，您将从可用操作列表中选择 **Track a sale** 操作。

默认情况下，此操作配置为在 **Event Name** 为 **Order Completed** 时向 Dub 发送销售数据。

![Segment Dub (Actions) 映射](https://mintlify.s3.us-west-1.amazonaws.com/dub/images/conversions/segment/segment-track-sale-action.png)

在所选操作下方，您将看到该操作的映射。

![Segment Dub (Actions) 映射](https://mintlify.s3.us-west-1.amazonaws.com/dub/images/conversions/segment/segment-track-sale-mapping.png)

您可以自定义触发器 (trigger) 和映射，以满足您应用程序的具体需求。

最后，点击 **Next**，然后点击 **Save and enable** 将映射添加到目的地。

## 第四步：向 Dub 发送销售事件

在服务器端，您将使用 `@segment/analytics-node` SDK 向 Segment 发送销售事件。

请确保在 payload 中包含相关的属性，例如 `userId`、`payment_processor`、`order_id`、`currency` 和 `revenue`。

```javascript
import { Analytics } from "@segment/analytics-node";

const segment = new Analytics({
  writeKey: "<YOUR_SEGMENT_WRITE_KEY>",
});

segment.track({
  userId: id,
  event: "Order Completed",
  properties: {
    payment_processor: "stripe",
    order_id: "ORD_123",
    currency: "USD",
    revenue: 1000,
  },
  integrations: {
    All: true,
  },
});
```

一旦事件被跟踪，Segment 将根据您配置的映射将销售数据转发给 Dub。
