import { cn } from "@dub/utils";
import { InputHTMLAttributes, ReactNode, useMemo, useState } from "react";
import { Button } from "./button";

/**
 * 通用的「单字段内联编辑」表单组件。
 *
 * 典型用法（账户设置页修改用户名）：
 * ```tsx
 * <Form
 *   title="Your Name"
 *   description="This is your display name on Dub."
 *   inputAttrs={{
 *     name: "name",          // 提交时的字段 key（决定 body 的结构 { name: value }）
 *     defaultValue: user.name,
 *     placeholder: "Steve Jobs",
 *     maxLength: 32,          // 浏览器原生截断，后端 zod 校验为 max(64)
 *   }}
 *   helpText="Max 32 characters."
 *   handleSubmit={(data) => fetch("/api/user", { method: "PATCH", body: JSON.stringify(data) })}
 * />
 * ```
 *
 * 特点：
 * - 不绑定具体业务，靠 `inputAttrs` 透传所有原生 input 属性（含 maxLength / placeholder 等）；
 * - 提交时只发出一个字段：`{ [inputAttrs.name]: value }`；
 * - 内置「保存中 / 值未改变 / 值为空」时自动禁用提交按钮；
 * - `defaultValue` 还未就绪（非 string）时显示骨架屏。
 */
export function Form({
  title,
  description,
  inputAttrs,
  helpText,
  buttonText = "Save Changes",
  disabledTooltip,
  handleSubmit,
}: {
  /** 区块标题（如 "Your Name"） */
  title: string;
  /** 标题下方的灰色描述文字 */
  description: string;
  /** 透传给原生 <input> 的全部属性：name / defaultValue / placeholder / maxLength / type ... */
  inputAttrs: InputHTMLAttributes<HTMLInputElement>;
  /** 底部帮助文案；字符串会按 HTML 解析（支持 <a> 等），也可直接传 ReactNode */
  helpText?: string | ReactNode;
  /** 提交按钮文案，默认 "Save Changes" */
  buttonText?: string;
  /** 传入了该值时整块表单禁用，鼠标悬停按钮会显示此提示 */
  disabledTooltip?: string | ReactNode;
  /** 提交回调，参数形如 { [inputAttrs.name]: value } */
  handleSubmit: (data: any) => Promise<any>;
}) {
  // 受控输入值，初值取自 inputAttrs.defaultValue
  const [value, setValue] = useState(inputAttrs.defaultValue);
  // 保存中标记，用于按钮 loading 态 + 防重复提交
  const [saving, setSaving] = useState(false);

  // 提交按钮是否禁用：保存中 / 值为空 / 值相对初值未变化
  const saveDisabled = useMemo(() => {
    return saving || !value || value === inputAttrs.defaultValue;
  }, [saving, value, inputAttrs.defaultValue]);

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setSaving(true);
        // 只提交单个字段：{ name: value } —— 与后端 PATCH /api/user 的 body 结构对应
        await handleSubmit({
          [inputAttrs.name as string]: value,
        });
        setSaving(false);
      }}
      className="rounded-xl border border-neutral-200 bg-white"
    >
      <div className="relative flex flex-col space-y-6 p-6">
        {/* 标题 + 描述 */}
        <div className="flex flex-col space-y-1">
          <h2 className="text-base font-semibold">{title}</h2>
          <p className="text-sm text-neutral-500">{description}</p>
        </div>

        {/* defaultValue 为 string 时渲染真正的输入框；否则渲染骨架屏（数据未就绪） */}
        {typeof inputAttrs.defaultValue === "string" ? (
          // 关键：inputAttrs 在这里展开，maxLength / placeholder / defaultValue 全部生效
          <input
            {...inputAttrs}
            type={inputAttrs.type || "text"}
            required
            disabled={disabledTooltip ? true : false} // 传入 disabledTooltip 时禁用输入（整块只读）
            onChange={(e) => setValue(e.target.value)}
            className={cn(
              "w-full max-w-md rounded-md border border-neutral-300 text-neutral-900 placeholder-neutral-400 focus:border-neutral-500 focus:outline-none focus:ring-neutral-500 sm:text-sm",
              {
                "cursor-not-allowed bg-neutral-100 text-neutral-400":
                  disabledTooltip,
              },
            )}
          />
        ) : (
          // 数据加载中的占位骨架
          <div className="h-[2.35rem] w-full max-w-md animate-pulse rounded-md bg-neutral-200" />
        )}
      </div>

      {/* 底部条：帮助文案 + 提交按钮 */}
      <div className="flex flex-col items-start justify-between gap-4 rounded-b-xl border-t border-neutral-200 bg-neutral-50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:space-y-0 sm:py-3">
        {/* 字符串 helpText 按 HTML 渲染（dangerouslySetInnerHTML），否则当作 ReactNode 直接渲染 */}
        {typeof helpText === "string" ? (
          <p
            className="prose-sm prose-a:underline prose-a:underline-offset-4 hover:prose-a:text-neutral-700 text-neutral-500 transition-colors"
            dangerouslySetInnerHTML={{ __html: helpText || "" }}
          />
        ) : (
          helpText
        )}
        <div className="w-fit shrink-0">
          <Button
            text={buttonText}
            loading={saving}
            disabled={saveDisabled}
            disabledTooltip={disabledTooltip}
          />
        </div>
      </div>
    </form>
  );
}
