// lib/lambda/handler.ts

export const handler = async (): Promise<void> => {
    console.log('定时任务执行时间:', new Date().toISOString());

    // 在这里添加你的业务逻辑
    try {
        console.log('开始执行定时任务...');
        // 模拟任务执行
        await new Promise(resolve => setTimeout(resolve, 1000));
        console.log('定时任务执行完成!');
    } catch (error) {
        console.error('任务执行失败:', error);
        throw error;
    }
};