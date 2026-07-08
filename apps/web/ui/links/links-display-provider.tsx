/*
 * ============================================================
 * LinksDisplayProvider —— 链接列表「显示偏好」的状态中枢
 * ============================================================
 *
 * 这个文件解决一个问题：用户在 /links 页面上，对链接列表有很多
 * 「显示方式」的偏好（卡片/行视图、排序、显示哪些列、是否显示归档链接）。
 *
 * 这些偏好需要满足三个需求：
 *   1. 本地可改 —— 用户点一下立刻切换
 *   2. 远端持久化 —— 刷新/换设备后还在（存到 workspace preferences）
 *   3. 可被 URL 覆盖 —— 通过 ?sortBy=xxx 这样的 query 临时覆盖
 *
 * 所以这里设计了一套「本地值 vs 持久值」的双层状态：
 *   - persisted：服务端持久化的值（真源 source of truth）
 *   - 本地 state：用户当前看到的值，可以偏离 persisted（就是 dirty 状态）
 *
 * 暴露三个动作：
 *   - persist：把本地值写回服务端（变干净）
 *   - reset：把本地值丢掉，回到 persisted（也变干净）
 *   - isDirty：判断当前是否「有未保存的改动」
 *
 * 整体是个典型的 Context + 自定义 Hook 的 React 模式。
 */
import {
  defaultLinksDisplayProperties,
  LinksDisplayProperty,
  linksSortOptions,
  LinksSortSlug,
  LinksViewMode,
  linksViewModes,
} from "@/lib/links/links-display";
import { useWorkspacePreferences } from "@/lib/swr/use-workspace-preferences";
import { linksDisplaySchema } from "@/lib/zod/schemas/workspace-preferences";
import { useSearchParams } from "next/navigation";
import {
  createContext,
  Dispatch,
  PropsWithChildren,
  SetStateAction,
  useMemo,
  useState,
} from "react";
import * as z from "zod/v4";

/*
 * 类型工具：用 zod schema 反推出每个字段精确的 TS 类型
 * ------------------------------------------------------------
 * LinksDisplayKey = "viewMode" | "sortBy" | "showArchived" | "displayProperties"
 *   即 linksDisplaySchema 里的每一个「键」
 *
 * LinksDisplayValue<K> = schema 里键 K 对应的「值类型」
 *   例如 LinksDisplayValue<"showArchived"> 就是 boolean
 *   这样下面的 useLinksDisplayOption 才能对每个字段返回正确类型
 */
type LinksDisplayKey = keyof z.infer<typeof linksDisplaySchema>;
type LinksDisplayValue<K extends LinksDisplayKey> = z.infer<
  typeof linksDisplaySchema
>[K];

/*
 * useLinksDisplayOption —— 单个显示选项的状态封装
 * ------------------------------------------------------------
 * 这是个「泛型自定义 Hook」。它把每个选项（视图模式、排序……）的
 * 三件套打包：[当前值, 设置器, 重置函数]。
 *
 * 为什么要这样一个 hook？
 *   因为 viewMode / sortBy / showArchived / displayProperties 这四个选项
 *   的逻辑完全一样：都有「当前值」「持久值」「可重置」，只是类型不同。
 *   用泛型 <K> 把这套逻辑写一遍，四处复用，避免重复代码。
 *
 * 参数：
 *   key            —— 在 persisted 对象里取哪个字段
 *   persisted      —— 服务端持久化对象（重置时回到它）
 *   overrideValue  —— 可选的「URL 覆盖值」，比如 ?sortBy=clicks
 *                     传了就用它做初始值，没传就用 persisted[key]
 *
 * 返回元组 [value, setValue, reset]：
 *   value    —— 当前显示用的值（useState 管理）
 *   setValue —— 改它（和 useState 的 setter 一样）
 *   reset    —— 一键回到 persisted[key]（注意它就是 setValue(persisted[key])，
 *               所以 reset 改的是「本地值」，服务端持久值不变）
 *
 * 小细节：overrideValue ?? persisted[key]
 *   ?? 是「空值合并」：只有 undefined/null 才走右边。
 *   也就是说 overrideValue 传了就用它做初始值（URL 优先级最高）。
 */
