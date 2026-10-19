import { PrismaClient } from "@prisma/client";

declare global {
  var prismaGlobal: PrismaClient | undefined;
}

const prisma = global.prismaGlobal ?? new PrismaClient();

if (!global.prismaGlobal) {
  global.prismaGlobal = prisma;
}

export default prisma;
