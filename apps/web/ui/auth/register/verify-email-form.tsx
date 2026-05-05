"use client";

import { createUserAccountAction } from "@/lib/actions/create-user-account";
import { getValidInternalRedirectPath } from "@/lib/middleware/utils/is-valid-internal-redirect";
import { AnimatedSizeContainer, Button, useMediaQuery } from "@dub/ui";
import { cn } from "@dub/utils";
import { OTPInput } from "input-otp";
import { signIn } from "next-auth/react";
import { useAction } from "next-safe-action/hooks";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { useRegisterContext } from "./context";
import { ResendOtp } from "./resend-otp";

export const VerifyEmailForm = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isMobile } = useMediaQuery();
  const [code, setCode] = useState("");
  const { email, password } = useRegisterContext();
  const [isInvalidCode, setIsInvalidCode] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);

  const { executeAsync, isPending } = useAction(createUserAccountAction, {
    async onSuccess() {
      toast.success("Account created! Redirecting to dashboard...");
      setIsRedirecting(true);

      //使用账号密码登录方式
      const response = await signIn("credentials", {
        email,
        password, //把当前邮箱和密码传进去
        redirect: false, //登录后不要让认证库自己跳转，改成由当前代码手动控制跳转
      });

      // preserve the next query param if present (and valid)
      const next = getValidInternalRedirectPath({
        redirectPath: searchParams.get("next"),
        currentUrl: window.location.href,
      });

      if (response?.ok) {
        router.push(
          `/onboarding${next ? `?next=${encodeURIComponent(next)}` : ""}`,
        );
      } else {
        toast.error(
          "Failed to sign in with credentials. Please try again or contact support.",
        );
      }
    },
    onError({ error }) {
      toast.error(error.serverError);
      setCode("");
      setIsInvalidCode(true);
    },
  });

  if (!email || !password) {
    router.push("/register");
    return;
  }

  return (
    <div className="flex flex-col gap-3">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          executeAsync({ email, password, code });
        }}
      >
        <div>
          <OTPInput
            maxLength={6} //6 位验证码
            value={code} //受控值，数据来自状态
            onChange={(code) => {
              //每次输入时同步到 code
              setIsInvalidCode(false);
              setCode(code);
            }}
            autoFocus={!isMobile} //非移动端自动聚焦
            render={({ slots }) => (
              <div className="flex w-full items-center justify-between">
                {/* - char：这一格当前输入的字符
                      - isActive：这一格当前是否聚焦
                      - hasFakeCaret：这一格是否显示伪光标 */}
                {slots.map(({ char, isActive, hasFakeCaret }, idx) => (
                  <div
                    key={idx}
                    className={cn(
                      "relative flex h-14 w-12 items-center justify-center text-xl",
                      "rounded-lg border border-neutral-200 bg-white ring-0 transition-all",
                      isActive &&
                        "z-10 border border-neutral-800 ring-2 ring-neutral-200",
                      isInvalidCode && "border-red-500 ring-red-200",
                    )}
                  >
                    {char}
                    {hasFakeCaret && (
                      <div className="animate-caret-blink pointer-events-none absolute inset-0 flex items-center justify-center">
                        <div className="h-5 w-px bg-black" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
            onComplete={() => {
              //输满 6 位后自动提交
              executeAsync({ email, password, code });
            }}
          />
          <AnimatedSizeContainer height>
            {isInvalidCode && (
              <p className="pt-3 text-center text-xs font-medium text-red-500">
                Invalid code. Please try again.
              </p>
            )}
          </AnimatedSizeContainer>

          <Button
            className="mt-8"
            text={isPending ? "Verifying..." : "Continue"}
            type="submit"
            loading={isPending || isRedirecting}
            disabled={!code || code.length < 6}
          />
        </div>
      </form>

      <ResendOtp email={email} />
    </div>
  );
};
