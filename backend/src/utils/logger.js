// logger.js
//logger.js for setting a winston logger that is more production friendly
//it is a replacement for the traditional console.log
import winston from "winston";

// Define transports based on environment
const transports = [
    new winston.transports.Console(), // Always log to stdout (CloudWatch captures this)
];

// Only add file logging if NOT running in AWS Lambda
if (!process.env.AWS_LAMBDA_FUNCTION_NAME) {
    transports.push(
        new winston.transports.File({ filename: "logs/error.log", level: "error" }),
        new winston.transports.File({ filename: "logs/app.log" })
    );
}

export const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || "info",
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json(),   // STRUCTURED LOGS (production friendly)
        winston.format.printf(({ timestamp, level, message }) => `${timestamp} ${level}: ${message}`)
    ),
    transports: transports,
});

// export const logger = winston.createLogger({
//   level: process.env.LOG_LEVEL || 'info',
//   format: winston.format.combine(
//     winston.format.timestamp(),
//     winston.format.printf(({ timestamp, level, message }) => `${timestamp} ${level}: ${message}`)
//   ),
//   transports: [new winston.transports.Console()],
// });

// Friendly logs during development
// if (process.env.NODE_ENV !== "production") {
//     logger.add(new winston.transports.Console({
//         format: winston.format.combine(
//             winston.format.colorize(),
//             winston.format.simple()
//         ),
//     }));
// }
