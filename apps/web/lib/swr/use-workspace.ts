import { ExtendedWorkspaceProps } from "@/lib/types";
import { PRO_PLAN, fetcher, getNextPlan } from "@dub/utils";
import { useParams, useSearchParams } from "next/navigation";
import useSWR, { SWRConfiguration } from "swr";
import { MEGA_WORKSPACE_LINKS_LIMIT } from "../constants/misc";

// #region 这段代码的作用：先确定当前 workspace 的 slug
// 优先级：
// 1. 先从路由参数 useParams() 中取 slug
// 2. 如果路由里没有 slug，再从 URL 查询参数里取
//    - ?slug=...
//    - ?workspace=...
//
// 这样做的目的：
// 在真正调用 useSWR 发请求之前，先确定“当前到底要请求哪个 workspace”
// #endregion
export default function useWorkspace({
  swrOpts,
}: {
  swrOpts?: SWRConfiguration;
} = {}) {
  let { slug } = useParams() as { slug: string | null };
  const searchParams = useSearchParams(); //  从url中获取参数
  // 兜底逻辑：如果路由里没有 slug，尝试从搜索参数里拿
  if (!slug) {
    slug = searchParams.get("slug") || searchParams.get("workspace");
  }

  // 核心骨架
  const {
    data: workspace,
    error,
    mutate, // 函数类型 : 手动更新当前 key 对应的缓存，或者重新发请求
  } = useSWR<ExtendedWorkspaceProps>( // 泛型ExtendedWorkspaceProps  诉 TypeScript：这个请求回来后，data 应该是什么类型
    slug && `/api/workspaces/${slug}`,
    fetcher,
    {
      dedupingInterval: 60000, // 60秒内重复请求会被缓存
      ...swrOpts,
    },
  );

  return {
    ...workspace, // 展开 workspace 对象
    nextPlan: workspace?.plan ? getNextPlan(workspace.plan) : PRO_PLAN, // 计算下一个订阅计划
    role: (workspace?.users && workspace.users[0].role) || "member", // 获取当前用户的角色
    isOwner: workspace?.users && workspace.users[0].role === "owner", // 判断当前用户是否是管理员
    exceededEvents: workspace && workspace.usage >= workspace.usageLimit, // 判断当前用户是否超出了事件使用限制
    exceededLinks: workspace && workspace.linksUsage >= workspace.linksLimit, // 判断当前用户是否超出了链接使用限制
    exceededPayouts:
      workspace?.payoutsLimit &&
      workspace.payoutsUsage >= workspace.payoutsLimit
        ? true
        : false,
    exceededAI: workspace && workspace.aiUsage >= workspace.aiLimit,
    exceededDomains:
      workspace?.domains && workspace.domains.length >= workspace.domainsLimit,
    isMegaWorkspace:
      workspace && workspace.totalLinks >= MEGA_WORKSPACE_LINKS_LIMIT,
    error,
    defaultFolderId: workspace?.users && workspace.users[0].defaultFolderId,
    mutate,
    loading: slug && !workspace && !error ? true : false,
  };
}
