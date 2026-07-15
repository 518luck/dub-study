"use client";

// 作用:监听一个可滚动容器,实时计算当前滚动位置占总可滚动距离的比例。
// 返回值 scrollProgress 是一个 0~1 的数值:
//   - 0   表示在最顶部(竖向)或最左侧(横向)
//   - 1   表示已滚动到底/到最右
//   - 当内容不足以滚动时,直接返回 1(表示"已经到底了")
//
// 典型用途:
//   1. 控制顶部/底部渐变遮罩的透明度(滚动到底就隐藏遮罩)
//   2. 阅读进度条
//   3. 懒加载触发判断

// ── React 提供的几个工具(全部只是类型或函数,不是组件)
//   RefObject    :类型,表示 useRef 创建出来的 ref 对象 { current: T | null }
//   useCallback  :缓存函数,依赖不变时返回同一个引用(防止子组件无谓重渲染)
//   useEffect    :处理副作用,这里用来在"容器尺寸变化后"重新计算进度
//   useState     :声明状态,这里保存当前滚动进度数值(0~1)
import { RefObject, useCallback, useEffect, useState } from "react";

// ── 依赖的兄弟 hook:监听元素尺寸变化
// useResizeObserver 内部用了浏览器原生 ResizeObserver API,
// 只要 ref 指向的容器尺寸改变(窗口缩放、内容增减、折叠展开等),
// 它就会返回一条新的 entry 通知我们 —— 我们借此重算进度。
// ./ 表示这个 hook 就在当前同一目录(use-resize-observer.ts)。
import { useResizeObserver } from "./use-resize-observer";

export function useScrollProgress(
  // 要监听的可滚动容器 ref,类型兼容所有 HTMLElement(div/section/ul 等都行)
  ref: RefObject<HTMLElement | null>,
  // 可选配置对象:direction 决定监听竖向还是横向滚动,默认竖向
  { direction = "vertical" }: { direction?: "vertical" | "horizontal" } = {},
) {
  // ── 状态:滚动进度,初始值为 1(默认"已到底",避免首次渲染时遮罩闪烁)
  const [scrollProgress, setScrollProgress] = useState(1);

  // ── 计算并更新进度的核心函数
  // 用 useCallback 包裹,保证引用稳定,可以安全地作为 onScroll 回调和 useEffect 依赖
  const updateScrollProgress = useCallback(() => {
    // ref 还没挂载到 DOM 时直接跳过(比如首次渲染、组件卸载后)
    if (!ref.current) return;

    // 根据 direction 读取对应方向上的三个关键尺寸:
    const scroll =          // 当前已滚动的距离(px)
      direction === "vertical" ? ref.current.scrollTop : ref.current.scrollLeft;
    const scrollSize =      // 内容总尺寸(含超出视口的部分)
      direction === "vertical"
        ? ref.current.scrollHeight
        : ref.current.scrollWidth;
    const clientSize =      // 视口尺寸(容器可见区域大小)
      direction === "vertical"
        ? ref.current.clientHeight
        : ref.current.clientWidth;

    // ── 计算进度
    // 情况一:内容尺寸 === 视口尺寸 → 没有滚动空间,返回 1
    //         (这是"内容不溢出"的情况,遮罩应视为"已到底"而隐藏)
    // 情况二:有滚动空间 → 进度 = 已滚动距离 / 可滚动总距离
    //         可滚动总距离 = scrollSize - clientSize(内容超出视口的那部分)
    //         用 Math.min(..., 1) 兜底,防止超出 1 的异常值
    setScrollProgress(
      scrollSize === clientSize
        ? 1
        : Math.min(scroll / (scrollSize - clientSize), 1),
    );
    // 依赖 direction:方向切换时函数需要重新创建,以读取正确的属性
  }, [direction]);

  // ── 监听容器尺寸变化
  // 当窗口缩放、内容动态增减导致容器尺寸改变时,
  // 可滚动总距离会变,进度必须重算 —— 光靠 onScroll 是感知不到这种变化的。
  const resizeObserverEntry = useResizeObserver(ref);

  // 每次收到新的 ResizeObserver 条目就重算一次进度
  // (相当于"布局变了就刷新进度",保证数值始终准确)
  useEffect(updateScrollProgress, [resizeObserverEntry]);

  // ── 返回给调用方
  // scrollProgress       :当前的进度数值(0~1),驱动 UI(如遮罩透明度)
  // updateScrollProgress :手动触发更新的函数,调用方需把它绑到滚动容器的 onScroll 上
  return { scrollProgress, updateScrollProgress };
}