import { useSearchParams } from "next/navigation";
import useWorkspace from "./use-workspace";

// 获取当前页面正在查看的文件夹ID
export default function useCurrentFolderId() {
  const { defaultFolderId } = useWorkspace();
  const searchParams = useSearchParams(); //是 Next.js 提供的 Hook，用来读取 URL 中 ? 后面的查询参数。
  // 优先使用 URL 中的 folderId 参数，如果没有则使用用户默认的文件夹 ID，最后才是 null
  //  ??是 空值合并运算符（Nullish Coalescing），意思是：左边的值是 null 或 undefined 时，才使用右边的值
  //  注意 ?? 和 || 的区别：?? 只在 null/undefined 时兜底，而 || 在所有 falsy 值（""、0、false）时都会兜底。这里用 ?? 更精确。
  let folderId = searchParams.get("folderId") ?? defaultFolderId ?? null;

  // 在 Dub 的文件夹功能里，用户可以在文件夹下拉菜单中选择"Unsorted"（未分类），表示只看不属于任何文件夹的链接。
  if (folderId === "unsorted") {
    folderId = null;
  }

  return { folderId };
}
