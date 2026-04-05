import useCurrentFolderId from "@/lib/swr/use-current-folder-id";
import useFolder from "@/lib/swr/use-folder";
import useWorkspace from "@/lib/swr/use-workspace";
import {
  CardList,
  ExpandingArrow,
  useClickHandlers,
  useIntersectionObserver,
  useRouterStuff,
} from "@dub/ui";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  createContext,
  Dispatch,
  memo,
  SetStateAction,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { FolderIcon } from "../folders/folder-icon";
import { LinkDetailsColumn } from "./link-details-column";
import { LinkTests } from "./link-tests";
import { LinkTitleColumn } from "./link-title-column";
import { ResponseLink } from "./links-container";

// #region 学习笔记：createContext<类型>(默认值)
// 这句代码里其实同时写了“类型”和“值”：
// - 尖括号 <...> 里面的是 TypeScript 类型
// - 圆括号 (...) 里面的是运行时默认值
//
// 这里的类型表示：
// LinkCardContext 里存放的内容要么是：
// {
//   showTests: boolean;
//   setShowTests: Dispatch<SetStateAction<boolean>>;
// }
// 要么是 null
//
// 其中：
// - showTests 表示当前这张 LinkCard 是否展开测试区域
// - setShowTests 是 useState 返回的 setter 函数类型
// - Dispatch<SetStateAction<boolean>> 可以近似理解成：
//   (value: boolean | ((prev: boolean) => boolean)) => void
//
// 所以它支持两种调用：
// setShowTests(true)
// setShowTests((prev) => !prev)
//
// 这里默认值写成 null，表示：
// 这个 Context 不应该脱离 LinkCardContext.Provider 单独使用。
// 后面 useLinkCardContext() 里会检查，如果没包在 Provider 里就直接报错。
// #endregion
export const LinkCardContext = createContext<{
  showTests: boolean;
  setShowTests: Dispatch<SetStateAction<boolean>>;
} | null>(null);

// 不知道这个干什么用的
export function useLinkCardContext() {
  const context = useContext(LinkCardContext);
  if (!context)
    throw new Error("useLinkCardContext must be used within a LinkCard");
  return context;
}

// 这个竟然是一个服务器组件,而不是浏览器组件
export const LinkCard = memo(({ link }: { link: ResponseLink }) => {
  const [showTests, setShowTests] = useState(false);
  return (
    //我好像之前就见到过这个provider,但是一直没有深入,只把他当作一个没有ui只用来背后提供数据的,不知道现在应不应该深入
    <LinkCardContext.Provider value={{ showTests, setShowTests }}>
      {/* 这个是真实渲染的,但是不理解为什么分开写 */}
      <LinkCardInner link={link} />
    </LinkCardContext.Provider>
  );
});

//  memo 是 React 提供的一个 性能优化工具，用来让组件在 props 没变化时跳过重新渲染。
const LinkCardInner = memo(({ link }: { link: ResponseLink }) => {
  //useContext 这是 React 的 Hook，用来读取“上下文”。
  // 组件树上层提供的一组共享数据，下层组件可以直接拿，不用一层层 props 往下传。
  const { variant, loading } = useContext(CardList.Context);
  const ref = useRef<HTMLDivElement>(null);

  const router = useRouter();
  const { folderId: currentFolderId } = useCurrentFolderId();
  const { slug } = useWorkspace();
  const { queryParams } = useRouterStuff();

  // only show the folder icon if:
  // - loading is complete
  // - the link has a folder id AND the currentFolderId is not the same as the link's folder id
  const showFolderIcon = useMemo(() => {
    return Boolean(
      !loading && link.folderId && currentFolderId !== link.folderId,
    );
  }, [loading, link.folderId, currentFolderId]);

  const { folder } = useFolder({
    folderId: link.folderId,
    enabled: showFolderIcon,
  });

  const editUrl = useMemo(
    () => `/${slug}/links/${link.domain}/${link.key}`,
    [slug, link.domain, link.key],
  );

  const entry = useIntersectionObserver(ref);
  const isInView = entry?.isIntersecting;

  useEffect(() => {
    if (isInView) router.prefetch(editUrl);
  }, [isInView]);

  return (
    <>
      {/* 一个ui组件 */}
      <CardList.Card
        key={link.id}
        outerClassName="overflow-hidden" // outer外部的,可能说明的是最外层的css
        innerClassName="p-0" // inner内部的,可能说明的是内部的css
        {...useClickHandlers(editUrl, router)} // 从其他地方传过来一个hooks 而且是从ui传递的不理解,还没有深入研究
        {...(variant === "loose" &&
          showFolderIcon && {
            banner: (
              <Link
                href={
                  folder
                    ? (queryParams({
                        set: { folderId: folder?.id || "" },
                        getNewPath: true,
                      }) as string)
                    : "#"
                }
                className="group flex items-center justify-between gap-2 rounded-t-xl border-b border-neutral-100 bg-neutral-50 px-5 py-2 text-xs"
              >
                <div className="flex items-center gap-1.5">
                  {folder ? (
                    <FolderIcon
                      folder={folder}
                      shape="square"
                      className="rounded"
                      innerClassName="p-0.5"
                      iconClassName="size-3"
                    />
                  ) : (
                    <div className="size-4 rounded-md bg-neutral-200" />
                  )}
                  {folder ? (
                    <span className="font-medium text-neutral-900">
                      {folder.name}
                    </span>
                  ) : (
                    <div className="h-4 w-20 rounded-md bg-neutral-200" />
                  )}
                  <ExpandingArrow className="invisible -ml-1.5 size-3.5 text-neutral-500 group-hover:visible" />
                </div>
                <p className="text-neutral-500 underline transition-colors group-hover:text-neutral-800">
                  Open folder
                </p>
              </Link>
            ),
          })}
      >
        <div className="flex items-center gap-5 px-4 py-2.5 text-sm sm:gap-8 md:gap-12">
          <div ref={ref} className="min-w-0 grow">
            <LinkTitleColumn link={link} />
          </div>
          <LinkDetailsColumn link={link} />
        </div>
        <LinkTests link={link} />
      </CardList.Card>
    </>
  );
});
