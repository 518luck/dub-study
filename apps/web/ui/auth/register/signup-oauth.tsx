"use client";

import { getValidInternalRedirectPath } from "@/lib/middleware/utils/is-valid-internal-redirect";
import { Button, Github, Google } from "@dub/ui";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

export const SignUpOAuth = ({
  methods,
}: {
  methods: ("email" | "google" | "github")[];
}) => {
  const searchParams = useSearchParams();
  const next = getValidInternalRedirectPath({
    redirectPath: searchParams.get("next"),
    currentUrl: window.location.href,
  });
  const [clickedGoogle, setClickedGoogle] = useState(false);
  const [clickedGithub, setClickedGithub] = useState(false);

  useEffect(() => {
    // when leave page, reset stat e
    return () => {
      setClickedGoogle(false);
      setClickedGithub(false);
    };
  }, []);

  // 前端点击按钮
  //   ↓
  // 调用 NextAuth 的 signIn("google")
  //   ↓
  // 浏览器跳到 /api/auth/signin/google
  //   ↓
  // NextAuth 再把用户跳到 Google 授权页
  //   ↓
  // Google 登录成功后回调到 /api/auth/callback/google
  //   ↓
  // NextAuth 后端处理 code/state，创建用户、Account、Session
  //   ↓
  // 最后跳到 callbackUrl / redirectTo
  return (
    <>
      {methods.includes("google") && (
        <Button
          variant="secondary"
          text="Continue with Google"
          onClick={() => {
            setClickedGoogle(true);
            signIn("google", {
              ...(next && next.length > 0 ? { callbackUrl: next } : {}),
            });
          }}
          loading={clickedGoogle}
          icon={<Google className="h-4 w-4" />}
        />
      )}
      {methods.includes("github") && (
        <Button
          variant="secondary"
          text="Continue with GitHub"
          onClick={() => {
            setClickedGithub(true);
            signIn("github", {
              ...(next && next.length > 0 ? { callbackUrl: next } : {}),
            });
          }}
          loading={clickedGithub}
          icon={<Github className="h-4 w-4" />}
        />
      )}
    </>
  );
};
