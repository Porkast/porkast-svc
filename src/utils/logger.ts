// Logger utility with environment-based logging levels

const isProduction = process.env.NODE_ENV === 'production';

export const logger = {
  debug: (message: string, ...args: any[]) => {
    if (!isProduction) {
      console.debug(`[DEBUG] ${message}`, ...args);
    }
  },
  
  info: (message: string, ...args: any[]) => {
    console.info(`[INFO] ${message}`, ...args);
  },
  
  warn: (message: string, ...args: any[]) => {
      console.warn(`[WARN] ${message}`, ...args);
  },
  
  error: (message: string, ...args: any[]) => {
      console.error(`[ERROR] ${message}`, ...args);
  }
};
