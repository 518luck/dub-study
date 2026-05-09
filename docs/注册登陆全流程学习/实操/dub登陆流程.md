# Dub 登录与注册流程解析

这个项目的“注册”流程并不是全部交由 NextAuth 处理，而是分为两种模式：

## 1. 邮箱 + 密码注册 (自定义实现)

邮箱密码注册是项目自行实现的，而非 NextAuth 自动处理。

### 注册流程
1. **发送 OTP 验证码**：
   - 注册表单首先触发发送 OTP：[signup-email.tsx:1](file:///home/duoyun/idea/open-source/dub/apps/web/ui/auth/register/signup-email.tsx)
2. **验证并创建账号**：
   - 用户输入验证码后，通过自定义 Action 创建账号：[verify-email-form.tsx:25](file:///home/duoyun/idea/open-source/dub/apps/web/ui/auth/register/verify-email-form.tsx)
   - 核心创建逻辑位于：[create-user-account.ts:22](file:///home/duoyun/idea/open-source/dub/apps/web/lib/actions/create-user-account.ts)

### 核心创建逻辑 (Prisma)
```typescript
await prisma.user.create({
  data: {
    id: createId({ prefix: "user_" }),
    email,
    passwordHash: await hashPassword(password),
    emailVerified: new Date(),
    notificationPreferences: { create: {} },
  },
});
```

### 完成注册后登录
账号创建完成后，前端会主动调用 NextAuth 的 `signIn` 方法：
```typescript
signIn("credentials", { email, password })
```
- 代码位置：[verify-email-form.tsx:31](file:///home/duoyun/idea/open-source/dub/apps/web/ui/auth/register/verify-email-form.tsx)

---

## 2. 第三方登录 (Google / GitHub / SAML)

对于 OAuth 和 SAML，项目没有单独的“注册接口”，而是在**首次登录**时自动创建账号。

- **NextAuth Adapter**：重写了 `createUser` 方法：[options.ts:35](file:///home/duoyun/idea/open-source/dub/apps/web/lib/auth/options.ts)
- **SAML 登录**：如果本地没有用户，会直接调用 `prisma.user.create(...)`：
  - [options.ts:92](file:///home/duoyun/idea/open-source/dub/apps/web/lib/auth/options.ts)
  - [options.ts:169](file:///home/duoyun/idea/open-source/dub/apps/web/lib/auth/options.ts)

---

## 总结

- **邮箱注册**：先手动通过 Prisma 创建用户，再走 NextAuth `credentials` 登录。
- **第三方登录**：首次登录时由 NextAuth 或 SAML 逻辑顺带完成建号。

