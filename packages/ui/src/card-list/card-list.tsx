import { cn } from "@dub/utils";
import { VariantProps, cva } from "class-variance-authority";
import { PropsWithChildren, createContext } from "react";

// #region 学习笔记：PropsWithChildren 与 createContext
// 这两个名字虽然都从 "react" 导入，但它们不是同一种东西。
//
// 1. PropsWithChildren
// - 它是 React 提供的 TypeScript 类型工具，不是运行时函数。
// - 作用：在你已有的 props 类型上，自动补一个 children?: ReactNode。
// 手动声明的样子 => interface MyComponentProps {
//                                         title: string;
//                                         children?: React.ReactNode; // 手动添加这一行
//                                      }
// - 常见用法：
//   type BoxProps = PropsWithChildren<{ title: string }>;
// - 近似等价于：
//   type BoxProps = {
//     title: string;
//     children?: React.ReactNode;
//   };
// - 适合场景：
//   当组件既有自己的 props，又允许写成 <Box>...</Box> 这种包裹式用法时。
//
// 2. createContext
// - 它是 React 的运行时 API，用来创建一个 Context 对象。
// - Context 的作用：让上层组件给下层整棵子树共享数据，避免一层层手动传 props。
// - 基础用法分三步：
//   第一步：创建 Context
//   const MyContext = createContext(默认值);
//
//   第二步：上层提供值
//   <MyContext.Provider value={某个值}>
//     子组件
//   </MyContext.Provider>
//
//   第三步：下层读取值
//   const value = useContext(MyContext);
//
// - 常见场景：
//   主题、语言、列表显示模式、表单上下文、当前选中项等“同一棵子树共享状态”。
//
// 3. 二者的区别
// - PropsWithChildren：只参与类型检查，编译后不会出现在运行时代码里。
// - createContext：真实参与 React 运行，用来在组件树中传递共享数据。
//
// 4. 一个简单记忆方法
// - PropsWithChildren：解决“这个组件能不能包 children”的类型表达问题。
// - createContext：解决“这组组件之间怎么共享数据”的运行时通信问题。
// #endregion
const cardListVariants = cva(
  "group/card-list w-full flex flex-col transition-[gap,opacity] min-w-0",
  {
    variants: {
      variant: {
        compact: "gap-0",
        loose: "gap-4",
      },
      loading: {
        true: "opacity-50",
      },
    },
  },
);

// CardListProps 这个类型，由两部分类型“合并”而成。
type CardListProps = PropsWithChildren<{
  loading?: boolean;
  className?: string;
}> &
  VariantProps<typeof cardListVariants>;

type CardListContextType = {
  variant: VariantProps<typeof cardListVariants>["variant"];
  loading: boolean;
};

export const CardListContext = createContext<CardListContextType>({
  variant: "loose",
  loading: false,
});

export function CardList({
  variant = "loose",
  loading = false,
  className,
  children,
}: CardListProps) {
  return (
    <ul
      className={cn(cardListVariants({ variant, loading }), className)}
      data-variant={variant}
    >
      <CardListContext.Provider value={{ variant, loading }}>
        {children}
      </CardListContext.Provider>
    </ul>
  );
}
