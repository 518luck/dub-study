import { Redis } from "@upstash/redis";

// Initiate Redis instance by connecting to REST URL
//通过连接到 REST URL 来启动 Redis 实例
export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL || "",
  token: process.env.UPSTASH_REDIS_REST_TOKEN || "",
});

// This is a separate global Redis instance that we use
// for global operations (e.g. linkCache, recordClick)
// so that if this redis goes down, it won't impact other endpoints
// 这是一个独立的全局 Redis 实例，我们将其用于全局操作（例如链接缓存、记录点击等），
// 以便如果这个 Redis 服务出现故障，也不会影响其他端点。
const hasGlobalRedisConfig =
  !!process.env.UPSTASH_GLOBAL_REDIS_REST_URL &&
  !!process.env.UPSTASH_GLOBAL_REDIS_REST_TOKEN;

// 如果有全局 Redis 配置（存在上下文中），就用全局配置，否则用默认配置
const redisConfig = {
  url: hasGlobalRedisConfig
    ? process.env.UPSTASH_GLOBAL_REDIS_REST_URL
    : process.env.UPSTASH_REDIS_REST_URL || "",
  token: hasGlobalRedisConfig
    ? process.env.UPSTASH_GLOBAL_REDIS_REST_TOKEN
    : process.env.UPSTASH_REDIS_REST_TOKEN || "",
};

export const redisGlobal = new Redis(redisConfig);

export const redisGlobalWithTimeout = new Redis({
  ...redisConfig,
  signal: () => AbortSignal.timeout(1500),
});
