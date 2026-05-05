# next-safe-action

## 先记住它是干什么的

`next-safe-action` 是一个给 Next.js Server Action 加“类型安全、参数校验、统一错误处理、中间件能力”的库。

你可以先把它理解成：

- 前端可以更安全地调用服务端 action
- 服务端可以统一校验输入
- 报错格式可以统一
- 可以像后端框架一样给 action 加中间件

如果只看一句话：

`next-safe-action` = “带校验和类型的 Server Action 封装层”

---

## 它解决了什么问题

如果不用它，普通 Server Action 往往会遇到这些问题：

- 前端传什么字段，没有统一约束
- 服务端参数校验要自己手写
- 错误返回格式不统一
- 权限校验、登录校验、上下文注入容易重复写

用了 `next-safe-action` 以后，一般会变成这样：

- 输入先过 schema 校验
- 前端和后端共享类型
- 前端能拿到结构化错误
- 登录校验、权限校验可以抽成 `.use(...)` 中间件

---

## 你先记住这几个概念

- `createSafeActionClient()`：创建一个 action 客户端
- `actionClient`：项目里统一复用的 action 基类
- `.inputSchema(schema)`：给 action 定义输入校验规则
- `.use(middleware)`：给 action 挂中间件
- `.action(async () => {})`：写真正的服务端逻辑
- `useAction(action)`：前端调用 action 的 Hook
- `execute()` / `executeAsync()`：真正触发 action
- `isPending`：前端调用过程中是否正在提交
- `serverError` / `validationErrors`：前端拿到的结构化错误

---

## 一个最小例子

### 服务端

```ts
"use server";

import { createSafeActionClient } from "next-safe-action";
import * as z from "zod/v4";

const actionClient = createSafeActionClient();

const schema = z.object({
  email: z.email(),
});

export const sendDemoAction = actionClient
  .inputSchema(schema)
  .action(async ({ parsedInput }) => {
    const { email } = parsedInput;

    return {
      ok: true,
      email,
    };
  });
```

### 前端

```tsx
"use client";

import { useAction } from "next-safe-action/hooks";
import { sendDemoAction } from "./actions";

export default function Demo() {
  const { executeAsync, isPending } = useAction(sendDemoAction, {
    onSuccess: ({ data }) => {
      console.log(data);
    },
    onError: ({ error }) => {
      console.log(error.serverError);
      console.log(error.validationErrors);
    },
  });

  return (
    <button
      disabled={isPending}
      onClick={() => executeAsync({ email: "test@example.com" })}
    >
      Submit
    </button>
  );
}
```

这个最小例子里你先抓住两点：

- 服务端用 `actionClient.inputSchema(...).action(...)` 定义 action
- 前端用 `useAction(...)` 调用这个 action

---

## 常用 API

### `createSafeActionClient()`

用来创建一个统一的 action 客户端。

比如项目里：

```ts
export const actionClient = createSafeActionClient({
  handleServerError: async (e) => {
    if (e instanceof Error) {
      return e.message;
    }

    return "An unknown error occurred.";
  },
});
```

这表示：

- 所有 action 都共用这个 client
- 所有服务端异常都走统一错误处理

### `.inputSchema(schema)`

给 action 定义输入校验规则。

```ts
const schema = z.object({
  email: emailSchema,
  password: passwordSchema.optional(),
});

actionClient.inputSchema(schema);
```

意思是：

- 前端传过来的输入必须符合这个 schema
- 不符合就不会进入真正的 `.action(...)`

你可以把它理解成：

“先过安检，再进业务逻辑”

### `.use(middleware)`

给 action 加中间件。

比如：

```ts
actionClient.use(async ({ next }) => {
  const session = await getSession();

  if (!session?.user.id) {
    throw new Error("Unauthorized");
  }

  return next({
    ctx: {
      user: session.user,
    },
  });
});
```

作用是：

- 先做登录校验
- 再把 `user` 注入到后续 action 上下文里

这和很多后端框架里的 middleware 很像。

### `.action(async ({ parsedInput, ctx }) => {})`

这里写真正业务逻辑。

```ts
.action(async ({ parsedInput }) => {
  const { email } = parsedInput;
  return { email };
});
```

你最先要记住的是：

- `parsedInput`：已经校验通过的输入
- `ctx`：中间件注入的上下文

### `useAction(action, options?)`

前端调用 action 的 Hook。

```tsx
const { executeAsync, isPending } = useAction(sendOtpAction, {
  onSuccess: () => {},
  onError: ({ error }) => {},
});
```

最常用的是：

- `execute(data)`：触发 action
- `executeAsync(data)`：异步触发 action，适合 `await`
- `isPending`：是否正在请求
- `onSuccess`：成功回调
- `onError`：失败回调

---

## `executeAsync()` 是什么意思

和你前面理解 `register()` 类似，这里也可以从“它到底干了什么”来理解。

```tsx
executeAsync({ email, password });
```

意思是：

- 调用这个服务端 action
- 把 `{ email, password }` 当作输入传过去
- 先让 `next-safe-action` 做 schema 校验
- 校验通过后再执行服务端逻辑
- 最后把结果或错误返回给前端

一句话记忆：

`executeAsync(data)` = “从前端发起一次安全的 server action 调用”

---

## 返回错误一般长什么样

这个库的一个重点就是：错误不是乱的，而是结构化的。

前端通常这样写：

```tsx
onError: ({ error }) => {
  console.log(error.serverError);
  console.log(error.validationErrors);
};
```

一般可以分成两类：

- `serverError`
  服务端业务逻辑里抛出的错误
- `validationErrors`
  输入 schema 校验失败后的字段错误

