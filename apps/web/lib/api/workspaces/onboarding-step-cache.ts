//  封装一个“用户 onboarding 步骤缓存器”，把用户当前 onboarding 进度临时存到Redis 里。

import { OnboardingStep } from "@/lib/onboarding/types";
import { redis } from "@/lib/upstash";

const CACHE_KEY_PREFIX = "onboarding-step";
export const ONBOARDING_WINDOW_SECONDS = 60 * 60 * 24; // 24 hours

// 封装了一套“读取/写入用户 onboarding 步骤缓存”的工具。
class OnboardingStepCache {
  //把某个用户当前 onboarding 进行到哪一步，临时记到 Redis 里。
  async set({ userId, step }: { userId: string; step: OnboardingStep }) {
    // 把一个 key-value 存进 Redis。
    return await redis.set(`${CACHE_KEY_PREFIX}:${userId}`, step, {
      //ex 表示过期时间（ expire ），单位是秒。
      ex: ONBOARDING_WINDOW_SECONDS,
    });
  }

  async mset({ userIds, step }: { userIds: string[]; step: OnboardingStep }) {
    // 创建一个 Redis 管道对象，用来把多条 Redis 操作先攒起来，再一次性执行。
    const pipeline = redis.pipeline();
    userIds.forEach((userId) => {
      pipeline.set(`${CACHE_KEY_PREFIX}:${userId}`, step, {
        ex: ONBOARDING_WINDOW_SECONDS,
      });
    });
    //真正执行前面收集到的所有 Redis 命令，并等待执行结果返回。
    return await pipeline.exec();
  }

  async get({ userId }: { userId: string }) {
    return await redis.get(`${CACHE_KEY_PREFIX}:${userId}`);
  }
}

export const onboardingStepCache = new OnboardingStepCache();
