import { logger } from './logger';

export function printRoutesTable(routeMap: Map<string, string>) {
  // Calculate column widths
  let maxMethodLength = 6; // "Method".length
  let maxPathLength = 3;   // "API".length

  routeMap.forEach((method, path) => {
    maxMethodLength = Math.max(maxMethodLength, method.length);
    maxPathLength = Math.max(maxPathLength, path.length);
  });

  // Create table formatting
  const methodColumnWidth = maxMethodLength + 2;
  const apiColumnWidth = maxPathLength + 2;
  const totalWidth = methodColumnWidth + apiColumnWidth + 3; // +3 for separators

  logger.info('='.repeat(totalWidth));
  logger.info(`Method${' '.repeat(methodColumnWidth - 6)} | API${' '.repeat(apiColumnWidth - 3)}`);
  logger.info('-'.repeat(totalWidth));

  routeMap.forEach((method, path) => {
    const methodPadding = ' '.repeat(methodColumnWidth - method.length - 1);
    const pathPadding = ' '.repeat(apiColumnWidth - path.length - 1);
    logger.info(`${method}${methodPadding} | ${path}${pathPadding}`);
  });

  logger.info('='.repeat(totalWidth));
}
