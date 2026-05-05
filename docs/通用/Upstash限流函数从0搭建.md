# `apps/web/lib/upstash/ratelimit.ts` 是怎么搭建的

这篇文档不是只解释这一段代码：

```ts
export const ratelimit = (
  requests: number = 10,
  seconds:
    | `${number} ms`
    | `${number} s`
    | `${number} m`
    | `${number} h`
    | `${number} d` = "10 s",
) => {
  return new Ratelimit({
    redis: redis,
    limiter: Ratelimit.slidingWindow(requests, seconds),
    analytics: true,
    prefix: "dub",
    timeout: 1000,
  });
};
```

而是把它放回整个项目里，讲清楚它为什么这样写、依赖什么、怎么被业务调用、以及你如果从 0 开始，怎么一步一步搭出一个一模一样的版本。

相关源码位置：

- [`apps/web/lib/upstash/ratelimit.ts`](/home/duoyun/idea/open-source/dub/apps/web/lib/upstash/ratelimit.ts:1)
- [`apps/web/lib/upstash/redis.ts`](/home/duoyun/idea/open-source/dub/apps/web/lib/upstash/redis.ts:1)
- [`apps/web/lib/auth/rate-limit-request.ts`](/home/duoyun/idea/open-source/dub/apps/web/lib/auth/rate-limit-request.ts:1)
- [`apps/web/app/api/unsplash/search/route.ts`](/home/duoyun/idea/open-source/dub/apps/web/app/api/unsplash/search/route.ts:1)
- [`apps/web/lib/actions/send-otp.ts`](/home/duoyun/idea/open-source/dub/apps/web/lib/actions/send-otp.ts:1)

## 1. 先看这个项目里的设计思路

这个项目的限流实现很简单，但设计是对的。核心思路只有三层：

1. 最底层：先初始化一个 Upstash Redis 客户端。
2. 中间层：封装一个 `ratelimit()` 工厂函数，统一创建限流器实例。
3. 业务层：在接口、鉴权、Server Action 里按场景传入不同的规则和不同的标识符 `identifier`。

也就是说，这个项目不是把“限流规则”写死在一个类里，而是：

- Redis 连接统一管理
- 限流器创建统一管理
- 每个业务自己决定“限谁”“限多少”“限多久”

这就是它可复用的关键。

## 2. 这个函数依赖了什么

`ratelimit.ts` 自己只有两行 import：

```ts
import { Ratelimit } from "@upstash/ratelimit";
import { redis } from "./redis";
```

所以你要从 0 复刻它，先得明白它依赖两样东西：

### 2.1 `@upstash/ratelimit`

这是 Upstash 官方的限流库，负责：

- 提供 `Ratelimit` 类
- 提供不同算法，比如 `fixedWindow`、`slidingWindow`
- 提供 `.limit(identifier)` 这种调用方式

### 2.2 `redis`

这个不是 Node 本地内存，而是 Upstash Redis。

项目里的实现见 [`apps/web/lib/upstash/redis.ts`](/home/duoyun/idea/open-source/dub/apps/web/lib/upstash/redis.ts:1)：

```ts
export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL || "",
  token: process.env.UPSTASH_REDIS_REST_TOKEN || "",
});
```

意思很直接：

- Redis 地址来自环境变量 `UPSTASH_REDIS_REST_URL`
- Redis token 来自环境变量 `UPSTASH_REDIS_REST_TOKEN`

所以限流并不是“内存计数器”，而是“把计数写到 Redis 里”。

## 3. `ratelimit.ts` 每一行到底在干什么

源码：

```ts
export const ratelimit = (
  requests: number = 10,
  seconds:
    | `${number} ms`
    | `${number} s`
    | `${number} m`
    | `${number} h`
    | `${number} d` = "10 s",
) => {
  return new Ratelimit({
    redis: redis,
    limiter: Ratelimit.slidingWindow(requests, seconds),
    analytics: true,
    prefix: "dub",
    timeout: 1000,
  });
};
```

逐行拆开看：

### 3.1 `ratelimit` 不是一个实例，而是一个工厂函数

它不是：

```ts
export const ratelimit = new Ratelimit(...)
```

而是：

```ts
export const ratelimit = (requests, seconds) => new Ratelimit(...)
```

这样做的意义是：

- 不同业务可以传不同规则
- 一个地方统一创建限流器
- 业务代码只关心“我要 2 次 / 1 分钟”还是“10 次 / 10 秒”

例如项目里就有这些调用：

- `ratelimit(2, "1 m")`
- `ratelimit(5, "1 h")`
- `ratelimit(1, "5 s")`
- `ratelimit(10, "10 s")`

