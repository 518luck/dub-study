"use client";

// 名字叫 auth 只是开发者自己的命名，表示“这里放工作区鉴权逻辑”。
import { ErrorCodes } from "@/lib/api/error-codes";
import useWorkspace from "@/lib/swr/use-workspace";
import LayoutLoader from "@/ui/layout/layout-loader";
import { notFound, redirect, useParams } from "next/navigation";
import { ReactNode } from "react";

export default function WorkspaceAuth({ children }: { children: ReactNode }) {
  const { slug } = useParams();
  const { loading, error } = useWorkspace();

  if (loading) {
    return <LayoutLoader />;
  }

  if (error) {
    if (error.status === ErrorCodes.not_found) {
      notFound();
    } else if (
      [ErrorCodes.invite_pending, ErrorCodes.invite_expired].includes(
        error.status,
      )
    ) {
      redirect(`/${slug}/invite`);
    }
  }

  return children;
}
