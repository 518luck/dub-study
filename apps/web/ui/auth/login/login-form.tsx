"use client";

import { AnimatedSizeContainer, Button, useLocalStorage } from "@dub/ui";
import { useSearchParams } from "next/navigation";
import {
  ComponentType,
  Dispatch,
  SetStateAction,
  createContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import { AuthMethodsSeparator } from "../auth-methods-separator";
import { EmailSignIn } from "./email-sign-in";
import { GitHubButton } from "./github-button";
import { GoogleButton } from "./google-button";
import { SSOSignIn } from "./sso-sign-in";

export const authMethods = [
  "google",
  "github",
  "email",
  "saml",
  "password",
] as const; // as const 获取准确类型

// - 先拿到 authMethods 的类型
// - 再取这个数组任意元素的类型
export type AuthMethod = (typeof authMethods)[number];

export const errorCodes = {
  "no-credentials": "Please provide an email and password.",
  "invalid-credentials": "Email or password is incorrect.",
  "exceeded-login-attempts":
    "Account has been locked due to too many login attempts. Please contact support to unlock your account.",
  "too-many-login-attempts": "Too many login attempts. Please try again later.",
  "email-not-verified": "Please verify your email address.",
  "framer-account-linking-not-allowed":
    "It looks like you already have an account with us. Please sign in with your Framer account email instead.",
  "require-saml-sso":
    "Your organization requires authentication through your company's identity provider.",
  Callback:
    "We encountered an issue processing your request. Please try again or contact support if the problem persists.",
  OAuthSignin:
    "There was an issue signing you in. Please ensure your provider settings are correct.",
  OAuthCallback:
    "We faced a problem while processing the response from the OAuth provider. Please try again.",
};

//  登录表单状态共享中心
export const LoginFormContext = createContext<{
  authMethod: AuthMethod | undefined;
  setAuthMethod: Dispatch<SetStateAction<AuthMethod | undefined>>;
  clickedMethod: AuthMethod | undefined;
  showPasswordField: boolean;
  showSSOOption: boolean;
  setShowPasswordField: Dispatch<SetStateAction<boolean>>;
  setClickedMethod: Dispatch<SetStateAction<AuthMethod | undefined>>;
  setLastUsedAuthMethod: Dispatch<SetStateAction<AuthMethod | undefined>>;
  setShowSSOOption: Dispatch<SetStateAction<boolean>>;
}>({
  authMethod: undefined,
  setAuthMethod: () => {},
  clickedMethod: undefined,
  showPasswordField: false,
  showSSOOption: false,
  setShowPasswordField: () => {},
  setClickedMethod: () => {},
  setLastUsedAuthMethod: () => {},
  setShowSSOOption: () => {},
});

export default function LoginForm({
  methods = [...authMethods], //  - 这个组件默认展示所有登录方式
  next, // - 登录成功后，用户应该跳转到哪个页面
}: {
  methods?: AuthMethod[];
  next?: string;
}) {
  const searchParams = useSearchParams();
  //  - 当前要不要显示密码输入框
  const [showPasswordField, setShowPasswordField] = useState(false);
  const [showSSOOption, setShowSSOOption] = useState(false);
  const [clickedMethod, setClickedMethod] = useState<AuthMethod | undefined>(
    undefined,
  );

  //  记录用户上次使用的登录方式，并持久化到浏览器 localStorage，刷新后仍可读取
  const [lastUsedAuthMethodLive, setLastUsedAuthMethod] = useLocalStorage<
    AuthMethod | undefined
  >("last-used-auth-method", undefined);

  // 保存一个“不会随着重新渲染自动变化的值”
  const { current: lastUsedAuthMethod } = useRef<AuthMethod | undefined>(
    lastUsedAuthMethodLive,
  );

  //  - 创建一个状态 authMethod，表示“当前主登录方式”；初始化时优先用用户上次用过的登
  //    录方式，如果上次没有合法值，就默认用 "email"。
  const [authMethod, setAuthMethod] = useState<AuthMethod | undefined>(
    authMethods.find((m) => m === lastUsedAuthMethodLive) ?? "email",
  );

  //页面加载后，如果 URL 查询参数里带了 error，就弹出一个错误提示。
  useEffect(() => {
    const error = searchParams?.get("error");
    if (error) {
      toast.error(
        errorCodes[error] ||
          //发生意外错误。请稍后再试
          "An unexpected error occurred. Please try again later.",
      );
    }
  }, [searchParams]);

  // Reset the state when leaving the page
  //离开页面时重置状态
  useEffect(() => () => setClickedMethod(undefined), []);

  const authProviders: {
    method: AuthMethod; //    登录方式名字
    component: ComponentType; // 这个方式对应哪个 React 组件
    props?: Record<string, unknown>; // 渲染这个组件时要传什么参数（可选）
  }[] = [
    {
      method: "google",
      component: GoogleButton,
      props: { next },
    },
    {
      method: "github",
      component: GitHubButton,
    },
    {
      method: "email",
      component: EmailSignIn,
      props: { next },
    },
    {
      method: "saml",
      component: SSOSignIn,
    },
  ];

  // 从所有登录方式里，找出“当前选中的那个登录方式配置对象”。
  const currentAuthProvider = authProviders.find(
    (provider) => provider.method === authMethod,
  );

  const AuthMethodComponent = currentAuthProvider?.component;

  const showEmailPasswordOnly = authMethod === "email" && showPasswordField;

  return (
    //把登录表单的公共状态共享给下面所有子组件
    <LoginFormContext.Provider
      value={{
        authMethod,
        setAuthMethod,
        clickedMethod,
        showPasswordField,
        showSSOOption,
        setShowPasswordField,
        setClickedMethod,
        setLastUsedAuthMethod,
        setShowSSOOption,
      }}
    >
      <div className="flex flex-col gap-3">
        {/* 
          组件包裹着所有登录方式，它会根据里面子组件实际高度，自动算出总高度并做平滑过渡
          这样切换登录方式时，整个登录弹窗的高度就会平滑变高或变矮，不再“跳变”
        */}
        <AnimatedSizeContainer height>
          <div className="flex flex-col gap-3 p-1">
            {/* 第一大块：显示当前主登录方式 */}
            {authMethod && (
              <div className="flex flex-col gap-3">
                {AuthMethodComponent && (
                  <AuthMethodComponent {...currentAuthProvider?.props} />
                )}

                {/* 当当前主登录方式等于上次登录方式，且不是 email/password-only 模式时，显示提
  示文案 */}
                {/* showEmailPasswordOnly : 如果当前已经进入邮箱密码专注模式，那就不要显示“上次登录方式提示”。 */}
                {!showEmailPasswordOnly &&
                  //当前选中的登录方式，是否等于用户上次使用的登录方式。
                  authMethod === lastUsedAuthMethod && (
                    <div className="text-center text-xs">
                      <span className="text-neutral-500">
                        {/* 你上次是用 某种方式 登录的。 */}
                        You signed in with
                        {/* charAt: 取某个位置上的字符
                        toUpperCase:  把字母变成大写 */}
                        {lastUsedAuthMethod.charAt(0).toUpperCase() +
                          lastUsedAuthMethod.slice(1)}
                        last time
                      </span>
                    </div>
                  )}

                {/* 分隔线 */}
                <AuthMethodsSeparator />
              </div>
            )}

            {/* 显示“上次登录方式提示”和“继续使用其他方式”按钮的条件切换区域 */}
            {showEmailPasswordOnly ? (
              // - 如果已经进入 email + password 专注模式
              //     -> 就不要再显示所有其他登录方式了
              //     -> 只显示一个“换别的方法”的按钮
              // - 如果还没进入这个模式
              //     -> 就继续显示其他登录方式列表
              <div className="mt-2">
                <Button
                  variant="secondary"
                  onClick={() => setShowPasswordField(false)}
                  text="Continue with another method"
                />
              </div>
            ) : (
              authProviders
                .filter(
                  (provider) =>
                    provider.method !== authMethod &&
                    methods.includes(provider.method),
                )
                .map((provider) => (
                  <div key={provider.method}>
                    <provider.component />
                  </div>
                ))
            )}
          </div>
        </AnimatedSizeContainer>
      </div>
    </LoginFormContext.Provider>
  );
}
