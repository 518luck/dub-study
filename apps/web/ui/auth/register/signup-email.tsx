"use client";

import { sendOtpAction } from "@/lib/actions/send-otp";
import { signUpSchema } from "@/lib/zod/schemas/auth";
import { PasswordRequirements } from "@/ui/shared/password-requirements";
import { Button, Input, useMediaQuery } from "@dub/ui";
import { useAction } from "next-safe-action/hooks";
import { FormEvent, useCallback, useState } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { toast } from "sonner";
import * as z from "zod/v4";
import { useRegisterContext } from "./context";

type SignUpProps = z.infer<typeof signUpSchema>;

export const SignUpEmail = () => {
  const { isMobile } = useMediaQuery();

  const { setStep, setEmail, setPassword, email, lockEmail } =
    useRegisterContext();

  const [showPassword, setShowPassword] = useState(false);

  const form = useForm<SignUpProps>({
    defaultValues: {
      email,
    },
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
    getValues,
  } = form;

  //“把这个服务端函数包装成一个前端可控的 action controller”
  // 这个就是 next-safe-action的最终消费方式
  const { executeAsync, isPending } = useAction(sendOtpAction, {
    onSuccess: () => {
      setEmail(getValues("email"));
      setPassword(getValues("password"));
      setStep("verify");
    },
    onError: ({ error }) => {
      toast.error(
        error.serverError ||
          error.validationErrors?.email?.[0] ||
          error.validationErrors?.password?.[0],
      );
    },
  });

  const onSubmit = useCallback(
    (e: FormEvent) => {
      const { email, password } = getValues();

      if (email && !password && !showPassword) {
        e.preventDefault(); // 阻止表单默认提交行为
        e.stopPropagation(); // 阻止事件继续冒泡
        setShowPassword(true);
        return;
      }

      handleSubmit(async (data) => await executeAsync(data))(e);
    },
    [getValues, showPassword, handleSubmit, executeAsync],
  );

  return (
    <form onSubmit={onSubmit}>
      <div className="flex flex-col gap-y-6">
        <label>
          <span className="text-content-emphasis mb-2 block text-sm font-medium leading-none">
            Email
          </span>
          <Input
            type="email" // 原生属性：声明这是邮箱输入框，浏览器会做基础邮箱格式校验。
            placeholder="panic@thedis.co" // 原生属性：输入框为空时显示的占位提示。
            autoComplete="email" // 原生属性：提示浏览器/密码管理器可自动填充邮箱。
            required // 原生属性：提交表单前要求这个字段不能为空。
            readOnly={!errors.email && lockEmail} // 原生属性：满足条件时禁止用户编辑邮箱。
            autoFocus={!isMobile && !showPassword && !lockEmail} // 原生属性：满足条件时页面加载后自动聚焦到该输入框。
            {...register("email")} // react-hook-form：注册 email 字段，并注入 name、onChange、onBlur、ref 等属性。
            error={errors.email?.message} // @dub/ui Input 自定义属性：显示错误样式和错误文案。
          />
        </label>
        {showPassword && (
          <label>
            <span className="text-content-emphasis mb-2 block text-sm font-medium leading-none">
              Password
            </span>
            <Input
              type="password"
              required
              autoFocus={!isMobile}
              {...register("password")}
              error={errors.password?.message}
              minLength={8}
            />
            {/* 现在把这个 form 通过 FormProvider 提供给子组件 */}
            <FormProvider {...form}>
              <PasswordRequirements />
            </FormProvider>
          </label>
        )}
        <Button
          type="submit"
          text={isPending ? "Submitting..." : "Sign Up"}
          disabled={isPending}
          loading={isPending}
        />
      </div>
    </form>
  );
};
