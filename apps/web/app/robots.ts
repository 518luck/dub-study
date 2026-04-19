import { MetadataRoute } from "next";
import { headers } from "next/headers";

//  根据当前访问域名，动态生成 robots.txt 的内容。
//“无论当前是哪个域名访问我，我都允许爬虫抓整站，并把 sitemap 地址设置成这个域名下 的 /sitemap.xml。”
export default async function robots(): Promise<MetadataRoute.Robots> {
  const headersList = await headers();
  let domain = headersList.get("host") as string;

  return {
    //  给所有爬虫一条规则
    // userAgent: "*" 表示匹配所有搜索引擎爬虫
    // allow: "/" 表示允许抓取整个网站路径
    rules: [
      {
        userAgent: "*",
        allow: "/",
      },
    ],
    //  告诉爬虫 sitemap 在哪里
    // 地址就是当前域名下的 /sitemap.xml
    sitemap: `https://${domain}/sitemap.xml`,
  };
}
