Dub 的 API 基于 REST 原则构建，并通过 HTTPS 协议提供服务。为了确保数据隐私，不支持未加密的 HTTP。

所有 API 端点 (endpoints) 的基础 URL 为：

```bash
https://api.dub.co
```

## 身份验证

对 Dub API 的身份验证是通过带有 Bearer 令牌 (token) 的 Authorization 请求头执行的。要进行身份验证，您需要在请求中包含 Authorization 请求头，其值为单词 `Bearer` 后跟您的 API 密钥，如下所示：

```bash
Authorization: Bearer dub_xxxxxx
```

以下是使用 Node.js 向 Dub API 发送请求的示例：

```javascript
const response = await fetch("https://api.dub.co/links", {
  method: "GET",
  headers: {
    Authorization: "Bearer dub_xxxxxx",
  },
});

const data = await response.json();
```

