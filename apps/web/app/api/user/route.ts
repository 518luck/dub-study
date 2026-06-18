// =============================================================================
// /api/user 路由
// -----------------------------------------------------------------------------
// 该文件处理「当前登录用户」自身的增删改查操作（GET / PATCH / PUT / DELETE）。
// 所有接口都通过 withSession 中间件鉴权，只能操作 session 中携带的当前用户。
// =============================================================================

// 自定义 API 错误类，统一抛出带 code/message 的错误（会被全局错误处理捕获）
import { DubApiError } from "@/lib/api/errors";
// 会话鉴权高阶函数：包裹 handler，自动注入 session 并校验登录态
import { withSession } from "@/lib/auth";
// 邮箱变更确认：发送验证邮件给旧邮箱，用户点击确认后才真正切换
import { confirmEmailChange } from "@/lib/auth/confirm-email-change";
// 存储抽象层（底层对接 R2 / S3 等），用于头像文件的上传与删除
import { storage } from "@/lib/storage";
// 已上传图片的 zod schema（校验文件类型、大小等）
import { uploadedImageSchema } from "@/lib/zod/schemas/misc";
// Prisma 客户端，操作数据库
import { prisma } from "@dub/prisma";
import {
  APP_DOMAIN,        // 主站域名（如 dub.co）
  APP_HOSTNAMES,     // 主站所有合法 hostname 集合，用于区分来源（主站 / 合作伙伴站）
  PARTNERS_DOMAIN,   // 合作伙伴站域名
  R2_URL,            // 对象存储根 URL，用于判断头像是否为自托管文件
  nanoid,            // 生成短随机 id，用于头像文件名防冲突
  trim,              // zod 预处理：去除字符串首尾空白
} from "@dub/utils";
// Vercel Edge 运行时 API：将任务挂到请求生命周期之后异步执行（不阻塞响应）
import { waitUntil } from "@vercel/functions";
import { NextResponse } from "next/server";
import * as z from "zod/v4";

// -----------------------------------------------------------------------------
// PATCH 请求体的校验 schema
// 所有字段都是可选的 —— 用户可只更新其中部分字段。
// -----------------------------------------------------------------------------
const updateUserSchema = z.object({
  // 用户名：trim 后校验，长度 1~64
  name: z.preprocess(trim, z.string().min(1).max(64)).optional(),
  // 邮箱：trim 后校验为合法 email 格式
  email: z.preprocess(trim, z.email()).optional(),
  // 头像：可以是已上传图片，或 null/undefined 表示清除
  image: uploadedImageSchema.nullish(),
  // 注册来源标识（埋点用），最长 32 字符
  source: z.preprocess(trim, z.string().min(1).max(32)).optional(),
  // 默认工作区 slug：登录后默认进入的工作区
  defaultWorkspace: z.preprocess(trim, z.string().min(1)).optional(),
});

// GET /api/user – 获取当前登录用户的详细信息
export const GET = withSession(async ({ session }) => {
  // 并行查询：1) 用户主信息；2) 关联的 OAuth 账号 provider（如 github / google）
  const [user, account] = await Promise.all([
    prisma.user.findUnique({
      where: {
        id: session.user.id,
      },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        source: true,
        defaultWorkspace: true,
        defaultPartnerId: true,
        passwordHash: true,   // 仅用于判断是否设置了密码，不直接返回
        createdAt: true,
      },
    }),

    prisma.account.findFirst({
      where: {
        userId: session.user.id,
      },
      select: {
        provider: true,
      },
    }),
  ]);

  // 返回脱敏后的用户信息：
  // - 追加 provider（第三方登录来源）和 hasPassword（是否设置了密码）
  // - 显式将 passwordHash 置为 undefined，避免泄露密码哈希
  return NextResponse.json({
    ...user,
    provider: account?.provider,
    hasPassword: user?.passwordHash !== null,
    passwordHash: undefined,
  });
});

