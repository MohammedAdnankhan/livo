const { createLogger, transports, format } = require("winston");
const { combine, timestamp, printf, colorize } = format;

const formatter = printf((info) => {
  let object = {
    message: info.message,
  };
  return `${info.timestamp} ${info.level} ${JSON.stringify(object)}`;
});

const logger = createLogger({
  format: combine(timestamp(), formatter),
  transports: [
    new transports.Console({
      json: true,
      format: combine(colorize(), timestamp(), formatter),
      colorize: process.stdout.isTTY,
      timestamp: function () {
        return new Date().toLocaleTimeString();
      },
      prettyPrint: true,
    }),
    new transports.File({ filename: "logs/error.log", level: "error" }),
    new transports.File({ filename: "logs/combined.log" }),
  ],
});

module.exports = logger;
