# Animated Size Container 学习笔记

## 1. Motion 概念：`motion.div`

普通的 React 组件：

```jsx
<div />
```

使用 Framer Motion：

```jsx
<motion.div />
```

`motion.div` 本质上还是一个普通的 `div`，但额外支持了动画属性，例如：

- `animate`
- `transition`
- `initial`

## 2. 核心结构

这个组件内部主要包含两层结构：

```jsx
<motion.div>
  {" "}
  {/* 外层：负责动画高度 */}
  <div ref={containerRef}>
    {" "}
    {/* 内层：真实内容，用来测量高度 */}
    {children}
  </div>
</motion.div>
```

> **核心职责划分：**
>
> - **内层 `div`**：负责装真实内容并被测量。
> - **外层 `motion.div`**：负责动画宽高。

这里要区分两个东西：

- 内容本身的真实高度
- 外层容器显示出来的高度

## 3. 动画流程

假设一开始内容高度是 80px：

- 外层 `motion.div` 高度：80px
- 内层内容真实高度：80px

然后内容突然变多了，真实高度变成 200px。

如果没有动画，普通 `div` 会直接跳到 200px。但在这个组件中，流程是这样的：

1. 内层内容变高到 200px。
2. `ResizeObserver` 测到：新内容高度是 200px。
3. `motion.div` 收到 `animate={{ height: 200 }}`。
4. Motion 知道上一次外层高度是 80px。
5. Motion 让外层高度从 80px 慢慢变到 200px。

变化过程也就是：
`80px` → `100px` → `130px` → `170px` → `200px`

### `animate` 的核心意义

> 不要立刻把外层 CSS 高度设成目标值，而是从上一次的值平滑过渡到新值。
