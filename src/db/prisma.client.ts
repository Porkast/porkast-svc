import { Injectable, OnModuleInit } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";


@Injectable()
export class PKPrismaClient extends PrismaClient implements OnModuleInit {

    constructor() {
        super({
            log: [
                { emit: 'event', level: 'query' },
                { emit: 'stdout', level: 'info' },
                { emit: 'stdout', level: 'warn' },
                { emit: 'stdout', level: 'error' },
            ],
            errorFormat: 'colorless',
        });
    }

    async onModuleInit() {
        if (process.env.NODE_ENV !== 'production') {
            this.$on('query', (e) => {
                console.log('Query: ' + e.query)
                console.log('Params: ' + e.params)
                console.log('Target: ' + e.target)
                console.log('Duration: ' + e.duration + 'ms')
            })
        }
        await this.$connect();
    }
}