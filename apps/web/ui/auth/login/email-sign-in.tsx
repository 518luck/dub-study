import { checkAccountExistsAction } from "@/lib/actions/check-account-exists";
import { Button, Input, useMediaQuery } from "@dub/ui";
import { cn } from "@dub/utils";
import { signIn } from "next-auth/react";
import { useAction } from "next-safe-action/hooks";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useContext, useState } from "react";
import { toast } from "sonner";
import { errorCodes, LoginFormContext } from "./login-form";

export const EmailSignIn = ({ next }: { next?: string }) => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const finalNext = next ?? searchParams?.get("next");
  const { isMobile } = useMediaQuery();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const {
    showPasswordField,
    setShowPasswordField,
    setClickedMethod,
    authMethod,
    setAuthMethod,
    clickedMethod,
    setLastUsedAuthMethod,
    setShowSSOOption,
  } = useContext(LoginFormContext);

  const { executeAsync, isPending } = useAction(checkAccountExistsAction, {
    onError: ({ error }) => {
      toast.error(error.serverError);
    },
  });

  return (
    <>
      <form
        onSubmit={async (e) => {
          // 阻止浏览器默认提交表单，改为由当前 React 逻辑控制登录流程。
          e.preventDefault();

          // 第一次提交时只检查邮箱对应的账号状态，决定下一步展示什么。
          if (!showPasswordField) {
            const result = await executeAsync({ email });

            if (!result?.data) {
              return;
            }

            const { accountExists, hasPassword, requireSAML } = result.data;

            // 如果该邮箱域名强制使用企业 SSO，就不允许继续走邮箱/密码登录。
            if (requireSAML) {
              setClickedMethod(undefined);
              toast.error(
                "Your organization requires authentication through your company's identity provider.",
              );
              return;
            }

            // 账号存在且设置过密码时，先展示密码框，让用户选择密码登录或邮箱登录。
            if (accountExists && hasPassword) {
              setShowPasswordField(true);
              return;
            }

            // 账号不存在时终止登录流程，避免继续调用 NextAuth。
            if (!accountExists) {
              setClickedMethod(undefined);
              toast.error("No account found with that email address.");
              return;
            }
          }

          // 走到这里说明可以发起登录：可能是密码登录，也可能是邮箱 magic link 登录。
          setClickedMethod("email");

          // 登录前再查一次账号状态，避免用户停留页面期间账号状态发生变化。
          const result = await executeAsync({ email });

          if (!result?.data) {
            return;
          }

          const { accountExists, hasPassword } = result.data;

          if (!accountExists) {
            setClickedMethod(undefined);
            toast.error("No account found with that email address.");
            return;
          }

          // 输入了密码且账号有密码哈希时走 credentials；否则走 email magic link。
          const provider = password && hasPassword ? "credentials" : "email";

          // 调用 NextAuth 发起登录；redirect=false 表示由当前代码处理成功/失败和跳转。
          const response = await signIn(provider, {
            email,
            redirect: false,
            callbackUrl: finalNext || "/workspaces",
            ...(password && { password }),
          });

          if (!response) {
            return;
          }

          if (!response.ok && response.error) {
            if (errorCodes[response.error]) {
              toast.error(errorCodes[response.error]);
            } else {
              toast.error(response.error);
            }

            setClickedMethod(undefined);
            return;
          }

          // 将本次成功使用的登录方式记录下来，供后续登录页默认展示使用。
          setLastUsedAuthMethod("email");

          // 邮箱登录只发送 magic link，不直接跳转。
          if (provider === "email") {
            toast.success("Email sent - check your inbox!");
            setEmail("");
            setClickedMethod(undefined);
            return;
          }

          // 密码登录成功后跳转到 callbackUrl 或默认工作区页面。
          if (provider === "credentials") {
            router.push(response?.url || finalNext || "/workspaces");
          }
        }}
        className="flex flex-col gap-y-6"
      >
        {authMethod === "email" && (
          <label>
            <span className="text-content-emphasis mb-2 block text-sm font-medium leading-none">
              Email
            </span>
            <input
              id="email"
              name="email"
              autoFocus={!isMobile && !showPasswordField}
              type="email"
              placeholder="panic@thedis.co"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              size={1}
              className={cn(
                "block w-full min-w-0 appearance-none rounded-md border border-neutral-300 px-3 py-2 placeholder-neutral-400 shadow-sm focus:border-black focus:outline-none focus:ring-black sm:text-sm",
                {
                  "pr-10": isPending,
                },
              )}
            />
          </label>
        )}

        {showPasswordField && (
          <label>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-content-emphasis block text-sm font-medium leading-none">
                Password
              </span>
              <Link
                href={`/forgot-password?email=${encodeURIComponent(email)}`}
                className="text-content-subtle hover:text-content-emphasis text-xs leading-none underline underline-offset-2 transition-colors"
              >
                Forgot password?
              </Link>
            </div>
            <Input
              type="password"
              autoFocus={!isMobile}
              value={password}
              placeholder="Password (optional)"
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
        )}

        <Button
          text={`Log in with ${password ? "password" : "email"}`}
          {...(authMethod !== "email" && {
            type: "button",
            onClick: (e) => {
              e.preventDefault();
              setShowSSOOption(false);
              setAuthMethod("email");
            },
          })}
          loading={clickedMethod === "email" || isPending}
          disabled={clickedMethod && clickedMethod !== "email"}
        />
      </form>
    </>
  );
};
