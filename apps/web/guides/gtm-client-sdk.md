本指南将引导您完成将 Dub 与 Google Tag Manager (GTM) 集成的过程。

## 第一步：创建一个新代码 (Tag)

首先，导航到您的 Google Tag Manager 账户并创建一个新代码：

- 点击左侧边栏中的 **代码 (Tags)**
- 点击 **新建 (New)** 按钮
- 选择 **自定义 HTML (Custom HTML)** 作为代码类型

![Dub GTM 创建代码](https://mintlify.s3.us-west-1.amazonaws.com/dub/images/conversions/google-tag-manager/gtm-select-custom-html-tag.png)

## 第二步：添加 Dub 客户端脚本

在“自定义 HTML”部分，您需要添加 Dub 客户端脚本。将以下代码复制并粘贴到 **HTML** 字段中：

<!-- prettier-ignore -->
```html
<script>
  (function (c, n) {
    c[n] =
      c[n] ||
      function () {
        (c[n].q = c[n].q || []).push(arguments);
      };
    var methods = ["trackClick", "trackLead", "trackSale"];
    for (var i = 0; i < methods.length; i++) {
      (function (method) {
        c[n][method] = function () {
          var args = Array.prototype.slice.call(arguments);
          args.unshift(method);
          c[n].apply(null, args);
        };
      })(methods[i]);
    }
    var s = document.createElement("script");
    s.defer = 1;
    s.src = "https://www.dubcdn.com/analytics/script.js";
    document.head.appendChild(s);
  })(window, "dubAnalytics");
</script>
```

## 第三步：配置触发条件 (Trigger)

为了确保分析脚本在所有页面上加载：

- 点击 **触发条件 (Triggering)** 部分
- 选择 **All Pages (所有页面)** 作为触发类型
- 这将使代码在每次页面加载时触发

## 第四步：保存并发布

- 将您的代码命名为 **Dub Analytics**
- 点击 **保存 (Save)** 以存储更改
- 点击 **提交 (Submit)** 以创建一个新版本
- 最后，点击 **发布 (Publish)** 以在您的网站上激活该代码
