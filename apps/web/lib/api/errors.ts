import { NextResponse } from "next/server";
import "server-only";
import { generateErrorMessage } from "zod-error";
import { ZodOpenApiResponseObject } from "zod-openapi";
import * as z from "zod/v4";
import { logger } from "../axiom/server";
import { ErrorCode, ErrorCodes } from "./error-codes";

const speakeasyErrorOverrides: Record<z.infer<typeof ErrorCode>, string> = {
  bad_request: "BadRequest",
  unauthorized: "Unauthorized",
  forbidden: "Forbidden",
  exceeded_limit: "ExceededLimit",
  not_found: "NotFound",
  conflict: "Conflict",
  invite_pending: "InvitePending",
  invite_expired: "InviteExpired",
  unprocessable_entity: "UnprocessableEntity",
  rate_limit_exceeded: "RateLimitExceeded",
  internal_server_error: "InternalServerError",
};

const ErrorSchema = z.object({
  error: z.object({
    code: ErrorCode.meta({
      description: "A short code indicating the error code returned.",
      example: "not_found",
    }),
    message: z.string().meta({
      description: "A human readable error message.",
      example: "The requested resource was not found.",
    }),
    doc_url: z.string().optional().meta({
      description: "A URL to more information about the error code reported.",
      example: "https://dub.co/docs/api-reference",
    }),
  }),
});

type ErrorResponse = z.infer<typeof ErrorSchema>;
export type ErrorCodes = z.infer<typeof ErrorCode>;

export class DubApiError extends Error {
  public readonly code: z.infer<typeof ErrorCode>;
  public readonly docUrl?: string;

  constructor({
    code,
    message,
    docUrl,
  }: {
    code: z.infer<typeof ErrorCode>;
    message: string;
    docUrl?: string;
  }) {
    super(message);
    this.code = code;
    this.docUrl = docUrl ?? `${docErrorUrl}#${code.replace("_", "-")}`;
  }
}

const docErrorUrl = "https://dub.co/docs/api-reference/errors";

export function fromZodError(error: z.ZodError): ErrorResponse {
  return {
    error: {
      code: "unprocessable_entity",
      message: generateErrorMessage(error.issues, {
        maxErrors: 1,
        delimiter: {
          component: ": ",
        },
        path: {
          enabled: true,
          type: "objectNotation",
          label: "",
        },
        code: {
          enabled: true,
          label: "",
        },
        message: {
          enabled: true,
          label: "",
        },
      }),
      doc_url: `${docErrorUrl}#unprocessable-entity`,
    },
  };
}