// PATCH /api/user – 编辑当前登录用户（PUT 等价于 PATCH，见文件末尾别名）
export const PATCH = withSession(async ({ req, session }) => {
  // 1. 解析并校验请求体
  let { name, email, image, source, defaultWorkspace } =
    await updateUserSchema.parseAsync(await req.json());

  // 2. 处理头像上传：如传入新图片，先上传到对象存储，再用返回的 URL 替换 image 字段
  if (image) {
    const { url } = await storage.upload({
      // key 带上 userId 和随机串，避免覆盖 / 冲突
      key: `avatars/${session.user.id}_${nanoid(7)}`,
      body: image,
    });
    image = url;
  }

  // 3. 若要修改默认工作区，需先校验当前用户确实属于该工作区，否则拒绝
  if (defaultWorkspace) {
    const workspaceUser = await prisma.projectUsers.findFirst({
      where: {
        userId: session.user.id,
        project: {
          slug: defaultWorkspace,
        },
      },
    });

    if (!workspaceUser) {
      throw new DubApiError({
        code: "forbidden",
        message: `You don't have access to the workspace ${defaultWorkspace}.`,
      });
    }
  }

  // 4. 邮箱变更需要更严格的流程：
  //    a) 新邮箱不能与已有用户重复；
  //    b) 还需向旧邮箱发送确认邮件（双因子确认），防止账号被恶意接管。
  if (email && email !== session.user.email) {
    const userWithEmail = await prisma.user.findUnique({
      where: {
        email,
      },
    });

    if (userWithEmail) {
      throw new DubApiError({
        code: "conflict",
        message: "Email is already in use.",
      });
    }

    // 根据请求来源 host 决定确认链接指向主站还是合作伙伴站
    const hostName = req.headers.get("host") || "";

    await confirmEmailChange({
      email: session.user.email,
      newEmail: email,
      identifier: session.user.id,
      hostName: APP_HOSTNAMES.has(hostName) ? APP_DOMAIN : PARTNERS_DOMAIN,
    });
  }

  // 5. 执行数据库更新（仅更新实际传入的字段）
  //    注意：email 不在此处更新 —— 它需等待用户从邮件链接确认后才真正切换。
  const response = await prisma.user.update({
    where: {
      id: session.user.id,
    },
    data: {
      ...(name && { name }),
      ...(image && { image }),
      ...(source && { source }),
      ...(defaultWorkspace && { defaultWorkspace }),
    },
  });

  // 6. 异步清理：若用户上传了新头像，且旧头像也是本系统托管的（在 R2 中），删除旧文件
  //    使用 waitUntil 让清理在响应返回后继续执行，不阻塞接口。
  waitUntil(
    (async () => {
      if (
        image &&
        session.user.image &&
        session.user.image.startsWith(`${R2_URL}/avatars/${session.user.id}`)
      ) {
        await storage.delete({
          // 把完整 URL 还原成存储 key（去掉根 URL 前缀）
          key: session.user.image.replace(`${R2_URL}/`, ""),
        });
      }
    })(),
  );

  return NextResponse.json(response);
});

// PUT 在语义上等价于 PATCH，直接复用同一实现
export const PUT = PATCH;

// DELETE /api/user – 删除当前登录用户账号
export const DELETE = withSession(async ({ session }) => {
  // 1. 安全检查：用户必须是任意一个工作区的 owner 才能直接删账号，
  //    否则会导致工作区无人管理。若有，要求其先转移所有权或删除工作区。
  const userIsOwnerOfWorkspaces = await prisma.projectUsers.findMany({
    where: {
      userId: session.user.id,
      role: "owner",
    },
  });
  if (userIsOwnerOfWorkspaces.length > 0) {
    return new Response(
      "You must transfer ownership of your workspaces or delete them before you can delete your account.",
      { status: 422 },
    );
  } else {
    // 2. 删除用户记录
    const user = await prisma.user.delete({
      where: {
        id: session.user.id,
      },
    });
    // 3. 顺带清理用户在对象存储中的自定义头像（仅当是本系统托管的）
    if (
      user.image &&
      user.image.startsWith(`${R2_URL}/avatars/${session.user.id}`)
    ) {
      await storage.delete({ key: user.image.replace(`${R2_URL}/`, "") });
    }
    return NextResponse.json(user);
  }
});
