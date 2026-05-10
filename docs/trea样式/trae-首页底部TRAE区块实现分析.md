# Trae 首页底部 TRAE 区块实现分析

## 问题

Trae 官网 `https://www.trae.ai/` 底部的大绿色 `TRAE` 区块，以及上面的 footer 信息区，是怎么实现的。

要求：

- 给出确切答案
- 不猜测
- 记录查找过程和最终结论

## 最终结论

这块不是单纯 `CSS` 文字放大，也不是 `Rive`。

它实际分成两层：

1. footer 信息区：`React + CSS Grid`
2. 大绿色 `TRAE` 视觉区：`WebGL/Three.js + shader` 做的图片扭曲效果

另外：

- `Back to top` 是普通按钮
- 点击时执行 `window.scrollTo({ top: 0, behavior: "smooth" })`

所以这块的准确说法是：

> 底部信息区是普通前端布局；大绿色 `TRAE` 区块是一张图片，经过 `WebGL shader distortion` 做成的交互扭曲动画。

## 查找过程

### 1. 先确认首页是不是 SSR 直接输出了这块内容

抓取首页 HTML 后发现，SSR 里主要只有首屏 `Ship Faster with TRAE` 那部分，截图里的 footer 区块没有完整出现在首屏 HTML 中。

这说明：

- 这块内容要么是客户端渲染
- 要么来自共享 layout / 懒加载 chunk

首页入口资源：

- `https://www.trae.ai/`

首页引用的核心资源里包括：

- `static/js/main.b54cbfd5.js`
- `static/js/route-manifest-main.eea1b991.js`
- 多个 async css/js chunk

### 2. 通过 route manifest 找首页和共享 layout 的 chunk

在 `route-manifest-main.eea1b991.js` 里可以看到：

- 首页 `page`
- 共享 layout `__header-footer-layout/layout`

这说明 footer 更可能放在共享 layout 里，而不是首页首屏组件里。

相关资源：

- `https://lf-static.traecdn.us/obj/trae-ai-tx/trae_website/static/js/route-manifest-main.eea1b991.js`

### 3. 定位 footer 信息区组件

在下面这个 chunk 里找到了 footer 的核心实现：

- `https://lf-static.traecdn.us/obj/trae-ai-tx/trae_website/static/js/async/4430.a515ce6f.js`

这里可以明确看到：

- `© ${new Date().getFullYear()} TRAE`
- `SOC 2 Certified`
- `Back to top`
- `window.scrollTo({top:0,behavior:"smooth"})`
- `Discord`
- `Reddit`
- `X`
- `TRAE Fellow`

关键代码特征：

```js
onClick:()=>{window.scrollTo({top:0,behavior:"smooth"})}
```

以及：

```js
children:"SOC 2 Certified"
```

以及：

```js
children:"Back to top"
```

这一步可以确定：

- 你截图上半部分 footer 不是图片
- 是 React 组件正常渲染出来的 DOM

### 4. 定位 footer 信息区样式

在下面这个 CSS chunk 里找到了 footer 的样式：

- `https://lf-static.traecdn.us/obj/trae-ai-tx/trae_website/static/css/async/4430.9abf9a9b.css`

能明确看到这些点：

- footer 容器：`.container-AbNPWn`
- 内容区：`.container_main_content-YJawGv`
- 布局方式：`display: grid`
- `backToTop-fxlAV4`
- `copyright-sTrcS7`

核心结构样式类似：

```css
.container_main_content-YJawGv {
  display: grid;
  grid-template-areas:
    "logo       logo"
    "terms      resources"
    "contact    social"
    "copyright  backToTop";
}
```

桌面端则变成四列 grid。

这一步可以确定：

- 上半部分 footer 是 `React + CSS Grid`
- 不是 canvas
- 不是 svg 主导

### 5. 定位大绿色 TRAE 区块

在 footer 组件里发现它懒加载了一个 `Distortion` 组件：

