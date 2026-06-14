import { OG_AVATAR_URL, R2_URL, fetchWithTimeout } from "@dub/utils"; // 引入工具：OG头像URL、R2公开URL、带超时的fetch
import { AwsClient } from "aws4fetch"; // 引入aws4fetch库，用于S3兼容API的AWS V4签名请求

interface imageOptions {
  // 图片上传选项接口
  contentType?: string; // 内容MIME类型，如 image/png
  width?: number; // 目标宽度（用于图片裁剪）
  height?: number; // 目标高度（用于图片裁剪）
  headers?: Record<string, string>; // 自定义请求头
}

type BucketType = "public" | "private"; // 存储桶类型：公开或私有

class StorageClient {
  // 存储客户端类（封装Cloudflare R2操作）
  private client: AwsClient; // AWS签名请求客户端实例

  constructor() {
    // 构造函数：初始化AWS客户端
    this.client = new AwsClient({
      accessKeyId: process.env.STORAGE_ACCESS_KEY_ID || "", // 存储访问密钥ID
      secretAccessKey: process.env.STORAGE_SECRET_ACCESS_KEY || "", // 存储密钥
      service: "s3", // 服务类型为S3
      region: "auto", // 区域自动选择
    });
  }

  async upload({
    // 上传文件到存储桶
    key,
    body,
    opts,
    bucket = "public",
  }: {
    key: string; // 文件存储路径/名称
    body: Blob | Buffer | string; // 文件内容：Blob/Buffer/Base64/URL字符串
    opts?: imageOptions; // 上传选项
    bucket?: BucketType; // 目标存储桶，默认公开桶
  }) {
    let uploadBody; // 待上传的文件体
    if (typeof body === "string") {
      // 如果输入是字符串
      if (this.isBase64(body)) {
        // 判断是否为Base64编码
        uploadBody = this.base64ToArrayBuffer(body, opts); // 将Base64转换为Blob
      } else if (this.isUrl(body)) {
        // 判断是否为URL
        uploadBody = await this.urlToBlob(body, opts); // 从URL下载并转为Blob
      } else {
        throw new Error("Invalid input: Not a base64 string or a valid URL"); // 既不是Base64也不是URL，抛出错误
      }
    } else {
      uploadBody = body; // 直接使用传入的Blob/Buffer
    }

    const headers = {
      // 构建请求头
      "Content-Length": uploadBody.size.toString(), // 设置内容长度
      ...opts?.headers, // 合并自定义请求头
    };

    if (opts?.contentType) {
      // 如果指定了内容类型
      headers["Content-Type"] = opts.contentType; // 设置Content-Type
    }

    try {
      const response = await this.client.fetch(
        // 发起PUT请求上传文件
        `${process.env.STORAGE_ENDPOINT}/${this._getBucketName(bucket)}/${key}`,
        {
          method: "PUT",
          headers,
          body: uploadBody,
        },
      );

      if (!response.ok) {
        // 上传失败
        throw new Error(response.statusText);
      }

      return {
        // 返回文件的公开访问URL
        url: `${R2_URL}/${key}`,
      };
    } catch (error) {
      console.error("storage.upload failed", error); // 记录上传错误
      throw new Error("Failed to upload file. Please try again later.");
    }
  }

  async delete({
    // 从存储桶删除文件
    key,
    bucket = "public",
  }: {
    key: string; // 文件存储路径/名称
    bucket?: BucketType; // 目标存储桶
  }) {
    try {
      const response = await this.client.fetch(
        // 发起DELETE请求删除文件
        `${process.env.STORAGE_ENDPOINT}/${this._getBucketName(bucket)}/${key}`,
        {
          method: "DELETE",
        },
      );

      if (!response.ok) {
        // 删除失败
        throw new Error(response.statusText);
      }
    } catch (error) {
      console.error("storage.delete failed", error); // 记录删除错误
      throw new Error("Failed to delete file. Please try again later.");
    }
  }

  async getSignedUrl({
    // 生成预签名URL（临时授权访问）
    key,
    method,
    expiresIn,
    bucket,
    headers,
  }: {
    key: string; // 文件存储路径/名称
    method: "PUT" | "GET"; // HTTP方法：上传用PUT，下载用GET
    bucket: BucketType; // 存储桶类型
    expiresIn: number; // URL过期时间（秒）
    headers?: Record<string, string>; // 附加请求头
  }) {
    const url = new URL( // 构建文件完整URL
      `${process.env.STORAGE_ENDPOINT}/${this._getBucketName(bucket)}/${key}`,
    );

    url.searchParams.set("X-Amz-Expires", String(expiresIn)); // 设置过期时间查询参数

    try {
      const response = await this.client.sign(url, {
        // 对URL进行AWS V4签名
        method,
        headers,
        aws: {
          signQuery: true, // 将签名信息放入查询参数
          allHeaders: true, // 签名所有请求头
        },
      });

      return response.url; // 返回签名后的完整URL
    } catch (error) {
      console.error("storage.getSignedUrl failed", error); // 记录签名失败
      throw new Error("Failed to generate signed url. Please try again later.");
    }
  }

