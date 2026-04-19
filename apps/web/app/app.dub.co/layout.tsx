"use client";

// 全局 modal 管理层。
import { ModalProvider } from "@/ui/modals/modal-provider";
// next-auth 提供的认证上下文。
import { SessionProvider } from "next-auth/react";
import { ReactNode } from "react";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    //  localStorage 更像前端自己保存一份数据，next-auth 更像完整的认证会话机制。
    <SessionProvider>
      <ModalProvider>{children}</ModalProvider>
    </SessionProvider>
  );
}
