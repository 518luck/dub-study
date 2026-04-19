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

//  如果这个跳转路径安全，就返回它；如果不安全，就返回 null。
export function getValidInternalRedirectPath({
  redirectPath,
  currentUrl,
}: {
  redirectPath?: string | null;
  currentUrl: string | URL;
}): string | null {
  if (!redirectPath) {
    return null;
  }
  const valid = isValidInternalRedirect({ redirectPath, currentUrl });
  return valid ? redirectPath : null;
}
