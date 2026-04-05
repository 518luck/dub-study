"use client";

import { Badge, buttonVariants } from "@dub/ui";
import { cn } from "@dub/utils";
import Link from "next/link";
import { CSSProperties, PropsWithChildren, ReactNode } from "react";

export function AnimatedEmptyState({
  title, //标题   必选
  description, //描述   必选
  cardContent, //卡片内容 必选
  cardCount = 3, //卡片数量，有默认值3,但是修改为8之后好像没什么作用
  addButton, //添加按钮
  pillContent, //药丸,应该是小胶囊样式或者交互
  learnMoreHref, //学习更多链接
  learnMoreTarget = "_blank", //更多标签
  learnMoreClassName, //学习更多链接样式
  learnMoreText, //学习更多链接文本
  className, //样式
  cardClassName, //卡片样式
  cardContainerClassName, //卡片容器样式
}: {
  title: string;
  description: ReactNode;
  cardContent: ReactNode | ((index: number) => ReactNode);
  cardCount?: number;
  addButton?: ReactNode;
  pillContent?: string;
  learnMoreHref?: string;
  learnMoreTarget?: string;
  learnMoreClassName?: string;
  learnMoreText?: string;
  className?: string;
  cardClassName?: string;
  cardContainerClassName?: string;
}) {
  return (
    <div
      // cn 的作用通常就是：
      // 把多个类名合并起来
      // 自动忽略 undefined、null、false 这种空值
      // 有些项目里还会顺便处理 Tailwind 冲突
      className={cn(
        "flex flex-col items-center justify-center gap-6 rounded-lg border border-neutral-200 px-4 py-10 md:min-h-[500px]",
        className,
      )}
    >
      {/* // 这个下面有三个div 也就是有三大块内容 还有一个根据条件渲染的 Badge组件*/}
      <div
        className={cn(
          "animate-fade-in h-36 w-full max-w-64 overflow-hidden px-4 [mask-image:linear-gradient(transparent,black_10%,black_90%,transparent)]",
          cardContainerClassName,
        )}
      >
        <div
          style={{ "--scroll": "-50%" } as CSSProperties}
          //这个组件故意做了一个纵向无限滚动的空状态演示动画
          className="animate-infinite-scroll-y flex flex-col [animation-duration:10s]"
        >
          {/* Array(6)  它表示“创建一个长度为 6 的数组”，但这个数组里面其实是空槽位，不是正常值。 */}
          {/* Array(3) (稀疏数组)	[...Array(3)] (密集数组) */}
          {[...Array(cardCount * 2)].map((_, idx) => (
            // 这个里面引入了一个card组件，目前没有深入研究
            <Card key={idx} className={cardClassName}>
              {/* 如果你传的是函数，就按索引动态生成卡片内容  如果你传的是普通 JSX，就所有卡都复用同一份内容*/}
              {typeof cardContent === "function"
                ? cardContent(idx % cardCount)
                : cardContent}
            </Card>
          ))}
        </div>
      </div>
      {/* pillContent不为空的是很就渲染这个badge组件 */}
      {pillContent && <Badge variant="blueGradient">{pillContent}</Badge>}
      {/* 这个区域很好理解就是为了展示描述和标题的 */}
      <div className="max-w-sm text-pretty text-center">
        <span className="text-base font-medium text-neutral-900">{title}</span>
        <div className="mt-2 text-pretty text-sm text-neutral-500">
          {description}
        </div>
      </div>
      <div className="flex items-center gap-2">
        {addButton}
        {/* 学习链接如果存在的话，那么就会显示里面的link组件/ */}
        {learnMoreHref && (
          <Link
            href={learnMoreHref}
            target={learnMoreTarget}
            className={cn(
              buttonVariants({ variant: addButton ? "secondary" : "primary" }),
              "flex h-9 items-center whitespace-nowrap rounded-lg border px-4 text-sm",
              learnMoreClassName,
            )}
          >
            {learnMoreText || "Learn more"}
          </Link>
        )}
      </div>
    </div>
  );
}

// 这个是card，传入children和className作为参数，应该是把动画单独抽出来了
function Card({
  children,
  className,
}: PropsWithChildren<{ className?: string }>) {
  return (
    <div
      className={cn(
        "mt-4 flex items-center gap-3 rounded-lg border border-neutral-200 bg-white p-4 shadow-[0_4px_12px_0_#0000000D]",
        className,
      )}
    >
      {children}
    </div>
  );
}
