import { Prisma } from "@prisma/client"
import prisma from "./prisma.client"
import { UserListenLaterDto } from "../models/listen_later"

export const queryUserListenLaterList = async (userId: string, limit: number, offset: number): Promise<UserListenLaterDto[]> => {

    let listenLaterDtoList = await prisma.$queryRaw<UserListenLaterDto[]>(
        Prisma.sql`
            SELECT fi.*, ull.reg_date 
            FROM user_listen_later ull
            INNER JOIN feed_item fi ON fi.id = ull.item_id
            WHERE ull.user_id = ${userId} and ull.status = 1 
            ORDER BY ull.reg_date DESC 
            LIMIT ${limit} 
            OFFSET ${offset}
        `
    )

    for (let listenLaterDto of listenLaterDtoList) {
        listenLaterDto.description = String(listenLaterDto.description || '')
    }

    return listenLaterDtoList
}

export const queryUserListenLaterTotalCount = async (userId: string): Promise<number> => {
    const totalCount = await prisma.user_listen_later.count({
        where: {
            user_id: userId,
            status: 1
        }
    })
    return totalCount
}