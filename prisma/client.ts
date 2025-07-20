import { PrismaClient } from '@prisma/client'

// 全局变量声明
declare global {
    var prisma: PrismaClient | undefined
}

// 防止 Lambda 冷启动时重复实例化 PrismaClient
const prisma = global.prisma || new PrismaClient({
    log: ['query', 'info', 'warn', 'error'],
    datasources: {
        db: {
            url: process.env.DATABASE_URL + (process.env.NODE_ENV === 'production'
                ? '?connection_limit=5&pool_timeout=10'
                : '')
        }
    }
})

if (process.env.NODE_ENV !== 'production') {
    global.prisma = prisma
}

export default prisma