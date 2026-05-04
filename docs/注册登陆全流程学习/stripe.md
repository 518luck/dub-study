# Stripe 是什么

    Stripe 是一个第三方支付平台。

你可以把它理解成：

- 你的网站自己不直接处理银行卡扣款
- 而是接入 Stripe
- 让 Stripe 帮你做：
  - 收钱
  - 订阅续费
  - 管理账单
  - 处理支付失败
  - 有时也能帮你打款给别人

所以它有点像：

- 支付宝/微信支付的“国际 SaaS 平台版”
- 但更偏开发者接入、网站订阅、平台结算

# 这个项目为什么会有 Stripe

因为这个项目不只是短链工具，它还有：

- 付费套餐
- 订阅
- 发票
- payout
- partner / commission

所以它需要一个支付系统来做两类事情：

- 用户给平台付钱
- 平台给合作伙伴/外部账户打钱

而 Stripe 正好都能做。

# 先只记两种 Stripe 业务

你现在只要先记住两类：

第一类：收自己的钱
比如：

- 用户购买 Dub 的 Pro 套餐
- 每月付费续订

这时候 Stripe 做的是：

- 向用户收费
- 记录订阅
- 自动续费
- 处理付款失败

这对应你看到的：

- stripeId
- plan
- billingCycleStart
- paymentFailedAt

这里的 stripeId 可以先理解成：

- 这个 workspace 在 Stripe 上的“订阅记录编号”

第二类：给别人打钱 / 连接收款账户
比如：

- 这个平台有合作伙伴
- 合作伙伴赚了佣金
- 平台要把钱打给他们

或者：

- 平台要连接某个商家的 Stripe 账户

这时候用的是 Stripe Connect。

这对应你看到的：

- stripeConnectId

它可以先理解成：

- 这个 workspace 绑定的 Stripe 收款/结算账户编号

4. 为什么会有两个 ID
   因为是两种完全不同的业务对象。

你可以类比成：

- stripeId
  - 像你在健身房办的会员续费合同编号
  - 你是付款方
- stripeConnectId
  - 像你在平台上注册的收款账户编号
  - 你是收款/结算方

所以不是一个东西。

5. 一个生活化例子
   假设你做了一个 SaaS 平台：

- 用户每月给你 99 元订阅费
- 你还允许创作者入驻平台赚钱
- 你每月给创作者结算收入

那么你可能会需要：

- Stripe Subscription
  - 管理用户每月给你付的 99 元
- Stripe Connect
  - 管理你怎么把钱打给创作者

这就是这两个字段背后的区别。

6. 放回这个项目
   这个项目里：

- Project 实际上更像 workspace
- 一个 workspace 既可能：
  - 自己订阅平台套餐
  - 又可能参与 partner / payout / commission 这类结算能力

所以在同一张表里同时看到：

- stripeId
- stripeConnectId

是合理的。

7. 最短记忆法
   你现在先这么记，不用更复杂：

- Stripe = 平台接入的支付系统
- stripeId = 用来记这个 workspace 的订阅/付款记录
- stripeConnectId = 用来记这个 workspace 的收款/打款连接账户

8. 你当前最需要避免的误区
   不要把 Stripe 理解成“只是支付一下”。

它通常同时管：

- 收钱
- 订阅
- 发票
- 扣费失败
- 打款
- 平台结算

这就是为什么表里会有好几个 Stripe 相关字段。