  async getSignedUploadUrl(opts: {
    // 生成预签名上传URL的便捷方法
    key: string;
    bucket?: BucketType;
    expiresIn?: number;
    contentLength?: number;
    contentType?: string;
  }) {
    const headers: Record<string, string> = {};

    if (opts.contentLength) {
      // 如果指定了内容长度
      headers["Content-Length"] = String(opts.contentLength);
    }

    if (opts.contentType) {
      // 如果指定了内容类型
      headers["Content-Type"] = opts.contentType;
    }

    return await this.getSignedUrl({
      // 调用getSignedUrl生成PUT签名URL
      key: opts.key,
      method: "PUT",
      bucket: opts.bucket || "public", // 默认公开桶
      expiresIn: opts.expiresIn || 600, // 默认过期10分钟
      headers: Object.keys(headers).length > 0 ? headers : undefined,
    });
  }

  async getSignedDownloadUrl(opts: {
    // 生成预签名下载URL的便捷方法
    key: string;
    bucket?: BucketType;
    expiresIn?: number;
  }) {
    return await this.getSignedUrl({
      // 调用getSignedUrl生成GET签名URL
      key: opts.key,
      method: "GET",
      bucket: opts.bucket || "private", // 默认私有桶
      expiresIn: opts.expiresIn || 600, // 默认过期10分钟
    });
  }

  private base64ToArrayBuffer(base64: string, opts?: imageOptions) {
    // 将Base64字符串转换为Blob
    const base64Data = base64.replace(/^data:.+;base64,/, ""); // 去除data URI前缀
    const paddedBase64Data = base64Data.padEnd(
      // 补全Base64的padding（=）
      base64Data.length + ((4 - (base64Data.length % 4)) % 4),
      "=",
    );

    const binaryString = atob(paddedBase64Data); // 解码Base64为二进制字符串
    const byteArray = new Uint8Array(binaryString.length); // 创建字节数组
    for (let i = 0; i < binaryString.length; i++) {
      // 逐字节填充
      byteArray[i] = binaryString.charCodeAt(i);
    }
    const blobProps = {}; // Blob属性
    if (opts?.contentType) blobProps["type"] = opts.contentType; // 设置MIME类型
    return new Blob([byteArray], blobProps); // 返回Blob对象
  }

  private isBase64(str: string) {
    // 判断字符串是否为Base64格式
    const base64Regex = // 纯Base64字符串正则
      /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;

    const dataImageRegex = // data:image格式的Base64正则
      /^data:image\/[a-zA-Z0-9.+-]+;base64,(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;

    return base64Regex.test(str) || dataImageRegex.test(str); // 满足任一格式即为Base64
  }

  private isUrl(str: string): boolean {
    // 判断字符串是否为合法URL
    try {
      new URL(str); // 尝试构造URL对象
      return true; // 成功则为合法URL
    } catch (_) {
      return false; // 失败则不是URL
    }
  }

  private async urlToBlob(url: string, opts?: imageOptions): Promise<Blob> {
    // 从URL下载内容并转为Blob
    let response: Response;
    if (opts?.height || opts?.width) {
      // 如果指定了尺寸，通过wsrv.nl代理裁剪图片
      try {
        const proxyUrl = new URL("https://wsrv.nl"); // 图片处理代理服务
        proxyUrl.searchParams.set("url", url); // 设置原始图片URL
        if (opts.width) proxyUrl.searchParams.set("w", opts.width.toString()); // 设置宽度
        if (opts.height) proxyUrl.searchParams.set("h", opts.height.toString()); // 设置高度
        proxyUrl.searchParams.set("fit", "cover"); // 裁剪模式：覆盖
        response = await fetchWithTimeout(proxyUrl.toString()); // 带超时请求裁剪后的图片
      } catch (error) {
        response = await fetch(url); // 代理失败则直接请求原图
      }
    } else {
      response = await fetch(url); // 无尺寸要求，直接请求
    }
    if (!response.ok) {
      // 请求失败
      throw new Error(`Failed to fetch URL: ${response.statusText}`);
    }
    const blob = await response.blob(); // 转为Blob
    if (opts?.contentType) {
      // 如果需要指定MIME类型
      return new Blob([blob], { type: opts.contentType }); // 用新类型重建Blob
    }
    return blob; // 返回原始Blob
  }

  private _getBucketName(bucket: BucketType) {
    // 根据类型获取存储桶名称
    if (bucket === "public") {
      // 公开桶
      const bucketName = process.env.STORAGE_PUBLIC_BUCKET;

      if (!bucketName) {
        throw new Error("STORAGE_PUBLIC_BUCKET is not set"); // 环境变量未设置
      }

      return bucketName;
    }

    if (bucket === "private") {
      // 私有桶
      const bucketName = process.env.STORAGE_PRIVATE_BUCKET;

      if (!bucketName) {
        throw new Error("STORAGE_PRIVATE_BUCKET is not set"); // 环境变量未设置
      }

      return bucketName;
    }

    throw new Error(`Invalid bucket type: ${bucket}`); // 未知桶类型
  }
}

export const storage = new StorageClient(); // 导出存储客户端单例

export const isStored = (url: string) => {
  // 判断URL是否指向自家存储
  return url.startsWith(R2_URL) || url.startsWith(OG_AVATAR_URL);
};

export const isNotHostedImage = (imageString: string) => {
  // 判断是否不是已托管的HTTPS图片
  return !imageString.startsWith("https://");
};
