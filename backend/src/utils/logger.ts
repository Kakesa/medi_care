import { sanitize } from './sanitize.js';

type LogLevel = 'info' | 'warn' | 'error';

function write(level: LogLevel, payload: Record<string, unknown>) {
  const entry = sanitize({
    time: new Date().toISOString(),
    level,
    ...payload,
  });
  const line = JSON.stringify(entry);
  if (level === 'error') {
    console.error(line);
    return;
  }
  console.log(line);
}

export const logger = {
  info(payload: Record<string, unknown>) {
    write('info', payload);
  },
  warn(payload: Record<string, unknown>) {
    write('warn', payload);
  },
  error(payload: Record<string, unknown>) {
    write('error', payload);
  },
};