### 3.2 `requests`

```ts
requests: number = 10;
```

表示一个时间窗口内最多允许几次请求。

例如：

- `requests = 2` 表示最多 2 次
- `requests = 10` 表示最多 10 次

### 3.3 `seconds`

```ts
seconds: `${number} s` | `${number} m` | ...
```

这个变量名叫 `seconds`，但实际含义不是“只能传秒”，而是“时间窗口字符串”。

支持：

- `"500 ms"`
- `"10 s"`
- `"1 m"`
- `"1 h"`
- `"1 d"`

这里用了 TypeScript 模板字符串类型，目的是在写代码时就约束格式，避免你传出 `"abc"` 这种无效值。

### 3.4 `limiter: Ratelimit.slidingWindow(requests, seconds)`

这是最核心的一行。

它表示这个项目选用的是“滑动窗口限流”。

滑动窗口和固定窗口相比，更平滑，边界抖动更小。

举个例子：

- 如果用固定窗口，用户可能在 `00:00:59` 连续打满一波
- 然后在 `00:01:00` 又立刻再打满一波
- 这样会出现短时间内突刺很高的问题

滑动窗口就是为了减轻这种问题。

所以这项目的选择很合理：默认走 `slidingWindow`。

### 3.5 `analytics: true`

表示开启 Upstash 的统计分析。

作用通常是：

- 方便在 Upstash 后台看限流情况
- 看哪些 key 打得最多
- 看哪些规则触发频繁

不是限流必需项，但对于线上排查非常有价值。

### 3.6 `prefix: "dub"`

表示 Redis 里所有限流相关 key 都会带统一前缀。

作用：

- 避免和别的业务 key 冲突
- 方便排查
- 方便未来迁移或清理

如果你从 0 搭建自己的项目，可以改成：

- `"myapp"`
- `"my-project"`
- `"rate-limit"`

原则只有一个：稳定、可辨识。

### 3.7 `timeout: 1000`

表示这次限流判断最多等 1000ms。

意思不是“1 秒后重置限流”，而是“访问 Redis 做限流判断时，最多等待 1 秒”。

这个配置的目的主要是：

- 防止 Redis 抖动把接口整体拖死
- 给接口一个失败上限

这个项目没有在这里做更复杂的降级逻辑，但至少先限制了等待时间，这是合理的。

## 4. 真正触发限流的是 `.limit(identifier)`

很多人刚看这段代码会误会：以为 `ratelimit(2, "1 m")` 就已经限流了。

其实不是。

真正执行判断的是：

```ts
await ratelimit(2, "1 m").limit(identifier);
```

这里的 `identifier` 才是关键。

你可以理解成：

- 前面是在“定义规则”
- 后面是在“告诉系统要限谁”

如果没有 `identifier`，系统就不知道计数挂在哪个对象上。

## 5. 这个项目里，`identifier` 是怎么设计的

这部分才是限流能不能真正用好的关键。

### 5.1 按 IP 限流

例如 [`apps/web/app/api/unsplash/search/route.ts`](/home/duoyun/idea/open-source/dub/apps/web/app/api/unsplash/search/route.ts:1)：

```ts
const ip = ipAddress(req);
const { success } = await ratelimit(10, "10 s").limit(`unsplash:${ip}`);
```

这里的意思是：

- 对 `unsplash` 搜索接口做限流
- 维度是 IP
- 同一个 IP，10 秒最多 10 次

注意它没有直接用 `ip`，而是用了：

```ts
`unsplash:${ip}`;
```

这是非常重要的习惯，因为它把“业务域”也放进 key 了。

否则如果你系统里多个接口都直接拿 `ip` 当 key，不同接口的限流可能互相污染。

### 5.2 按“邮箱 + IP”限流

例如 [`apps/web/lib/actions/send-otp.ts`](/home/duoyun/idea/open-source/dub/apps/web/lib/actions/send-otp.ts:1)：

```ts
const { success } = await ratelimit(2, "1 m").limit(
  `send-otp:${email}:${await getIP()}`,
);
```

这是比“只按 IP”更细的策略。

它的含义是：

- 同一个邮箱
- 从同一个 IP
- 1 分钟最多请求 2 次 OTP

为什么这样设计？

- 只按 IP：同一公司、同一校园网、同一 NAT 出口可能误伤很多人
- 只按邮箱：攻击者可以换邮箱疯狂刷
- 邮箱 + IP：更平衡

### 5.3 统一返回限流响应头

例如 [`apps/web/lib/auth/rate-limit-request.ts`](/home/duoyun/idea/open-source/dub/apps/web/lib/auth/rate-limit-request.ts:1)：

