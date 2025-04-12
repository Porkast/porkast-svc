
export class LimitedQueue<T> {
    private queue: T[];
    private limit: number;

    constructor(limit: number) {
        this.queue = [];
        this.limit = limit;
    }

    enqueue(item: T): void {
        this.queue.push(item);
        if (this.queue.length > this.limit) {
            this.queue.shift();
        }
    }

    dequeue(): T | undefined {
        return this.queue.shift();
    }

    size(): number {
        return this.queue.length;
    }

    peek(): T | undefined {
        return this.queue[0];
    }

    clear(): void {
        this.queue = [];
    }

    getQueue(): T[] {
        return this.queue.slice();
    }
}