import * as z from "zod/v4";

// 项目里统一使用的业务错误码映射。
// 左边是业务语义名称，右边是对应的 HTTP 状态码。
// 这样前后端可以用统一名字判断错误类型，而不是到处直接写 404、409 这类魔法值。
export const ErrorCodes = {
  bad_request: 400, // 请求参数错误、格式错误，或缺少必要字段
  unauthorized: 401, // 未登录，或登录凭证无效/过期
  forbidden: 403, // 已登录，但没有权限执行当前操作
  exceeded_limit: 403, // 超出套餐/配额限制
  not_found: 404, // 资源不存在，或当前用户不应看到该资源
  conflict: 409, // 资源状态冲突，例如重复创建
  invite_pending: 409, // 邀请仍处于待处理状态
  invite_expired: 410, // 邀请已过期
  unprocessable_entity: 422, // 请求格式合法，但业务语义不合法
  rate_limit_exceeded: 429, // 请求过于频繁，被限流
  internal_server_error: 500, // 服务端内部异常
} as const;

// 传入一个数组，zod 就会把数组里的每一项都当成一个合法的枚举成员。
// 所以传入 Object.keys(ErrorCodes) 之后，zod 就会把所有错误码字符串（"bad_request"、"unauthorized" 等）都变成合法的 z.enum() 成员。
export const ErrorCode = z.enum(
  // 把 ErrorCodes 这个对象的所有 key 名字取出来，变成一个数组。
  Object.keys(ErrorCodes) as [
    // 第一步 typeof ErrorCodes   拿到 ErrorCodes 这个变量对应的对象类型。
    //keyof 的作用是： 把一个对象类型的 key 提取出来，组成联合类型。
    keyof typeof ErrorCodes,
    // 后面还可以继续跟很多个 ErrorCodes 的 key。
    ...(keyof typeof ErrorCodes)[],
  ],
);

// 为什么需要 as 呢
//  Object.keys() 给的是宽类型：string[]
// z.enum() 要的是窄类型：非空、固定候选值数组
// as 就是用来把前者断言成后者
