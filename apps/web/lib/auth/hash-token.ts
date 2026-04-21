//  把一个 token / key 转成固定长度的哈希字符串。
export const hashToken = async (
  token: string,
  {
    secret = false,
  }: {
    secret?: boolean;
  } = {},
) => {
  // TextEncoder 是浏览器 / Web 标准提供的一个工具，用来把字符串编码成字节数据。
  const encoder = new TextEncoder();

  //  把 token 和盐（secret 存在时）拼接成一个字符串，然后用 encoder 转成字节数组。
  const data = encoder.encode(
    `${token}${secret ? process.env.NEXTAUTH_SECRET : ""}`,
  );
  // crypto.subtle.digest 是 WebCrypto API 的一部分，用来计算数据的哈希值。
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  //  把哈希后的字节数组转成十六进制字符串，方便存储和显示。
  const hashArray = Array.from(new Uint8Array(hashBuffer));

  //  把十六进制字符串连接起来，形成最终的哈希值字符串。
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
};
