# 零基础最适合按这个顺序看

1. 先看 export const authOptions 这一整块
2. 先只认 6 个顶层字段：providers、adapter、session、cookies、pages、callbacks
3. 再回头看最上面的 import
4. 最后再看 events

你可以先把它粗略理解成下面这样：

- providers: 有哪些登录方式
- adapter: 用户数据怎么存数据库
- session: 登录态怎么保存
- callbacks: 登录过程中插入自定义逻辑
- events: 登录完成后顺手做的事

## providers

意思是：providers 这个字段的值，是一个数组。
数组里面每一项代表一种登录方式。

```
  providers: [
    某个登录方式1,
    某个登录方式2,
    某个登录方式3,
  ]
```

这里的“某个登录方式”，有两种写法：

1. 调用函数返回配置对象

```
  GoogleProvider({ ... })
  GithubProvider({ ... })
  EmailProvider({ ... })
  CredentialsProvider({ ... })
```

2. 直接手写一个对象

```json

{
    id: "saml",
    name: "BoxyHQ",
    type: "oauth",
    ...
}

```

所以这一段不是一种单一语法，而是“数组里混合放函数调用结果和对象”。
