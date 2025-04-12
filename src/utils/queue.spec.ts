import { LimitedQueue } from "./queue";


describe('limited queue', () => {

    let queue: LimitedQueue<number>;

    beforeAll(() => {
        queue = new LimitedQueue<number>(6);
    })

    it('should not be null or empty', () => {
        expect(queue).toBeDefined();
    })

    it('should enqueue and dequeue', () => {
        queue.enqueue(1);
        queue.enqueue(2);
        queue.enqueue(3);
        expect(queue.dequeue()).toBe(1);
        expect(queue.dequeue()).toBe(2);
        expect(queue.dequeue()).toBe(3);
    })

    it('should not exceed limit', () => {
        queue.enqueue(1);
        queue.enqueue(2);
        queue.enqueue(3);
        queue.enqueue(4);
        queue.enqueue(5);
        queue.enqueue(6);
        queue.enqueue(7);
        expect(queue.size()).toBe(6);
    })
})