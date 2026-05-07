# Session 笔记

## 1. Session 是什么

Session 可以理解成：

- 用户登录成功以后，系统用来“记住这个人已经登录”的那份状态
- 后续每次请求，系统靠它判断当前用户是谁

如果没有 session：

- 用户每请求一次都要重新输账号密码

所以登录流程通常不是：

- 登录一次，以后永远不校验

而是：

- 登录一次
- 服务端签发一个会话标识
- 后续请求带着它

---

## 2. Session 常见两种存法

Auth.js / NextAuth 常见两种策略：

1. `database session`
2. `jwt session`

### database session

特点：

- 浏览器 cookie 里通常放一个 `sessionToken`
- 真正的会话记录存在数据库 `Session` 表里
- 每次请求时，服务端拿 `sessionToken` 去数据库查

数据库大致会有这种表：

```prisma
model Session {
  id           String   @id @default(cuid())
  sessionToken String   @unique
  userId       String
  expires      DateTime
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
}
```

### jwt session

特点：

- 会话信息主要存在 cookie 里的 JWT
- 服务端读取 cookie 后验证 JWT，就能知道当前用户是谁
- 不一定依赖数据库 `Session` 表

---

## 3. cookie 和 Session 表的区别

### 存到 cookie / JWT

优点：

- 少一次数据库查询
- 更轻量
- 更适合 serverless / 高频请求场景

缺点：

- 想立刻让某个用户下线没那么直接
- 已经发出去的 token 在过期前通常都还能用
- 如果想强制失效，往往要额外做黑名单、版本号之类的逻辑

### 存到 Session 表

优点：

- 服务端集中控制会话
- 更容易做“踢下线”
- 更容易做“查看当前登录设备”“删除某个设备会话”

缺点：

- 每次读取 session 更依赖数据库
- 比 JWT 多一次查库成本

---

## 4. 为什么数据库 session 更容易踢下线

因为数据库 session 的核心逻辑是：

1. 浏览器只保存 `sessionToken`
2. 服务端每次请求都去数据库查这条 session 还在不在
3. 如果数据库里没了，就视为未登录

所以踢下线时，你只要删掉数据库那条 session：

```ts
await prisma.session.delete({
  where: {
    sessionToken: "xxx",
  },
});
```

用户下一次请求虽然还带 cookie，但服务端查不到记录，就直接失效。

一句话：

- `database session`：删数据库记录即可下线
- `jwt session`：token 发出去后，天然没那么好立刻作废

---

## 5. Dub 当前用的是哪种

Dub 当前配置里明确写的是：

```ts
session: {
  strategy: "jwt";
}
```

也就是说：

- Dub 当前主流程用的是 `jwt session`
- 不是 `database session`

对应文件：

- `apps/web/lib/auth/options.ts`

---

## 6. Dub 为什么还有 Session 表

根据当前仓库代码能确认的是：

1. Dub 使用了 Prisma Adapter
2. schema 里保留了标准认证模型
3. 当前配置选的是 `jwt`
4. 代码里没有看到业务层直接操作 `prisma.session`

所以更准确的理解是：

- `Session` 表被保留在标准 auth schema 里
- 但当前主流程并不依赖它做会话存储

可以把它理解成：

- 表结构保留了兼容性
- 运行策略选择了 JWT

---

## 7. 默认是 JWT，是否说明 JWT 一定更好

不说明。

“默认”通常只代表：

- 更轻量
- 更通用
- 对很多项目更方便起步

不代表它在所有场景都更好。

怎么选主要看需求：

### 适合 JWT 的场景

- 先快速搭登录
- 不急着做复杂会话管理
- 更偏向轻量和简单

### 适合 database session 的场景

- 要强制用户下线
- 要看用户当前登录了哪些设备
- 要服务端集中管理会话

---

## 8. 我现在该怎么选

如果你当前目标是：

- 学注册登录
- 学 NextAuth / Auth.js
- 学 Dub 的整体思路
- 先把主流程跑通

那优先建议：

- 先学 `jwt session`

因为：

- 更贴近 Dub 当前选择
- 更适合先把主链路跑通

如果你以后要继续做：

- 会话管理后台
- 踢设备下线
- 登录设备列表

再去补 `database session` 会更顺。

---

## 9. 一句话总结

Session 的本质是“登录后系统记住用户身份的机制”。

- `jwt session`：会话主要放在 cookie/JWT 里，轻量，但不容易立刻强制失效
- `database session`：会话主要放在数据库里，查库更多，但更容易集中管理和踢下线

Dub 当前：

- 保留了 `Session` 表
- 但实际选择的是 `jwt` 策略