// =============================================================================
// handleApiError —— API 错误统一归一化处理
// -----------------------------------------------------------------------------
// 作用：把任意"抛出来的错误"转换成"统一的 API 响应结构 + HTTP 状态码"。
// 这是整个 API 错误处理的"中枢"：所有路由 try/catch 捕获到的 error 最终
// 都会流到这里，被识别 / 包装 / 返回给客户端。
//
// 处理顺序（从具体到宽泛，命中即返回）：
//   1. ZodError     —— 入参校验失败（422 Unprocessable Entity）
//   2. DubApiError  —— 项目自定义业务错误（按 code 映射对应 HTTP 状态码）
//   3. Prisma P2025 —— 数据库层"记录不存在"错误（统一转成 404）
//   4. Fallback     —— 其他未识别错误，统一返回 500，并隐藏内部细节
//
// 返回值：{ error: ErrorResponse, status: number }
//   - error   最终写入响应体的 JSON 结构（含 code/message/doc_url）
//   - status  对应的 HTTP 状态码
// =============================================================================
function handleApiError(error: any): ErrorResponse & { status: number } {
  // —— 副作用：日志双写 ——
  // 1) 控制台打印：方便本地开发 / 日志聚合系统采集
  console.error(error.message);

  // 2) Axiom 远程日志：线上错误追踪与告警（必须 flush 才会真正上报，
  //    因为 Vercel Edge / Serverless 实例随时可能被回收）
  logger.error(error.message, error);
  logger.flush();

  // —— 分支 1：Zod 校验错误 ——
  // 业务层用 zod schema 解析请求体 / 查询参数失败时抛出。
  // fromZodError 会把字段级错误（如 "email must be a valid email"）
  // 拼接成对用户友好的提示，统一映射为 422。
  if (error instanceof z.ZodError) {
    return {
      ...fromZodError(error),
      status: ErrorCodes.unprocessable_entity,
    };
  }

  // —— 分支 2：项目自定义业务错误 ——
  // 业务代码主动 throw new DubApiError({ code: "forbidden", ... }) 抛出。
  // code 是预定义的错误码字符串（见 ErrorCode enum），ErrorCodes 表把
  // code 映射到对应的 HTTP 状态码（如 forbidden -> 403, unauthorized -> 401）。
  // doc_url 指向文档锚点，便于调用方排查。
  if (error instanceof DubApiError) {
    return {
      error: {
        code: error.code,
        message: error.message,
        doc_url: error.docUrl,
      },
      status: ErrorCodes[error.code],
    };
  }

  // —— 分支 3：Prisma "记录不存在"错误 ——
  // P2025 是 Prisma 的错误码：当 update/delete 操作的目标记录不存在时抛出。
  // 这里把它"翻译"成 HTTP 语义下的 404，让客户端不用关心底层 ORM。
  // meta.cause 是 Prisma 给出的具体原因（如 "Link with id xxx not found"），
  // 优先用它作为错误信息；否则退回到 error.message，再退回到兜底文案。
  if (error.code === "P2025") {
    return {
      error: {
        code: "not_found",
        message:
          error?.meta?.cause ||
          error.message ||
          "The requested resource was not found.",
        doc_url: `${docErrorUrl}#not-found`,
      },
      status: 404,
    };
  }

  // —— 分支 4：兜底（未识别错误）——
  // 走到这里说明是不在预期内的异常（如 DB 连接断、第三方服务挂、空指针等）。
  // 关键原则：**对客户端隐藏真实错误信息**，避免泄露内部实现细节（如
  // SQL 片段、堆栈、文件路径），这些信息可能被攻击者利用。
  // 真实错误已在上面通过 console + Axiom 记录，客服/开发可从日志查。
  return {
    error: {
      code: "internal_server_error",
      message:
        "An internal server error occurred. Please contact our support if the problem persists.",
      doc_url: `${docErrorUrl}#internal-server-error`,
    },
    status: 500,
  };
}

// =============================================================================
// handleAndReturnErrorResponse —— 把"错误对象"包装成 NextResponse 返回
// -----------------------------------------------------------------------------
// 作用：路由层 try/catch 的最外层调用这个函数，直接把错误转换成可返回的
// HTTP 响应。它做的事很简单：
//   1. 调用 handleApiError 把 err 归一化为 { error, status }
//   2. 用 NextResponse.json 包装成正式 HTTP 响应，并透传调用方传来的 headers
//      （headers 常用于回写 X-RateLimit-* 限流信息：即使请求失败，
//       客户端也能从响应头里看到当前配额状态，做退避）
// =============================================================================
export function handleAndReturnErrorResponse(err: unknown, headers?: Headers) {
  const { error, status } = handleApiError(err);
  return NextResponse.json<ErrorResponse>({ error }, { headers, status });
}

export const errorSchemaFactory = (
  code: z.infer<typeof ErrorCode>,
  description: string,
): ZodOpenApiResponseObject => {
  return {
    description,
    content: {
      "application/json": {
        schema: {
          "x-speakeasy-name-override": speakeasyErrorOverrides[code],
          type: "object",
          properties: {
            error: {
              type: "object",
              properties: {
                code: {
                  type: "string",
                  enum: [code],
                  description:
                    "A short code indicating the error code returned.",
                  example: code,
                },
                message: {
                  "x-speakeasy-error-message": true,
                  type: "string",
                  description:
                    "A human readable explanation of what went wrong.",
                  example: "The requested resource was not found.",
                },
                doc_url: {
                  type: "string",
                  description:
                    "A link to our documentation with more details about this error code",
                  example: `${docErrorUrl}#${code.replace("_", "-")}`,
                },
              },
              required: ["code", "message"],
            },
          },
          required: ["error"],
        },
      },
    },
  };
};
