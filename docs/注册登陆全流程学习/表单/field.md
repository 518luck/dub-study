# shadcn Field 组件

## 总览

这套组件不是为了增加业务功能，而是为了把表单结构规范化。

一句话理解：

- `Field` 管一个字段
- `FieldGroup` 管一组字段
- `FieldSet` 管一整块有主题的字段区域

它们本身不处理业务，不存数据，不发请求，也不负责真正的校验逻辑。它们主要提供的是：

- 统一结构
- 统一样式
- 统一可访问性约定
- 统一组合方式

如果只用 `div`，当然也能写表单。但在真实项目里，常见问题会很快出现：

- 间距不一致
- 错误文案样式不一致
- `label` 和控件关系有时没连好
- `description`、`error` 的层级不一致
- `checkbox`、`switch`、`input` 横竖排版各写一套

所以 `Field` 体系的意义不是“比 `div` 多干了业务”，而是“比 `div` 多干了规范化”。

# Field

## 官方定义

> A single control with label, helper text, and validation.

可以直白理解成：

“一个完整的表单项，包含标题、输入控件、辅助说明和校验错误提示。”

这里的 `validation` 不表示 `Field` 自己负责校验，而是说它承担“校验结果的展示位置”。

## 官方结构

```text
Field
├── FieldLabel
├── Input / Textarea / Switch / Select
├── FieldDescription
└── FieldError
```

## 它是什么

`Field` 是单个表单项的外层容器。

它表达的是：

- 这里是一个完整的字段
- 这个字段下面的标签、控件、说明、报错属于同一组

它本身不是输入框，也不是校验器，更像一个“字段外壳”或“表单项模板”。

## 每一层分别干什么

### FieldLabel

`FieldLabel` 就是字段标题，也就是用户看到的名字，比如：

- 用户名
- 邮箱
- 密码

它的作用是告诉用户“这个输入框是干什么的”。

通常会通过 `htmlFor` 关联具体控件，例如：

```tsx
<FieldLabel htmlFor="email">Email</FieldLabel>
```

这样点击标签时，也能聚焦到输入框，交互和可访问性都会更好。

### Input / Textarea / Switch / Select

这一层是真正让用户交互的控件本体。

它可以是任何表单控件，比如：

- `Input`
- `Textarea`
- `Switch`
- `Select`
- `Checkbox`
- `Radio Group`

也就是说，`Field` 不是某一种输入控件，而是“给各种控件套上一层统一字段结构”。

### FieldDescription

`FieldDescription` 是辅助说明文字。

它的作用通常是：

- 告诉用户应该怎么填
- 解释这个字段的用途
- 给出额外提示

比如：

- 密码至少 8 位
- 我们不会公开你的邮箱
- 请输入公司名称而不是个人昵称

它不是报错信息，而是正常状态下的说明。

### FieldError

`FieldError` 是校验失败时显示的错误信息。

比如：

- 邮箱格式不正确
- 密码不能为空
- 用户名已被占用

它只是在界面上负责展示错误，不负责真正“做校验”。

真正的校验逻辑通常来自：

- `react-hook-form`
- `zod`
- `tanstack form`

所以可以把它理解成“错误展示层”。

## 它和 div 的区别

`div` 只是一个“空盒子”，`Field` 是一个“有约定的盒子”。

如果只用 `div`，也完全可以写出一个表单项：

```tsx
<div>
  <label htmlFor="email">Email</label>
  <input id="email" />
  <p>We will not share your email.</p>
  <p>Email is required.</p>
</div>
```

这当然能跑。

但 `Field` 的价值在于，它把这些本来每次都要手写、而且容易写乱的约定封装起来了。

所以它不是在封装业务，而是在封装 UI 规范和表单结构规范。

## 一句话理解

`Field` 是单个表单项的模板。

# FieldGroup

## 官方定义

> Related fields in one group. Use `FieldSeparator` between sections when needed.

可以直白理解成：

“把彼此相关的多个表单项放进同一组里；如果组内需要分段，就用 `FieldSeparator` 分开。”

## 官方结构

```text
FieldGroup
├── Field
│   ├── FieldLabel
│   ├── Input / Textarea / Switch / Select
│   ├── FieldDescription
│   └── FieldError
├── FieldSeparator
└── Field
    ├── FieldLabel
    └── Input / Textarea / Switch / Select
```

## 它是什么

`FieldGroup` 用来把多个相关的 `Field` 组织成一个组。

单个 `Field` 只负责一个字段，但真实表单里，很多字段其实不是孤立的，而是属于同一块信息，比如：

- 登录信息：邮箱、密码
- 个人资料：姓名、昵称、手机号
- 地址信息：省、市、详细地址
- 通知设置：邮件通知、短信通知、推送通知

`FieldGroup` 的作用就是明确表达：

- 这一批字段是相关的
- 它们应该作为一个整体排列
- 它们之间的间距、分隔、结构应该统一

所以它可以看成是“多个 `Field` 的组织层”。

## 它和 Field 的关系

它们的关系可以这样理解：

- `Field` 管一个字段
- `FieldGroup` 管一组字段

也就是：

- `Field` 解决“单个表单项别写乱”
- `FieldGroup` 解决“一组表单项别摆乱”

## FieldSeparator 是什么

`FieldSeparator` 是组内分隔线，用来把同一个 `FieldGroup` 里的不同小段落分开。

它适合这种场景：

- 一组设置项里分成“基础设置”和“高级设置”
- 一组通知项里分成“系统通知”和“营销通知”
- 一组地址项里分成“收货地址”和“发票地址”

它的意义不是新增业务逻辑，而是让组内结构更清晰。

所以 `FieldSeparator` 本质上是一个视觉和结构分段工具。

## 怎么理解结构图

