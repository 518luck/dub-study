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
