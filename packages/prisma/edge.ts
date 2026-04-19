// 学习笔记：
// 这个文件导出的是“特殊场景数据库入口” prismaEdge。
// 它不是默认 Prisma 接法，而是 Prisma + PlanetScale adapter 的接法。
//
// 适合：
// - middleware / edge / serverless 这类更受限的运行环境
// - 需要走 PlanetScale 的 driver / HTTP 方式访问数据库的场景
//
// 好处：
// - 更适配 edge / middleware 这类环境
// - 更符合 PlanetScale 官方 driver 的接入方式
//
// 代价：
// - 比默认 Prisma 写法更绕
// - 多一层 adapter，阅读成本更高
// - 更依赖特定平台（PlanetScale）接法
import { Client } from "@planetscale/database"; //  PlanetScale 官方数据库客户端
import { PrismaPlanetScale } from "@prisma/adapter-planetscale"; //Prisma 适配 PlanetScale 的桥接器
import { PrismaClient } from "@prisma/client"; //让 Prisma 通过这个桥接器工作

// 1. 先创建 PlanetScale 客户端
const client = new Client({
  url: process.env.PLANETSCALE_DATABASE_URL || process.env.DATABASE_URL,
});

// 2. 再创建 Prisma 的 PlanetScale adapter
const adapter = new PrismaPlanetScale(client);

// 3. 再把这个 adapter 注入 PrismaClient
export const prismaEdge = new PrismaClient({
  adapter,
});

// 为什么要转换呢   你不能按最普通那套 TCP 直连方式来，我这边更适合走我的 driver / HTTP 方式
// - Prisma 会按自己默认的连接方式想去连数据库
// - 但项目这里想走的是 PlanetScale 这套 driver 方式
// - 那 Prisma 就需要一个“翻译器”告诉它：

// TCP。  应用 <----TCP连接----> MySQL / Postgres  程序直接和数据库建立一个长连接。
// 应用 --HTTP请求--> 数据库服务提供的 driver/API --> 数据库
// - 更适合 serverless / edge
// - 不依赖传统长连接
// - 在某些部署环境下更友好
