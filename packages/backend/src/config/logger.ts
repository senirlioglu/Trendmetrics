import winston from "winston";

const LOG_LEVEL = process.env["LOG_LEVEL"] ?? (process.env["NODE_ENV"] === "production" ? "info" : "debug");

const jsonFormat = winston.format.combine(
  winston.format.timestamp({ format: "ISO" }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
);

const devFormat = winston.format.combine(
  winston.format.timestamp({ format: "HH:mm:ss" }),
  winston.format.errors({ stack: true }),
  winston.format.colorize(),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    const metaStr = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : "";
    return `${String(timestamp)} [${level}] ${String(message)}${metaStr}`;
  }),
);

const isProduction = process.env["NODE_ENV"] === "production";

export const logger = winston.createLogger({
  level: LOG_LEVEL,
  format: isProduction ? jsonFormat : devFormat,
  defaultMeta: { service: "trendmetrics-backend" },
  transports: [
    new winston.transports.Console({
      handleExceptions: true,
      handleRejections: true,
    }),
  ],
  exitOnError: false,
});

export function createChildLogger(context: Record<string, unknown>): winston.Logger {
  return logger.child(context);
}
