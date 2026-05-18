/**
 * Validates if a redirect URL is safe for internal redirects
// 校验一个重定向目标是不是“站内安全跳转”，防止开放重定向（open redirect）
 */

// 判断某个 redirectPath 是否仍然指向当前站点（same-origin）。
export function isValidInternalRedirect({
  redirectPath,
  currentUrl,
}: {
  redirectPath: string;
  currentUrl: string | URL;
}): boolean {
  try {
    // Ensure the URL construction results in same-origin redirect
    // 根据当前页面地址 currentUrl，把 redirectPath 解析成一个完整 URL。
    const redirectUrl = new URL(redirectPath, currentUrl);
    // 当前页面 URL 的 origin。
    // origin 表示：
    // - 协议
    // - 域名
    // - 端口
    const currentOrigin = new URL(currentUrl).origin;

    return redirectUrl.origin === currentOrigin;
  } catch (error) {
    // Invalid URL construction
    return false;
  }
}

// 定义一个函数，用来拿到“安全的站内重定向路径”。
export function getValidInternalRedirectPath({
  // 从参数对象里取出 redirectPath，也就是外部传进来的跳转目标。
  redirectPath,
  // 从参数对象里取出 currentUrl，也就是当前页面的完整 URL。
  currentUrl,
}: {
  // redirectPath 是可选的；它可以是字符串、null，也可以不传。
  redirectPath?: string | null;
  // currentUrl 必须传；它可以是字符串，也可以是 URL 对象。
  currentUrl: string | URL;
  // 函数返回值：如果 redirectPath 安全，就返回字符串；否则返回 null。
}): string | null {
  // 如果没有传 redirectPath，或者它是空字符串 / null / undefined，就直接返回 null。
  if (!redirectPath) {
    return null;
  }
  // 调用 isValidInternalRedirect 检查 redirectPath 是否是安全的站内跳转。
  const valid = isValidInternalRedirect({ redirectPath, currentUrl });
  // 如果 valid 是 true，返回原始 redirectPath；否则返回 null。
  return valid ? redirectPath : null;
}
