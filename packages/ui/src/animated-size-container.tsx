import { cn } from "@dub/utils";
import { motion } from "motion/react";
import {
  ComponentPropsWithoutRef,
  ForwardRefExoticComponent,
  PropsWithChildren,
  RefAttributes,
  forwardRef,
  useRef,
} from "react";
import { useResizeObserver } from "./hooks";

const defaultTransition = { type: "spring" as const, duration: 0.3 };

type AnimatedSizeContainerProps = PropsWithChildren<{
  width?: boolean;
  height?: boolean;
}> &
  Omit<ComponentPropsWithoutRef<typeof motion.div>, "animate" | "children">;

// 根据子元素尺寸变化，按需动画过渡容器的宽度和高度。
const AnimatedSizeContainer: ForwardRefExoticComponent<
  AnimatedSizeContainerProps & RefAttributes<HTMLDivElement>
> = forwardRef<HTMLDivElement, AnimatedSizeContainerProps>(
  (
    {
      width = false,
      height = false,
      className,
      transition,
      children,
      ...rest
    }: AnimatedSizeContainerProps,
    forwardedRef,
  ) => {
    const containerRef = useRef<HTMLDivElement>(null);
    // 监听内部内容尺寸，外层容器用这个尺寸做动画。
    const resizeObserverEntry = useResizeObserver(containerRef);
    const hasMeasuredRef = useRef(false);

    const measuredWidth = resizeObserverEntry?.contentRect?.width;
    const measuredHeight = resizeObserverEntry?.contentRect?.height;
    const isFirstMeasurement =
      (width ? measuredWidth != null : true) &&
      (height ? measuredHeight != null : true) &&
      !hasMeasuredRef.current;

    if (resizeObserverEntry) {
      hasMeasuredRef.current = true;
    }

    // 首次测量不做动画，避免组件挂载时从 0 抖到目标尺寸。
    const effectiveTransition =
      transition ?? (isFirstMeasurement ? { duration: 0 } : defaultTransition);

    return (
      <motion.div
        // 把外部传进来的 ref 挂到真正负责动画的外层容器上。
        ref={forwardedRef}
        // overflow-hidden 用来隐藏尺寸动画过程中溢出的内容。
        className={cn("overflow-hidden", className)}
        // 根据开启的 width/height 选项，把外层容器动画到测量出的内容尺寸。
        animate={{
          width: width ? measuredWidth ?? "auto" : "auto",
          height: height ? measuredHeight ?? "auto" : "auto",
        }}
        // 控制尺寸变化的动画方式；首次测量会禁用动画。
        transition={effectiveTransition}
        // 透传其它 motion.div 支持的属性，比如 initial、style、onClick。
        {...rest}
      >
        <div
          ref={containerRef}
          className={cn(height && "h-max", width && "w-max")}
        >
          {children}
        </div>
      </motion.div>
    );
  },
);

AnimatedSizeContainer.displayName = "AnimatedSizeContainer";

export { AnimatedSizeContainer };