```ts
const { success, limit, reset, remaining } = await ratelimit(
  requests,
  interval,
).limit(identifier);

return {
  success,
  headers: {
    "Retry-After": reset.toString(),
    "X-RateLimit-Limit": limit.toString(),
    "X-RateLimit-Remaining": remaining.toString(),
    "X-RateLimit-Reset": reset.toString(),
  },
};
```

这说明项目里不只是“拦截”，还在做“可观测性”。

客户端或者调用方能知道：

- 总额度是多少
- 还剩多少次
- 什么时候重置
- 应该多久后重试

这是标准做法，建议你从 0 搭建时也一起带上。

## 6. 从 0 开始，搭一个一模一样的版本

下面给一套最小可用方案。你可以把它放到 Next.js 项目，也可以放到普通 Node/TypeScript 项目。

### 第一步：安装依赖

```bash
npm install @upstash/redis @upstash/ratelimit
```

### 第二步：准备 Upstash Redis

你需要先在 Upstash 创建一个 Redis 数据库，然后拿到两个环境变量：

```env
UPSTASH_REDIS_REST_URL=...
UPSTASH_REDIS_REST_TOKEN=...
```

如果你是 Next.js 项目，一般写到 `.env` 或 `.env.local`。

### 第三步：新建 Redis 客户端

文件：`lib/upstash/redis.ts`

```ts
import { Redis } from "@upstash/redis";

export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL || "",
  token: process.env.UPSTASH_REDIS_REST_TOKEN || "",
});
```

这一步就是把 Redis 连接单独抽出来，不要写死在限流文件里。

### 第四步：新建限流工厂函数

文件：`lib/upstash/ratelimit.ts`

```ts
import { Ratelimit } from "@upstash/ratelimit";
import { redis } from "./redis";

export const ratelimit = (
  requests: number = 10,
  window:
    | `${number} ms`
    | `${number} s`
    | `${number} m`
    | `${number} h`
    | `${number} d` = "10 s",
) => {
  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(requests, window),
    analytics: true,
    prefix: "your-app",
    timeout: 1000,
  });
};
```

注意：

- 我这里把参数名写成 `window`，比 `seconds` 更准确
- 但如果你要完全复刻当前项目，名字也可以继续叫 `seconds`

### 第五步：导出统一入口

文件：`lib/upstash/index.ts`

```ts
export * from "./redis";
export * from "./ratelimit";
```

这样业务侧可以直接：

```ts
import { ratelimit } from "@/lib/upstash";
```

这也是当前项目在做的事，见 [`apps/web/lib/upstash/index.ts`](/home/duoyun/idea/open-source/dub/apps/web/lib/upstash/index.ts:1)。

### 第六步：在接口里使用

假设你有一个登录接口：

文件：`app/api/login/route.ts`

```ts
import { ratelimit } from "@/lib/upstash";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";

  const { success, limit, remaining, reset } = await ratelimit(5, "1 m").limit(
    `login:${ip}`,
  );

  if (!success) {
    return NextResponse.json(
      { error: "Too many requests" },
      {
        status: 429,
        headers: {
          "Retry-After": reset.toString(),
          "X-RateLimit-Limit": limit.toString(),
          "X-RateLimit-Remaining": remaining.toString(),
          "X-RateLimit-Reset": reset.toString(),
        },
      },
    );
  }

  return NextResponse.json({ ok: true });
}
```

这个最小例子已经具备完整闭环：

- 有规则
- 有 identifier
- 有拒绝分支
- 有响应头

### 第七步：在 Server Action 里使用

如果你不是 Route Handler，而是 Server Action，也一样能用：

```ts
"use server";

import { ratelimit } from "@/lib/upstash";

export async function sendCode(email: string, ip: string) {
  const { success } = await ratelimit(2, "1 m").limit(
    `send-code:${email}:${ip}`,
  );

  if (!success) {
    throw new Error("Too many requests. Please try again later.");
  }

  // 真正业务逻辑
}
```

这和当前项目里的 `send-otp` 做法一致，只是我把例子简化了。

## 7. 为什么这个项目要封装成工厂函数，而不是到处 `new Ratelimit`

假设你不封装，业务里就会到处出现：

```ts
new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, "1 m"),
  analytics: true,
  prefix: "dub",
  timeout: 1000,
});
```

问题会马上出现：

- 重复代码太多
- `prefix` 容易有人写错
- `analytics` 容易有人忘记开
- `timeout` 容易配置不一致
- 后续要统一改策略时很痛苦

封装成工厂函数后，业务只需要关心两件事：

- 限多少次
- 限谁

这就是一个好封装该做的边界。

## 8. 从工程角度看，这套实现的优点

