// 学习笔记：
// 这个文件导出的是“默认数据库入口” prisma。
// 它是项目主路线的 PrismaClient 单例写法，普通服务端代码大多走这里。
//
// 适合：
// - 普通 Node.js 服务端场景
// - API、cron、服务端逻辑等常规数据库访问
//
// 好处：
// - 写法更常见、更直观
// - 社区资料多，容易理解
// - 用 global 单例避免开发环境重复创建 PrismaClient
//
// 代价：
// - 对 edge / middleware 这类特殊环境不如专门方案友好
// - 不是为 PlanetScale driver / HTTP 路线专门定制的入口
import { PrismaClient } from "@prisma/client";

// 真正创建 PrismaClient 的地方在这里
const prismaClientSingleton = () =>
  // 创建 Prisma 数据库客户端
  new PrismaClient({
    // 当 Prisma 返回 user 模型数据时，省略 passwordHash 这个字段。
    omit: {
      user: { passwordHash: true },
    },
  });

//  取变量 prismaClientSingleton 的类型。
//ReturnType<...>
//  ReturnType<T> 是 TypeScript 自带的工具类型，作用是：
//  取一个函数类型的返回值类型。
type OmittedPrismaClient = ReturnType<typeof prismaClientSingleton>;

// 告诉 TypeScript：全局对象上允许有一个叫 prisma 的变量。
// global 是 Node.js 里的 全局对象 类似浏览器当中的window。
declare global {
  var prisma: OmittedPrismaClient | undefined;
}

// 1. 先检查全局有没有 prisma
// 3. 如果没有，就调用 prismaClientSingleton() 创建一个
export const prisma = global.prisma ?? prismaClientSingleton();

// 2. 如果有，直接用（热模块替换时避免重复创建） 开发环境热重载反复创建PrismaClient的问题
if (process.env.NODE_ENV !== "production") {
  global.prisma = prisma;
}

//  把用户输入的搜索字符串清洗一下，去掉全文搜索不支持或容易出问题的特殊字符。
export const sanitizeFullTextSearch = (search: string) => {
  // remove unsupported characters for full text search
  return search.replace(/[*+\-()~@%<>!=?:]/g, "").trim();
};
