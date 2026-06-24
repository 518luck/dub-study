import { redis } from "@/lib/upstash";
import * as z from "zod/v4";

// 缓存过期时间：24 小时（单位秒）
// 与 session 时长量级一致，避免缓存长期保留失效的 token 信息
const CACHE_EXPIRATION = 60 * 60 * 24; // 24 hours

// Redis Key 前缀，所有 token 缓存项都用这个前缀，方便管理和排查
// 最终 key 形如：dubTokenCache:<hashedKey>
const CACHE_KEY_PREFIX = "dubTokenCache";

// ----------------------------------------------------------
// token 缓存项的数据结构（Zod schema）
// 一份缓存里保存的是：用这个 token 能解出的所有身份 + 权限信息，
// 这样下次同一个 token 来访，就不用再去数据库 join 一堆表，
// 直接从 Redis 拿，省掉 PlanetScale 往返延迟。
// ----------------------------------------------------------
const tokenCacheItemSchema = z.object({
  // token 本身的过期时间（restricted token 可设过期）
  expires: z.date().nullish(),
  // 归属用户（机器账号 isMachine=true，没有真实邮箱/姓名）
  user: z.object({
    id: z.string(),
    name: z.string().nullable(),
    email: z.string().nullable(),
    isMachine: z.boolean(),                       // 是否机器账号（OAuth app / 集成用的）
    defaultWorkspace: z.string().nullish(),       // 默认 workspace
    defaultPartnerId: z.string().nullish(),       // 默认 partner（affiliate 业务）
  }),
  // restricted token 的 scopes（如 "links.read links.write"），决定能调哪些接口
  scopes: z.string().nullish(),
  // token 绑定的 workspace id（restricted token 必绑 workspace）
  projectId: z.string().nullish(),
  // workspace 的套餐（plan），用于按套餐限流、功能开关
  project: z
    .object({
      plan: z.string().nullish(),
    })
    .nullish(),
  // GitHub App / OAuth App 的安装 id（用于追溯是哪个集成创建的 token）
  installationId: z.string().nullish(),
});

// 由 schema 推导出的 TS 类型，供 set/get 方法签名使用
export type TokenCacheItem = z.infer<typeof tokenCacheItemSchema>;

// ============================================================
// TokenCache —— Restricted Token（含 legacy personal token）缓存层
// ------------------------------------------------------------
// 设计目的：
//   每次带 API key 的请求都要校验：
//     hashedKey → RestrictedToken 表 → User 表 → Project 表
//   这套 join 在 PlanetScale 上每查一次都是一次远端往返。
//   API 流量是高频的，缓存这一跳能显著降低鉴权延迟。
//
// 缓存策略：
//   · Key  ：dubTokenCache:<hashedKey>（注意是 hash 后的 key，明文不入缓存）
//   · TTL  ：24 小时
//   · 失效 ：token 被删除/撤回时主动调 delete / expireMany 清理
// ============================================================
// Cache for restricted tokens (and legacy personal tokens)
class TokenCache {
  // --------------------------------------------------------
  // set：写入缓存
  //   · 入参是 hashedKey（不可逆），不缓存明文 token
  //   · tokenCacheItemSchema.parse 是双重保险：
  //     ① 校验入参结构完整
  //     ② 序列化时把 Date 等转成 JSON 兼容格式
  //   · ex: CACHE_EXPIRATION 让 Redis 24h 后自动过期
  // --------------------------------------------------------
  async set({
    hashedKey,
    token,
  }: {
    hashedKey: string;
    token: TokenCacheItem;
  }) {
    return await redis.set(
      this._createKey({ hashedKey }),
      JSON.stringify(tokenCacheItemSchema.parse(token)),
      {
        ex: CACHE_EXPIRATION,
      },
    );
  }

  // --------------------------------------------------------
  // get：读取缓存
  //   redis.get<T> 内部会反序列化 JSON，并按 schema 还原字段
  //   缓存未命中返回 null（调用方需回退到数据库查询）
  // --------------------------------------------------------
  async get({ hashedKey }: { hashedKey: string }) {
    return await redis.get<TokenCacheItem>(this._createKey({ hashedKey }));
  }

  // --------------------------------------------------------
  // delete：立即删除单条缓存
  //   场景：用户在控制台主动 revoke 了某个 API key
  // --------------------------------------------------------
  async delete({ hashedKey }: { hashedKey: string }) {
    return await redis.del(this._createKey({ hashedKey }));
  }

  // --------------------------------------------------------
  // expireMany：批量把多条缓存 TTL 改成 1 秒（≈ 立即过期）
  //   场景：批量 revoke（如删 workspace 会级联触发一堆 token 失效）
  //
  // 为什么用 expire(..., 1) 而不是直接 del？
  //   · pipeline 批量 expire 比 N 次 del 更省网络往返
  //   · 1 秒后过期能给当前正在执行的请求一个短暂宽限期，
  //     避免极端并发下同一请求前后看到不一致的鉴权结果
  //
  // 空数组早返回，避免空 pipeline 浪费一次 RTT
  // --------------------------------------------------------
  async expireMany({ hashedKeys }: { hashedKeys: string[] }) {
    if (hashedKeys.length === 0) {
      return;
    }

    // pipeline：把多个 Redis 命令打包一次发送，减少网络往返
    const pipeline = redis.pipeline();

    hashedKeys.forEach((hashedKey) => {
      pipeline.expire(this._createKey({ hashedKey }), 1);
    });

    return await pipeline.exec();
  }

  // --------------------------------------------------------
  // _createKey：内部辅助，统一拼装 Redis key
  //   形如：dubTokenCache:<hashedKey>
  //   把命名规则收敛到一处，方便日后改前缀
  // --------------------------------------------------------
  _createKey({ hashedKey }: { hashedKey: string }) {
    return `${CACHE_KEY_PREFIX}:${hashedKey}`;
  }
}

// 单例：整个应用共用一份缓存实例
export const tokenCache = new TokenCache();
