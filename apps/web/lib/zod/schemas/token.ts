import { SCOPES } from "@/lib/api/tokens/scopes";
import * as z from "zod/v4";
import { createPartnerSchema } from "./partners";

// =============================================================================
// Token 相关的 Zod Schema 定义
// -----------------------------------------------------------------------------
// 这个文件定义了 5 个 schema，覆盖 token 的完整生命周期：
//   ① createTokenSchema            → POST /api/tokens 请求体校验
//   ② updateTokenSchema            → PATCH /api/tokens/:id 请求体校验
//   ③ tokenSchema                  → API 返回给前端的 token 形状
//   ④ createReferralsEmbedTokenSchema → 推荐系统嵌入 token 的创建校验
//   ⑤ ReferralsEmbedTokenSchema    → 推荐嵌入 token 的返回形状
// =============================================================================

// ① 创建 token 的请求体校验 schema
// 用于 POST /api/tokens，对应前端 add-edit-token-modal.tsx 提交的数据
export const createTokenSchema = z.object({
  // name：key 的显示名称，1-50 字符，必填
  name: z
    .string({
      error: "Name is required",
    })
    .min(1)
    .max(50),
  // isMachine：是否创建 Machine User（独立 bot 账号）
  // 可选，默认 false（即默认绑定到当前用户）
  isMachine: z.boolean().optional().default(false),
  // scopes：权限范围数组，如 ["links.write", "domains.read"]
  // 元素必须是 SCOPES 枚举里的合法值，可选，默认空数组
  // 注意：前端传数组，后端会 join(" ") 存到 DB 的 scopes 字段
  scopes: z.array(z.enum(SCOPES)).default([]).optional(),
});

// ② 更新 token 的请求体校验 schema
// 用于 PATCH /api/tokens/:id
// 从 createTokenSchema 里 pick 出 name 和 scopes（不含 isMachine，因为类型不能改）
// .required() 让这两个字段在更新时都是必填
export const updateTokenSchema = createTokenSchema
  .pick({
    name: true,
    scopes: true,
  })
  .required();

// ③ API 返回给前端的 token 形状
// 用于 GET /api/tokens 响应数据的解析（route.ts:58 的 tokenSchema.array().parse）
// 注意这里和 createTokenSchema 的差异：scopes 是字符串 → 数组的反向转换
export const tokenSchema = z.object({
  id: z.string(),
  name: z.string(),
  // partialKey：脱敏显示用，形如 "dub...abcd"，UI 列表展示用
  partialKey: z.string(),
  // scopes：DB 里存的是空格分隔字符串（如 "links.write domains.read"）
  // 这里用 transform 把它 split 成数组返回给前端，方便前端使用
  // 对应 createTokenSchema 里数组 → 字符串的逆操作
  scopes: z
    .string()
    .nullable()
    .transform((val) => val?.split(" ") ?? []),
  lastUsed: z.date().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
  // user：key 的归属用户（可能是真人，也可能是 Machine User）
  user: z.object({
    id: z.string(),
    name: z.string().nullable(),
    image: z.string().nullable(),
    isMachine: z.boolean(), // 前端用它区分显示 "You" 还是 "Machine" 类型
  }),
});

// ④ 推荐系统（Referrals）嵌入 token 的创建校验
// 用于合作伙伴推荐嵌入场景，三选一提供标识符
export const createReferralsEmbedTokenSchema = z
  .object({
    partnerId: z.string().optional(), // 合作伙伴 ID
    tenantId: z.string().optional(), // 租户 ID（OAuth 集成场景）
    partner: createPartnerSchema.optional(), // 完整的合作伙伴对象
  })
  // superRefine：跨字段的自定义校验
  // 要求三个标识符至少提供一个，否则报错
  .superRefine((data, ctx) => {
    if (!data.partnerId && !data.tenantId && !data.partner) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "You must provide either partnerId, tenantId, or partner.",
      });
    }
  });

// ⑤ 推荐嵌入 token 的返回形状
// 对应生成 publicToken（前端嵌入用）+ 过期时间
export const ReferralsEmbedTokenSchema = z.object({
  publicToken: z.string(), // 对外公开的 token，嵌入到前端 SDK
  expires: z.date(), // 过期时间，过期后需要重新生成
});
