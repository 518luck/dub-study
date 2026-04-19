// 判断当前路径是不是“顶层 settings 相关路径”，需要后续被重定向到真正的 workspace
// settings 路径。

const topLevelSettingRedirects = ["/domains", "/integrations", "/webhooks"];

export const isTopLevelSettingsRedirect = (path: string) => {
  return (
    topLevelSettingRedirects.includes(path) ||
    topLevelSettingRedirects.some((redirect) => path.startsWith(`${redirect}/`))
  );
};
