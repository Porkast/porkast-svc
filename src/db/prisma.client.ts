import { PrismaClient } from '@prisma/client'

declare global {
    var prisma: PrismaClient | undefined
}

const prisma = global.prisma || new PrismaClient({
    log: process.env.NODE_ENV === 'production' ? ['error'] : ['query', 'info', 'warn', 'error'],
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