### 8.1 接入成本低

业务里几乎只要一行：

```ts
await ratelimit(5, "1 m").limit(`login:${ip}`);
```

### 8.2 规则灵活

每个场景都能自己决定：

- 1 秒 1 次
- 1 分钟 5 次
- 1 小时 10 次
- 24 小时 3 次

### 8.3 维度灵活

可以按不同标识符限流：

- IP
- userId
- email
- workspaceId
- `email + ip`
- `action + resource + ip`

### 8.4 可观测

开启了 `analytics`，而且项目里有地方会把 `limit`、`remaining`、`reset` 暴露出去。

## 9. 你从 0 搭建时，最容易犯的错

### 9.1 把 `identifier` 设计得太粗

错误例子：

```ts
await ratelimit(5, "1 m").limit(ip);
```

如果很多接口都只用 `ip`，不同接口可能共用同一份额度。

更好的写法：

```ts
await ratelimit(5, "1 m").limit(`login:${ip}`);
await ratelimit(10, "1 m").limit(`search:${ip}`);
```

要把“业务名”带进去。

### 9.2 把 `identifier` 设计得太细

错误例子：

```ts
await ratelimit(5, "1 m").limit(`login:${ip}:${Date.now()}`);
```

这样每次都是新 key，等于完全没限流。

原则是：

- 要稳定
- 要能代表被限对象
- 不能每次请求都变

### 9.3 只做拦截，不返回 429

很多人只写：

```ts
if (!success) throw new Error("too many requests");
```

对于 HTTP 接口，更规范的做法应该是返回：

- 状态码 `429`
- `Retry-After`
- `X-RateLimit-*` 头

### 9.4 没想清楚按什么维度限

不同业务，维度不同：

- 登录尝试：通常按 IP、账号、邮箱、设备组合
- 发验证码：通常按邮箱 + IP
- 搜索接口：通常按 IP 或 userId
- 管理后台写操作：通常按 userId 或 workspaceId

限流不是“统一都按 IP”就结束了。

## 10. 如果你想做得比当前项目再稳一点，可以补什么

当前实现已经够实用，但从工程上还可以继续增强。

### 10.1 给 Redis 配置显式失败策略

例如你可以决定：

- Redis 超时就直接放行
- Redis 超时就拒绝请求

当前这份代码主要做了 `timeout: 1000`，但没在外层显式写降级策略。

### 10.2 抽一个统一的 `rateLimitRequest` 帮助函数

当前项目已经有类似实现，见 [`apps/web/lib/auth/rate-limit-request.ts`](/home/duoyun/idea/open-source/dub/apps/web/lib/auth/rate-limit-request.ts:1)。

这种做法适合统一返回 headers，减少重复代码。

### 10.3 把参数名 `seconds` 改成 `window`

因为它实际上支持：

- `ms`
- `s`
- `m`
- `h`
- `d`

所以 `window` 或 `duration` 会比 `seconds` 更准确。

这不是功能问题，是命名精度问题。

## 11. 一份“几乎一样但更适合你自己新项目”的版本

如果我要在新项目里重写，我会写成这样：

```ts
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL || "",
  token: process.env.UPSTASH_REDIS_REST_TOKEN || "",
});

type RateLimitWindow =
  | `${number} ms`
  | `${number} s`
  | `${number} m`
  | `${number} h`
  | `${number} d`;

export function createRateLimit(
  requests: number = 10,
  window: RateLimitWindow = "10 s",
) {
  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(requests, window),
    analytics: true,
    prefix: "your-app",
    timeout: 1000,
  });
}
```

业务使用：

```ts
const { success } = await createRateLimit(2, "1 m").limit(
  `send-otp:${email}:${ip}`,
);
```

和原项目的核心思路完全一致，只是命名稍微更清楚。

## 12. 最后总结成一句话

这个项目里的限流函数，本质上就是：

- 用 `@upstash/redis` 连接 Redis
- 用 `@upstash/ratelimit` 创建滑动窗口限流器
- 用工厂函数统一配置
- 在业务里通过 `.limit(identifier)` 按不同维度执行限流

如果你要从 0 搭一个一样的，最小路径就是：

1. 创建 Upstash Redis
2. 配环境变量
3. 建 `redis.ts`
4. 建 `ratelimit.ts`
5. 在接口或 Server Action 里传规则和 `identifier`
6. 命中时返回 `429`

如果你后面愿意，我可以继续在这个 `docs/通用` 目录里再补一篇：

- “Dub 项目所有限流调用点逐个解读”

或者直接帮你把这篇文档再扩成：

- “含时序图 + 请求流转图 + Redis key 示例”的版本。
