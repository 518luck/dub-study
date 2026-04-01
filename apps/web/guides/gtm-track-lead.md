配置 Google Tag Manager 进行 lead (潜在客户) 跟踪

以下步骤假设您已经通过 GTM 安装了 Dub Analytics 脚本。

## 第一步：创建一个 GTM 变量来读取 dub_id Cookie

要读取 Dub Analytics 设置的 `dub_id` cookie，您需要在 Google Tag Manager 中创建一个新的 **用户定义的变量 (User-Defined Variable)**。

在您的 GTM 工作区中，导航到 **变量 (Variables)** 部分，然后点击 **新建 (New)** 以创建一个新变量。

使用以下设置配置该变量：

- **变量类型 (Variable Type)**：选择 **第一方 Cookie (1st Party Cookie)**
- **Cookie 名称 (Cookie Name)**：`dub_id`
- **变量名称 (Variable Name)**：命名为 "Dub ID Cookie"

点击 **保存 (Save)** 以创建变量。

## 第二步：跟踪 lead 事件

有两种方法可以使用 Google Tag Manager 跟踪 lead 事件：

- 感谢页面跟踪 (推荐)
- 表单提交跟踪

### 选项 1：感谢页面跟踪 (推荐)

此方法在用户完成表单后跳转到感谢或成功页面时跟踪 lead。这种方法更可靠，因为不太可能被广告拦截器拦截，并提供更高的数据准确性。

使用以下代码创建一个 **自定义 HTML (Custom HTML)** 代码：

```html
<script>
  (function () {
    // 从 URL 获取查询参数
    var params = new URLSearchParams(window.location.search);
    var email = params.get("email");
    var name = params.get("name");

    // 使用 GTM 变量从 cookie 获取 dub_id
    var clickId = {{Dub ID Cookie}} || "";

    // 仅在 email 和 clickId 存在时跟踪 lead 事件
    if (email && clickId) {
      dubAnalytics.trackLead({
        eventName: "Sign Up",
        customerExternalId: email,
        customerName: name || email,
        customerEmail: email,
        clickId: clickId,
      });
    }
  })();
</script>
```

> **重要提示**：确保将 `email` 和 `name` 查询参数传递给感谢页面，以便将 lead 事件归因于正确的客户。

通过创建一个具有以下条件的 **网页浏览 (Page View)** 触发器，将此代码配置为在特定页面上触发：

- 触发器类型：**网页浏览 (Page View)**
- 此触发器启动于：**部分网页浏览 (Some Page Views)**
- 添加如下条件：
  - **Page URL** 包含 `/thank-you`
  - 或 **Page Path** 等于 `/success`
  - 或任何匹配您感谢页面的 URL 模式

将此代码命名为 "Dub Lead Tracking - Thank You Page" 并保存。

### 选项 2：表单提交跟踪

此方法在用户提交网站上的表单时立即跟踪 lead。请注意，由于广告拦截器和时间问题，此方法可能不太可靠。

使用以下代码创建一个 **自定义 HTML (Custom HTML)** 代码：

```html
<script>
  (function () {
    // 获取表单数据 - 根据您的表单自定义这些选择器
    var name = document.getElementById("name")
      ? document.getElementById("name").value
      : "";
    var email = document.getElementById("email")
      ? document.getElementById("email").value
      : "";

    // 使用 GTM 变量从 cookie 获取 dub_id
    var clickId = {{Dub ID Cookie}} || "";

    // 仅在 email 和 clickId 存在时跟踪 lead 事件
    if (email && clickId) {
      dubAnalytics.trackLead({
        eventName: "Sign Up",
        customerExternalId: email,
        customerName: name || email,
        customerEmail: email,
        clickId: clickId,
      });
    }
  })();
</script>
```

> **重要提示**：您需要自定义 DOM 选择器 (`getElementById('name')`, `getElementById('email')`) 以匹配您实际的表单字段 ID，或根据您的网站结构使用不同的方法来捕捉表单数据。

通过创建一个新触发器，将此代码配置为在 **表单提交 (Form Submission)** 时触发：

- 触发器类型：**表单提交 (Form Submission)**
- 此触发器启动于：**部分表单 (Some Forms)** (如果您想跟踪所有表单提交，则选择 **所有表单 (All Forms)**)
- 添加条件以指定哪些表单应触发 lead 跟踪

将此代码命名为 "Dub Lead Tracking - Form Submission" 并保存。

## 测试您的设置

要测试您的 GTM 设置，您可以使用 Google Tag Manager 中的 **预览 (Preview)** 模式：

1. **启用预览模式**：在您的 GTM 工作区中，点击右上角的 **预览 (Preview)** 按钮
2. **输入您的网站 URL** 并点击 **连接 (Connect)**
3. **测试您选择的跟踪方法**：
   - **对于选项 1 (感谢页面)**：导航到带有查询参数的感谢页面（例如 `?email=test@example.com&name=Test User`）
   - **对于选项 2 (表单提交)**：导航到带有表单的页面并提交测试表单
4. **查看 GTM 调试器** 以确认您的代码是否正确触发

### 验证 lead 跟踪

您还可以通过以下方式验证 lead 是否被跟踪：

1. **检查浏览器的开发者控制台** 是否有任何 JavaScript 错误
2. **使用 Network 选项卡** 查看是否正在向 Dub 的分析端点发送请求
3. **查看您的 Dub 仪表板** 以确认 lead 事件是否出现在您的分析中

### 常见故障排除提示

- **代码未触发**：检查您的触发器配置是否正确，以及条件是否与您的页面结构匹配。
- **缺失可发布密钥 (Publishable key)**：确保您已将占位符替换为实际的可发布密钥。
- **查询参数缺失** (选项 1)：确保您的表单重定向到带有所需查询参数的感谢页面。
- **表单数据未捕捉** (选项 2)：验证您的 DOM 选择器是否与实际的表单字段 ID 或名称匹配。