- chunk：`9870.d478e49c.js`

地址：

- `https://lf-static.traecdn.us/obj/trae-ai-tx/trae_website/static/js/async/9870.d478e49c.js`

这个 chunk 里可以明确看到：

- 导出组件名：`Distortion`
- 图片资源：`static/image/footer.f640dd45.png`
- `new WebGLRenderer(...)`
- `TextureLoader().load(...)`
- `DataTexture`
- `ShaderMaterial`
- `PlaneGeometry`
- `requestAnimationFrame(...)`
- `mousemove`
- `mouseleave`

也就是说，大绿色 `TRAE` 本体不是直接拿大字 DOM 排出来，而是：

1. 先加载一张图片：`footer.f640dd45.png`
2. 再用 `WebGLRenderer` 渲染
3. 用 shader 对图片做扰动

### 6. 确认它不是普通图片播放，而是 shader 扭曲

这个 chunk 里有非常明确的 shader 逻辑：

顶点着色器只是传递 `uv`。

片元着色器核心是：

```glsl
vec4 offset = texture2D(uDataTexture, vUv);
gl_FragColor = texture2D(uTexture, uv - 0.02 * offset.rg);
```

这说明：

- `uTexture` 是原图
- `uDataTexture` 是扰动数据
- 最终通过偏移采样原图来做扭曲

同时代码里还有鼠标速度写入扰动纹理的逻辑：

```js
e.addEventListener("mousemove", j)
e.addEventListener("mouseleave", S)
requestAnimationFrame(U)
```

所以这块效果的本质是：

- 鼠标移动
- 更新 data texture
- shader 根据 data texture 偏移采样图片
- 形成实时扭曲效果

### 7. 确认绿色区块的外层定位方式

在同一个 chunk 以及对应 CSS 里可以看到：

```css
.container_distortion-T_UT23 {
  --distortion-aspect: 3.83228;
  padding-bottom: calc((min(100vw, 1600px) + 2 * var(--padding-y)) / var(--distortion-aspect));
  position: relative;
}

.container_distortion-T_UT23 .content-rrUxd3 {
  position: fixed;
  bottom: 0;
  width: 100%;
  background: #32f08c;
}
```

这说明它不是普通文档流里的一个静态块，而是：

- 外层占位
- 内层固定在底部
- 用 `padding-bottom` 给固定内容留空间

## 实现拆解

### 上半部分 footer

技术：

- `React`
- 普通 `DOM`
- `CSS Grid`

包含内容：

- `© 2026 TRAE`
- `SOC 2 Certified`
- `Back to top`
- 社交链接
- `TRAE Fellow`

### 下半部分绿色 TRAE 大图

技术：

- `WebGL`
- `Three.js`
- `ShaderMaterial`
- `DataTexture`
- `TextureLoader`
- `requestAnimationFrame`

素材：

- `static/image/footer.f640dd45.png`

交互：

- `mousemove` 改变扰动数据
- shader 根据扰动纹理偏移原图采样
- 形成实时扭曲

## 一句话总结

Trae 官网这块不是“纯 CSS 大字特效”，而是：

> footer 信息区用 `React + CSS Grid`，底部绿色 `TRAE` 视觉区用 `Three.js/WebGL` 把一张图片做成鼠标可交互的 shader 扭曲动画。

## 关键源码来源

- 首页：<https://www.trae.ai/>
- route manifest：<https://lf-static.traecdn.us/obj/trae-ai-tx/trae_website/static/js/route-manifest-main.eea1b991.js>
- footer 组件：<https://lf-static.traecdn.us/obj/trae-ai-tx/trae_website/static/js/async/4430.a515ce6f.js>
- footer 样式：<https://lf-static.traecdn.us/obj/trae-ai-tx/trae_website/static/css/async/4430.9abf9a9b.css>
- distortion 组件：<https://lf-static.traecdn.us/obj/trae-ai-tx/trae_website/static/js/async/9870.d478e49c.js>

