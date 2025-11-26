// logger.js
//logger.js for setting a winston logger that is more production friendly
//it is a replacement for the traditional console.log
import winston from "winston";

export const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || "info",
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()   // STRUCTURED LOGS (production friendly)
    ),
    transports: [
        new winston.transports.Console(),  // logs to stdout (cloud-friendly)
        new winston.transports.File({ filename: "logs/error.log", level: "error" }),
        new winston.transports.File({ filename: "logs/app.log" }),
    ],
});

// Friendly logs during development
if (process.env.NODE_ENV !== "production") {
    logger.add(new winston.transports.Console({
        format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
        ),
    }));
}
