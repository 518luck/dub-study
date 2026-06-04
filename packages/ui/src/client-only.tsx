import { AnimatePresence, motion } from "motion/react";
import { ReactNode, useEffect, useState } from "react";

// ClientOnly 用来让 children 只在浏览器客户端渲染。
// 适合包裹依赖 window、document、浏览器尺寸或客户端状态的组件，避免服务端渲染和客户端 hydration 不一致。
export const ClientOnly = ({
  children,
  fallback,
  fadeInDuration = 0.5,
  className,
}: {
  children: ReactNode;
  fallback?: ReactNode;
  fadeInDuration?: number;
  className?: string;
}) => {
  // 初始为 false：服务端渲染和客户端首次渲染时都先不展示 children。
  const [clientReady, setClientReady] = useState<boolean>(false);

  // useEffect 只会在浏览器端执行。
  // 组件挂载后把 clientReady 设为 true，随后才真正渲染 children。
  useEffect(() => {
    setClientReady(true);
  }, []);

  // fadeInDuration 有值时使用 motion.div 做淡入动画；为 0 时退回普通 div。
  const Comp = fadeInDuration ? motion.div : "div";

  return (
    // AnimatePresence 用来处理 children / fallback 切换时的动画存在状态。
    <AnimatePresence>
      {clientReady ? (
        <Comp
          // 只有使用 motion.div 时才传入动画参数，避免普通 div 收到 motion 专属 props。
          {...(fadeInDuration
            ? {
                initial: { opacity: 0 },
                animate: { opacity: 1 },
                transition: { duration: fadeInDuration },
              }
            : {})}
          className={className}
        >
          {/* 客户端挂载完成后渲染真正内容。 */}
          {children}
        </Comp>
      ) : (
        // 客户端尚未 ready 时渲染 fallback；没有 fallback 就什么都不渲染。
        fallback || null
      )}
    </AnimatePresence>
  );
};
