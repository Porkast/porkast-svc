import { Module } from "@nestjs/common";
import { PKPrismaClient } from "./prisma.client";
import { DBService } from "./db.service";

@Module({
    imports: [],
    controllers: [],
    providers: [PKPrismaClient, DBService],
    exports: [DBService, PKPrismaClient]
})
export class DbModule { }