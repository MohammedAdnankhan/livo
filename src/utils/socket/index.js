const { Server } = require("socket.io");
const { createClient } = require("redis");
const { createAdapter } = require("@socket.io/redis-adapter");
const jwt = require("jsonwebtoken");
const { AppError } = require("../errorHandler");
const { USER_TYPES } = require("../../config/constants");
const { getGuard } = require("../../guard-service/controllers/guard");
const { getAdmin } = require("../../admin-service/controllers/admin");
const { getUser } = require("../../user-service/controllers/user");
const {
  getRequestedVisitorsTotalCountForGuard,
  getRequestedVisitorsForGuard,
} = require("../../visiting-service/controllers/visiting");
const logger = require("../logger");
const {
  getPropertyFromFlat,
} = require("../../property-service/controllers/property");
const env = process.env.NODE_ENV || "development";
const jwtConfig = require("../../config/jwt.json")[env];

const pubClient = createClient({
  url: "redis://localhost:6379",
  // host: "redis",
  // port: 6379,
});
const subClient = pubClient.duplicate();

module.exports.createSocketConnection = async (server) => {
  try {
    await Promise.all([pubClient.connect(), subClient.connect()]);

    pubClient.on("error", (error) => {
      console.error("pubClient error::", error);
    });

    subClient.on("error", (error) => {
      console.error("subClient error::", error);
    });

    const ping = await pubClient.PING();
    console.log("ping>>>>", ping);
    // const corsOrigins = [];
    const io = new Server(server, {
      adapter: createAdapter(pubClient, subClient),
      path: "/api/v1/socket",
      cors: {
        // origin: corsOrigins,
        methods: ["GET"],
        credentials: true,
      },
    });

    io.use(async (socket, next) => {
      const reference = "socketAuth";
      try {
        if (socket.handshake.auth && socket.handshake.auth.token) {
          const token = socket.handshake.auth.token;

          const { id, type } = jwt.verify(token, jwtConfig.secret_key);
          if (!Object.values(USER_TYPES).includes(type)) {
            throw new AppError(
              reference,
              "Token type not found",
              "custom",
              403
            );
          }

          switch (type) {
            case USER_TYPES.GUARD:
              const guard = await getGuard({ id });
              if (!guard) {
                throw new AppError(reference, "Guard not found", "custom", 401);
              }
              socket.userType = {
                type,
                id: guard.id,
                propertyId: guard.propertyId,
              };
              next();
              break;

            case USER_TYPES.ADMIN:
              const admin = await getAdmin({ id });
              if (!admin) {
                throw new AppError(reference, "Admin not found", "custom", 401);
              }
              socket.userType = {
                type,
                id: admin.id,
                propertyId: admin.propertyId,
              };
              next();
              break;
            case USER_TYPES.USER:
              const user = await getUser({ id });
              if (!user) {
                throw new AppError(reference, "User not found", "custom", 401);
              }
              if (!user.flatId) {
                throw new AppError(
                  reference,
                  "Request not approved, please contact admin",
                  "custom",
                  401
                );
              }

              socket.userType = {
                type,
                id: user.id,
                propertyId: (await getPropertyFromFlat(user.flatId)).id,
                flatId: user.flatId,
              };
              next();
              break;

            default:
              break;
          }
        } else {
          throw new AppError(reference, "Token not found", "custom", 403);
        }
      } catch (error) {
        logger.error(`Error in socket auth: ${error.message}`);
        socket.emit("unauthorized", {
          status: "fail",
          msg: error.message,
          errorCode: 403,
          errors: [],
        });
        socket.disconnect();
      }
    });

    io.on("connection", (socket) => {
      const room = socket.userType.propertyId;
      console.log("room>>>", room, io.sockets.adapter.rooms.get(room));
      socket.join(room);
      socket.on("updateVisit", () => {
        if (socket.userType.type != USER_TYPES.USER) {
          io.to(room).emit("unauthorized", {
            status: "fail",
            msg: "Access denied",
            errorCode: 403,
            errors: [],
          });
          socket.disconnect();
        } else {
          console.log("sendGuard emitted>>>>>");
          io.to(room).emit("sendGuard", {});
        }
      });

      socket.on("requestCount", async (event) => {
        if (socket.userType.type != USER_TYPES.GUARD) {
          io.to(room).emit("unauthorized", {
            status: "fail",
            msg: "Access denied",
            errorCode: 403,
            errors: [],
          });
          socket.disconnect();
        } else {
          console.log("socket.userType.id>>>>", socket.userType.id);
          // const requestedVisitors = await getRequestedVisitorsTotalCountForGuard(
          //   socket.userType.id
          // );
          io.to(room).emit("requestCountData", {
            status: "success",
            data: null,
          });
        }
      });

      socket.on("disconnect", async () => {
        console.log("Disconnected.....");
      });

      socket.on("connect_error", async (err) => {
        console.log("connect_error.......", err);
      });
      socket.on("connect_failed", async (err) => {
        console.log("connect_failed.....", err);
      });
    });
  } catch (error) {
    console.log("Socket catch error:", error);
  }
};
