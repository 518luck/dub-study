import { Ratelimit } from "@upstash/ratelimit";
import { redis } from "./redis";

// 限流器工厂函数  默认：每 10 秒 10 次请求
// Create a new ratelimiter, that allows 10 requests per 10 seconds by default
export const ratelimit = (
  requests: number = 10,
  seconds:
    | `${number} ms`
    | `${number} s`
    | `${number} m`
    | `${number} h`
    | `${number} d` = "10 s",
) => {
  // 返回的是  一个 Ratelimit 实例对象
  return new Ratelimit({
    redis: redis,
    //  - requests：在一个时间窗口内最多允许多少次请求
    //  - seconds：这个时间窗口有多长
    limiter: Ratelimit.slidingWindow(requests, seconds),
    analytics: true, //表示开启 Upstash 的限流分析统计。
    prefix: "dub", //表示 Redis 里这套限流数据的 key 前缀。
    timeout: 1000, //表示限流请求的超时时间，单位是毫秒，这里是 1000ms = 1秒。
  });
};
