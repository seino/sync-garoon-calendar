import { createLogger } from 'ligelog';

type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

const level = (process.env.LOG_LEVEL as LogLevel) || 'info';

export const logger = createLogger({
  level,
  context: { app: 'sync-garoon-calendar' },
});
