import { PrismaClient } from '@prisma/client'
import { PrismaNeon } from '@prisma/adapter-neon'

// 1. Initialize the Neon adapter with the pooled connection string
const adapter = new PrismaNeon({
  connectionString: process.env.DATABASE_URL!,
})

// 2. Creating the singleton wrapper
const prismaClientSingleton = () => {
  return new PrismaClient({ adapter }) // Injecting the adapter into Prisma 7
}

declare global {
  var prismaGlobal: undefined | ReturnType<typeof prismaClientSingleton>
}

// 3. Cache the connection in development to prevent hot-reload crashes
const prisma = globalThis.prismaGlobal ?? prismaClientSingleton()

export default prisma

if (process.env.NODE_ENV !== 'production') globalThis.prismaGlobal = prisma