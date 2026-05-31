import { prisma } from "@dub/prisma";
import { User } from "@dub/prisma/client";
import { MAX_LOGIN_ATTEMPTS } from "./constants";

// 密码登录失败时调用：把该用户的失败登录次数 +1，并在达到上限时锁定账号。
export const incrementLoginAttempts = async (
  user: Pick<User, "id" | "email">,
) => {
  // 先更新数据库里的失败次数，再把最新的失败次数和锁定状态取出来。
  const { invalidLoginAttempts, lockedAt } = await prisma.user.update({
    where: { id: user.id },
    data: {
      invalidLoginAttempts: {
        increment: 1,
      },
    },
    select: {
      lockedAt: true,
      invalidLoginAttempts: true,
    },
  });

  // 如果账号之前没有被锁定，并且失败次数已经达到最大允许次数，就记录锁定时间。
  if (!lockedAt && invalidLoginAttempts >= MAX_LOGIN_ATTEMPTS) {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        lockedAt: new Date(),
      },
    });

    // TODO:
    // Send email to user that their account has been locked
  }

  return {
    invalidLoginAttempts,
    lockedAt,
  };
};

// 判断当前用户的失败登录次数是否已经达到账号锁定阈值。
export const exceededLoginAttemptsThreshold = (
  user: Pick<User, "invalidLoginAttempts">,
) => {
  return user.invalidLoginAttempts >= MAX_LOGIN_ATTEMPTS;
};