所以你要区分：

- 是“参数不合法”
- 还是“业务执行失败”

---

## 易错点

1. 不要把它当成普通前端请求库。  
   它不是 `fetch` 的替代品思维，而是“围绕 Server Action 的类型安全封装”。

2. `inputSchema()` 校验失败时，`.action()` 根本不会执行。  
   所以如果你发现业务逻辑没进，先检查 schema。

3. 前端 `onError` 里要区分 `serverError` 和 `validationErrors`。  
   这两个来源不同，处理方式也不同。

4. 中间件里抛出的错误，也会走统一错误处理。  
   所以登录失败、权限失败，前端拿到的通常也是 `serverError`。

5. 不要在前端随便假设 action 一定成功。  
   调用时要考虑 `isPending`、错误提示、重复提交等问题。

6. schema 的类型和业务允许值要一致。  
   否则前端类型看起来能传，实际 schema 又会拦下来。

7. `next-safe-action` 不替代表单库。  
   它解决的是“前后端 action 调用层”，不是输入框状态管理。  
   所以它常常和 `react-hook-form`、`zod` 一起用。

---

## 建议的学习顺序

先只学这 4 个就够了：

1. `createSafeActionClient`
2. `.inputSchema(schema)`
3. `.action(...)`
4. `useAction(...)`

学会这几个后，再看：

1. `.use(...)` 中间件
2. `handleServerError`
3. `validationErrors` 的自定义格式
4. 带上下文的 action client

---

## 项目里怎么用

你这个项目里最关键的两个文件是：

- `apps/web/lib/actions/safe-action.ts`
- `apps/web/lib/actions/send-otp.ts`

### 第一步：先创建统一的 actionClient

在 `apps/web/lib/actions/safe-action.ts` 里：

```ts
export const actionClient = createSafeActionClient({
  handleServerError: async (e) => {
    console.error("Server action error:", e);

    if (e instanceof Error) {
      return e.message;
    }

    return "An unknown error occurred.";
  },
});
```

这里的意思是：

- 项目先创建一个统一的 `actionClient`
- 所有 action 以后都基于它来定义
- 服务端错误会统一格式化成字符串返回给前端

### 第二步：在具体 action 里定义输入规则

在 `apps/web/lib/actions/send-otp.ts` 里：

```ts
const schema = z.object({
  email: emailSchema,
  password: passwordSchema.optional(),
});
```

意思是：

- 这个 action 接收两个字段
- `email` 必须合法
- `password` 可以不传

然后接上：

```ts
export const sendOtpAction = actionClient.inputSchema(schema, {
  handleValidationErrorsShape: async (ve) =>
    flattenValidationErrors(ve).fieldErrors,
});
```

这里做了两件事：

- 用 `schema` 校验输入
- 把 zod 校验错误整理成字段级错误，方便前端展示

### 第三步：给 action 挂中间件

```ts
.use(throwIfAuthenticated)
```

意思是：

- 如果用户已经登录，就不允许再走这个注册发验证码逻辑

这就是中间件式用法。

### 第四步：写真正的业务逻辑

```ts
.action(async ({ parsedInput }) => {
  const { email } = parsedInput;
  ...
});
```

这里的 `parsedInput` 不是原始输入，而是：

- 已经过 schema 校验
- 类型也已经对齐

所以这里可以直接放心用。

后面的业务逻辑主要就是：

- 限流
- 检查邮箱是否合法
- 检查用户是否已存在
- 生成验证码
- 写数据库
- 发邮件

### 第五步：前端通过 `useAction(sendOtpAction)` 调用

在 `apps/web/ui/auth/register/signup-email.tsx` 里：

```tsx
const { executeAsync, isPending } = useAction(sendOtpAction, {
  onSuccess: () => {
    setEmail(getValues("email"));
    setPassword(getValues("password"));
    setStep("verify");
  },
  onError: ({ error }) => {
    toast.error(
      error.serverError ||
        error.validationErrors?.email?.[0] ||
        error.validationErrors?.password?.[0],
    );
  },
});
```

这里的意思是：

- `executeAsync(data)` 用来调用 `sendOtpAction`
- `isPending` 用来控制按钮 loading
- 成功后进入下一步验证页面
- 失败后优先显示服务端错误，否则显示字段校验错误

真正提交时：

```tsx
handleSubmit(async (data) => await executeAsync(data))(e);
```

这说明：

- `react-hook-form` 先收集表单数据
- 再把数据交给 `next-safe-action`
- 然后由 `next-safe-action` 调服务端 action

---

## 把项目这段翻译成人话

这个注册流程里，`next-safe-action` 主要负责的是：

1. 前端调用 `sendOtpAction`
2. 先检查用户传过来的邮箱和密码格式对不对
3. 如果不对，直接返回字段错误
4. 如果对，继续执行发验证码逻辑
5. 如果业务过程出错，返回服务端错误
6. 如果成功，前端进入“验证邮箱”这一步

所以它在这个项目里的定位很清楚：

- 不是负责输入框的
- 不是负责 UI 的
- 而是负责“前端到服务端 action 这一层”的安全调用

---

## 和另外两个库怎么分工

在这个项目里，这三个库是配合关系：

- `react-hook-form`
  负责前端表单状态和提交
- `zod`
  负责定义输入结构和校验规则
- `next-safe-action`
  负责把前端和 Server Action 安全连接起来

你可以把这条链路记成：

1. 用户输入内容
2. `react-hook-form` 收集数据
3. `next-safe-action` 发起 action 调用
4. `zod` 校验输入
5. 服务端执行业务逻辑
6. 把成功或错误结果返回前端

---