function useLinksDisplayOption<K extends LinksDisplayKey>(
  key: K,
  persisted: z.infer<typeof linksDisplaySchema>,
  overrideValue?: LinksDisplayValue<K>,
): [
  LinksDisplayValue<K>,
  Dispatch<SetStateAction<LinksDisplayValue<K>>>,
  () => void,
] {
  // useState 只在首次渲染读初值，所以 URL 覆盖只在「进入页面时」生效一次。
  const [value, setValue] = useState(overrideValue ?? persisted[key]);

  // reset 是个稳定闭包：重置 = 把本地值打回持久值。
  return [value, setValue, () => setValue(persisted[key])];
}

/*
 * Context：对外暴露的「显示偏好」契约
 * ------------------------------------------------------------
 * 这里定义 Context 的 value 形状（type）和默认值（兜底）。
 *
 * 注意：默认值都是「空实现」（setXxx: () => {}）。
 *   这只是为了让「没被 Provider 包裹」时不报错，
 *   真正能用的值在下面的 LinksDisplayProvider 里提供。
 *   这是 React Context 的标准套路。
 *
 * 暴露的字段分四组：
 *   1. viewMode / setViewMode        —— 卡片视图 or 行视图
 *   2. displayProperties / set...    —— 显示哪些列/属性
 *   3. sortBy / setSort              —— 排序方式
 *   4. showArchived / setShow...     —— 是否显示已归档
 *   5. isDirty / persist / reset     —— 脏检查 + 保存 + 重置
 */
export const LinksDisplayContext = createContext<{
  viewMode: LinksViewMode;
  setViewMode: Dispatch<SetStateAction<LinksViewMode>>;
  displayProperties: LinksDisplayProperty[];
  setDisplayProperties: Dispatch<SetStateAction<LinksDisplayProperty[]>>;
  sortBy: LinksSortSlug;
  setSort: Dispatch<SetStateAction<LinksSortSlug>>;
  showArchived: boolean;
  setShowArchived: Dispatch<SetStateAction<boolean>>;
  isDirty: boolean;
  persist: () => void;
  reset: () => void;
}>({
  viewMode: "cards",
  setViewMode: () => {},
  displayProperties: defaultLinksDisplayProperties,
  setDisplayProperties: () => {},
  sortBy: linksSortOptions[0].slug,
  setSort: () => {},
  showArchived: false,
  setShowArchived: () => {},
  /** Whether the current values differ from the persisted values */
  isDirty: false,
  /** Updates the persisted values to the current values */
  persist: () => {},
  /** Resets the current values to the persisted values */
  reset: () => {},
});

/*
 * parseSort —— URL 里 sortBy 字符串的「安全解析」
 * ------------------------------------------------------------
 * 用户可能在地址栏乱写 ?sortBy=xxx，这里要做防御：
 *   1. 去 linksSortOptions 里找有没有匹配的 slug
 *   2. 找不到就 fallback 到第一个（默认排序）
 *
 * find(...)?.slug ?? linksSortOptions[0].slug
 *   能找到就用它，找不到就用默认，永远不会返回非法值。
 */
const parseSort = (sort: string) =>
  linksSortOptions.find(({ slug }) => slug === sort)?.slug ??
  linksSortOptions[0].slug;

/*
 * LinksDisplayProvider —— 真正的状态容器
 * ------------------------------------------------------------
 * 这是组件树里实际放状态的地方。它的工作：
 *   1. 从 URL 读「覆盖值」（sortBy / showArchived）
 *   2. 从服务端读「持久值」（useWorkspacePreferences）
 *   3. 为四个选项各开一份本地状态（useLinksDisplayOption）
 *   4. 计算 isDirty
 *   5. 把这一切打包塞进 Context.Provider，给子树用
 *
 * 数据流全景：
 *   URL query（最高优先级，仅初始）
 *        ↓ overrideValue
 *   本地 state（用户实时在改的）──┐
 *        │                       │ isDirty = 比较这两层
 *   persisted 持久值（服务端）───┘
 *        ↑ persist（写回）
 *        ↓ reset（覆盖本地）
 */
