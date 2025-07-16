const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const http = require("http");
const morgan = require("morgan");
const { errorHandler, AppError } = require("./utils/errorHandler");
const { LANGUAGES, TIMEZONES } = require("./config/constants");
const { createSocketConnection } = require("./utils/socket");
const logger = require("./utils/logger");
const { appRoutes } = require("./routes");
const superAdminRoutes = require('./super-admin-module/super-admin-service/routes/index.js');
const tenantRoutes = require('./super-admin-module/Tenant-services/routes/index.js');
const permissionRoutes = require('./super-admin-module/permission-service/routes/index.js');
const userRoutes = require('./super-admin-module/user-services/routes/index.js');
const logRoutes = require('./super-admin-module/logs-service/routes/index.js');

const {
  restartReminders,
} = require("./leaseReminder-service/controllers/lease.reminder");
const os = require("node:os");
const app = express();
const HTTP_PORT = process.env.HTTP_PORT || 5000;

async function main() {
  // Global Middlewares
  app.use(
    express.json({
      verify: function (req, res, buf) {
        if (req.originalUrl.startsWith("/api/v1/charges/stripe/webhook")) {
          req.rawBody = buf.toString();
        }
      },
      limit: "100Mb",
    })
  );
  app.use(helmet());
  app.use(morgan("dev"));
  app.use(
    cors({
      origin: true,
    })
  );
  app.use((req, res, next) => {
    req.language =
      req.headers["accept-language"] === LANGUAGES.AR
        ? LANGUAGES.AR
        : LANGUAGES.EN;

    req.timezone = req.headers.timezone
      ? req.headers.timezone
      : TIMEZONES.INDIA;
    next();
  });

  // Routes

  app.use("/api/v1", appRoutes);
  app.use('/api', superAdminRoutes);
app.use('/api', tenantRoutes);
app.use('/api/permission', permissionRoutes);
app.use('/api/user', userRoutes);
app.use('/api', logRoutes);
  app.get("/api/check-server", (req, res) => {
    res.json(`Server line on host: ${os.hostname()}`);
  });

  app.use("*", (_req, _res, next) =>
    next(new AppError("RouteError", "Route not found", "custom", 404))
  );

  app.use((error, req, res, next) => {
    return errorHandler(error, res);
  });

  const server = http.createServer(app).listen(HTTP_PORT);

  app.set("port", HTTP_PORT);

  await createSocketConnection(server);

  server.on("error", (error) => {
    logger.error(
      `Error while establishing server: ${JSON.stringify(error.message)}`
    );
  });

  server.on("listening", () => {
    logger.info(`Server started on port ${server.address().port}`);
    restartReminders();
  });
}

main();
