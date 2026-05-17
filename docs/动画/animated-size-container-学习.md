# 核心结构

<motion.div>

<div ref={containerRef}>
{children}
</div>
</motion.div>

> 内层 div 负责装真实内容并被测量；外层 motion.div 负责动画宽高。

# Motion 概念：motion.div

普通 React：

  <div />

Motion：

<motion.div />

motion.div 本质上还是一个 div，但额外支持动画属性，比如：

animate
transition
initial

# 流程

这里要区分两个东西：

内容本身的真实高度
外层容器显示出来的高度

这个组件里有两层：

<motion.div> // 外层：负责动画高度
<div ref={...}> // 内层：真实内容，用来测量高度
{children}
</div>
</motion.div>

假设一开始内容高度是 80px：

外层 motion.div 高度：80px
内层内容真实高度：80px

然后内容突然变多了，真实高度变成 200px。

如果没有动画，普通 div 会直接跳到 200px。

但这里流程是：

1. 内层内容变高到 200px
2. ResizeObserver 测到：新内容高度是 200px
3. motion.div 收到 animate={{ height: 200 }}
4. Motion 知道上一次外层高度是 80px
5. Motion 让外层高度从 80px 慢慢变到 200px

也就是：

80px → 100px → 130px → 170px → 200px

所以 animate 的意思是：

> 不要立刻把外层 CSS 高度设成目标值，而是从上一次的值平滑过渡到新值。