这张图表达的是：

1. `FieldGroup` 是最外层
2. 里面放多个 `Field`
3. 每个 `Field` 还是各自有自己的标题、控件、说明、报错
4. 如果两个区域之间需要明显切开，就插入 `FieldSeparator`

也就是说，`FieldGroup` 并不会替代 `Field`，而是在更高一层把多个 `Field` 管起来。

## 一个直观例子

比如“通知设置”这个区域：

```tsx
<FieldGroup>
  <Field>
    <FieldLabel htmlFor="email-notify">Email notifications</FieldLabel>
    <Switch id="email-notify" />
    <FieldDescription>Receive updates by email.</FieldDescription>
  </Field>

  <FieldSeparator />

  <Field>
    <FieldLabel htmlFor="sms-notify">SMS notifications</FieldLabel>
    <Switch id="sms-notify" />
  </Field>
</FieldGroup>
```

这个结构表达的是：

- 这是同一个设置组
- 里面有两个相关字段
- 中间用分隔线切开
- 每个字段仍然保留自己完整的结构

## 它和 div 的区别

如果只用 `div`，你当然也能把几个字段包起来。

但 `FieldGroup` 的价值在于它给“多个相关字段的组合”也建立了统一约定：

- 哪些字段属于同一组
- 组内怎么排列
- 什么时候应该分段
- 分段时用什么统一结构

所以它不是普通容器，而是“字段组容器”。

## 一句话理解

`FieldGroup` 是多个相关表单项的模板。

# FieldSet

## 官方定义

> Semantic grouping with a legend and description, usually containing a `FieldGroup`.

可以直白理解成：

“用带标题和说明的语义化方式，把一整组字段包起来，里面通常放一个 `FieldGroup`。”

## 官方结构

```text
FieldSet
├── FieldLegend
├── FieldDescription
└── FieldGroup
    ├── Field
    │   ├── FieldLabel
    │   ├── Input / Textarea / Switch / Select
    │   ├── FieldDescription
    │   └── FieldError
    └── Field
        ├── FieldLabel
        └── Input / Textarea / Switch / Select
```

## 它是什么

`FieldSet` 管的是“更完整的一整块表单区域”。

比如下面这些都很适合用 `FieldSet`：

- 收货地址
- 支付方式
- 账号安全设置
- 通知偏好设置
- 发票信息

因为这些内容不只是“几个字段摆在一起”，而是一个有明确主题的表单区块。

## 它和 FieldGroup 的区别

这是最容易混淆的地方。

可以这样区分：

- `FieldGroup` 强调的是“把几个字段组织在一起”
- `FieldSet` 强调的是“这几个字段从语义上属于同一个主题区域”

也就是说：

- `FieldGroup` 更偏布局和组合
- `FieldSet` 更偏语义和区块表达

你可以把它理解成：

- `FieldGroup` 是字段组
- `FieldSet` 是字段章节

## FieldLegend 是什么

`FieldLegend` 是这整个区块的标题。

比如：

- Address Information
- Payment Method
- Notification Preferences

它不是单个字段的标题，而是“一整组字段的总标题”。

所以：

- `FieldLabel` 是单个字段的名字
- `FieldLegend` 是整个字段区块的名字

## FieldDescription 在这里是什么意思

这里的 `FieldDescription` 不再是某一个输入框下面的小提示，而是整个区块的说明文字。

比如：

- 我们需要你的地址来配送订单
- 你的支付信息将被安全加密
- 请选择你希望接收通知的方式

也就是说，放在 `FieldSet` 里的 `FieldDescription` 是“区块说明”，不是“字段说明”。

## 为什么里面通常包含 FieldGroup

因为 `FieldSet` 负责定义“这是哪一块内容”，而真正具体的字段排列，一般还是交给 `FieldGroup`。

所以常见结构是：

1. `FieldSet` 先定义一个语义化区块
2. `FieldLegend` 写区块标题
3. `FieldDescription` 写区块说明
4. `FieldGroup` 再把里面多个 `Field` 排列起来

## 一个直观例子

比如“地址信息”：

```tsx
<FieldSet>
  <FieldLegend>Address Information</FieldLegend>
  <FieldDescription>
    We need your address to deliver your order.
  </FieldDescription>

  <FieldGroup>
    <Field>
      <FieldLabel htmlFor="street">Street Address</FieldLabel>
      <Input id="street" />
    </Field>

    <Field>
      <FieldLabel htmlFor="city">City</FieldLabel>
      <Input id="city" />
    </Field>
  </FieldGroup>
</FieldSet>
```

这个结构表达的是：

- 这是一个叫“地址信息”的表单区块
- 这块区块有一段统一说明
- 里面包含多个具体字段
- 这些字段作为一个组被组织起来

## 它和 div 的区别

如果只用 `div`，当然也能包出一个区域。

但 `FieldSet` 的价值在于，它不是单纯“包起来”，而是在表达：

- 这是一个完整的表单主题区块
- 这个区块有标题
- 这个区块有整体说明
- 这个区块下面有一组相关字段

所以它不是普通容器，而是“语义化的表单分区容器”。

## 一句话理解

`FieldSet` 是一整块有主题的字段区域模板。

## 最后总结

可以把这三层关系记成：

1. `Field`：一个字段
2. `FieldGroup`：一组字段
3. `FieldSet`：一个有主题的字段区域

如果只写小页面，直接 `div` 也能做。

但如果是长期项目、后台系统、组件库或者多人协作项目，这套结构会更稳定，因为它可以：

- 让所有表单项长得一致
- 更方便做横向、纵向、分组布局
- 降低每次手写表单结构的重复劳动
- 减少因为写法不统一导致的维护成本
- 后续全局改样式时，只需要改这一层
