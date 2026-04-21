import { ratelimit } from "../upstash";

export async function rateLimitRequest({
  identifier,
  requests,
  interval,
}: {
  identifier: string;
  requests: number;
  interval: `${number} s` | `${number} m`;
}) {
  // success 表示本次请求是否通过了限流
  // limit 表示限流的上限
  // reset 表示限流的重置时间
  // remaining 表示限流的剩余次数
  const { success, limit, reset, remaining } = await ratelimit(
    requests,
    interval,
  ).limit(identifier); // 之所以还要传 identifier，是因为限流一定要知道：到底是对谁限流

  return {
    success,
    headers: {
      "Retry-After": reset.toString(),
      "X-RateLimit-Limit": limit.toString(),
      "X-RateLimit-Remaining": remaining.toString(),
      "X-RateLimit-Reset": reset.toString(),
    },
  };
}
