import { DotsPattern } from "@dub/ui";
import Link from "next/link";

// 登录/注册页用这个 banner 引导用户切换到另一个 Dub 登录入口，
// 比如 app.dub.co 和 partners.dub.co 之间互相跳转。
export function AuthAlternativeBanner({
  text,
  cta,
  href,
}: {
  text: string;
  cta: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="relative block overflow-hidden rounded-lg border border-neutral-200 bg-neutral-50 px-2 py-4 transition-colors hover:bg-neutral-100"
    >
      <div
        className="absolute inset-y-0 left-1/2 w-[640px] -translate-x-1/2"
        // 这里只是装饰背景，屏幕阅读器读取下面真正的链接文案即可。
        role="presentation"
      >
        <DotsPattern patternOffset={[1, 5]} className="text-neutral-200" />
      </div>
      {/* 文案层需要盖在绝对定位的点阵背景上。 */}
      <div className="relative text-center text-sm text-neutral-600">
        <p>{text}</p>
        <span className="block font-semibold text-neutral-800">{cta}</span>
      </div>
    </Link>
  );
}
