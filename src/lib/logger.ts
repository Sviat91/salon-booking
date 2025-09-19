import pino, { type Bindings, type Logger, type LoggerOptions } from 'pino'
import { config } from './env'

const level = process.env.LOG_LEVEL ?? (config.NODE_ENV === 'development' ? 'debug' : 'info')

const options: LoggerOptions = {
  level,
  base: { env: config.NODE_ENV },
  messageKey: 'message',
  timestamp: pino.stdTimeFunctions.isoTime,
}

const rootLogger: Logger = pino(options)

export type AppLogger = Logger

export function getLogger(bindings?: Bindings): AppLogger {
  return bindings ? rootLogger.child(bindings) : rootLogger
}

export const logger = rootLogger