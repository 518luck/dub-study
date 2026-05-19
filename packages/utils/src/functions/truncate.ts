// 将过长字符串截断到指定长度，并用省略号结尾。
export const truncate = (
  str: string | null | undefined,
  length: number,
): string | null => {
  if (!str || str.length <= length) return str ?? null;
  return `${str.slice(0, length - 3)}...`;
};