export function LinksDisplayProvider({ children }: PropsWithChildren) {
  // ① 读 URL query：用做「初始覆盖值」
  //    useSearchParams 是 next/navigation 的 hook，读当前地址栏参数。
  const searchParams = useSearchParams();
  const sortRaw = searchParams?.get("sortBy");
  const showArchivedRaw = searchParams?.get("showArchived");

  // ② 读服务端持久化值（真源 source of truth）
  //    useWorkspacePreferences(key, defaultValue)
  //    返回 [当前持久值, 写入函数]。第一次加载时用 defaultValue 兜底。
  //    persisted 可能为 undefined（首次加载/未设置），所以后面用 persisted! 断言。
  const [persisted, setPersisted] = useWorkspacePreferences("linksDisplay", {
    viewMode: linksViewModes[0],
    sortBy: linksSortOptions[0].slug,
    showArchived: false,
    displayProperties: defaultLinksDisplayProperties,
  });

  // ③ 为每个选项开一份本地状态
  //    viewMode：没有 URL 覆盖，直接用持久值做初始值。
  const [viewMode, setViewMode, resetViewMode] = useLinksDisplayOption(
    "viewMode",
    persisted!,
  );

  //    sortBy：如果有 ?sortBy=xxx，就把它解析后当初始值（URL 优先）。
  const [sortBy, setSort, resetSort] = useLinksDisplayOption(
    "sortBy",
    persisted!,
    sortRaw ? parseSort(sortRaw) : undefined,
  );

  //    showArchived：?showArchived=true 才算开，其它值都当 false 处理。
  const [showArchived, setShowArchived, resetShowArchived] =
    useLinksDisplayOption(
      "showArchived",
      persisted!,
      showArchivedRaw ? showArchivedRaw === "true" : undefined,
    );

  //    displayProperties：显示哪些列，没有 URL 覆盖。
  const [displayProperties, setDisplayProperties, resetDisplayProperties] =
    useLinksDisplayOption("displayProperties", persisted!);

  // ④ isDirty：判断「本地值」是否偏离了「持久值」
  //    只要四个选项里任意一个不一样，就是 dirty。
  //    用 useMemo 缓存，避免每次渲染都重算（依赖项变了才算）。
  //
  //    注意 displayProperties 是数组，比较时：
  //      先 slice() 拷贝 → sort() 排序 → join(",") 拼字符串
  //    这样忽略元素顺序，只比较「内容集合」是否一致。
  //    （因为列的先后顺序不影响「是否相同」这个语义。）
  //
  //    依赖里有个小技巧：JSON.stringify(persisted)
  //    persisted 是个对象，直接放依赖数组 React 只比引用，
  //    这里用 stringify 把它变成字符串比内容，保证值变了能触发重算。
  const isDirty = useMemo(() => {
    if (viewMode !== persisted?.viewMode) return true;
    if (sortBy !== persisted?.sortBy) return true;
    if (showArchived !== persisted?.showArchived) return true;
    if (
      displayProperties.slice().sort().join(",") !==
      persisted?.displayProperties.slice().sort().join(",")
    )
      return true;

    return false;
  }, [
    JSON.stringify(persisted),
    viewMode,
    sortBy,
    showArchived,
    displayProperties,
  ]);

  // ⑤ 把所有状态和方法打包，提供给子树
  //    persist：写回服务端 —— 把当前本地值整体 setPersisted。
  //    reset：丢掉本地改动 —— 四个选项各自 reset（回到 persisted）。
  //
  //    viewMode as / sortBy as 这两个类型断言：
  //    因为 useLinksDisplayOption 返回的是 schema 推断的宽类型，
  //    这里收窄回业务上更具体的 LinksViewMode / LinksSortSlug。
  return (
    <LinksDisplayContext.Provider
      value={{
        viewMode: viewMode as LinksViewMode,
        setViewMode,
        displayProperties,
        setDisplayProperties,
        sortBy: sortBy as LinksSortSlug,
        setSort,
        showArchived,
        setShowArchived,
        isDirty,
        persist: () =>
          setPersisted({
            viewMode,
            sortBy,
            showArchived,
            displayProperties,
          }),
        reset: () => {
          resetViewMode();
          resetDisplayProperties();
          resetSort();
          resetShowArchived();
        },
      }}
    >
      {children}
    </LinksDisplayContext.Provider>
  );
}
