const express = require("express");
const csv = require("fast-csv");
const { USER_TYPES, ADMIN_ROLES } = require("../../config/constants");
const { authToken } = require("../../utils/middlewares/authTokenMiddleware");
const { AppError } = require("../../utils/errorHandler");
const { pagination } = require("../../utils/middlewares/paginationMiddleware");
const {
  restrictAdmin,
} = require("../../utils/middlewares/restrictMiddlewares");
const flatController = require("../controllers/flat");
const multer = require("multer");
const { Readable, pipeline } = require("stream");
const logger = require("../../utils/logger");
const {
  validateBuildingIdForAdmin,
} = require("../../utils/middlewares/validateBuildingIdMiddleware");
const { sanitisePayload } = require("../../utils/utility");
const router = express.Router();
const floorController = require("../../floor-service/controllers/floorController");
const flatAdminRouter = require("./admin.routes");

const STORAGE = multer.memoryStorage();
const upload = multer({ storage: STORAGE });

router.use(
  "/admin",
  authToken(USER_TYPES.ADMIN),
  restrictAdmin(ADMIN_ROLES.ADMIN),
  flatAdminRouter
);

router.get("/", async (req, res, next) => {
  try {
    const flats = await flatController.getFlats(req.query, req.language);
    res.json({
      status: "success",
      data: flats,
    });
  } catch (error) {
    error.reference = error.reference ? error.reference : "GET /flats";
    next(error);
  }
});

router.get("/vacant/:buildingId", async (req, res, next) => {
  try {
    const flats = await floorController.getVacantFlats(
      { buildingId: req.params.buildingId, search: req.query?.search },
      req.language
    );
    res.json({
      status: "success",
      data: flats,
    });
  } catch (error) {
    error.reference = error.reference
      ? error.reference
      : "GET /flats/vacant/:buildingId";
    next(error);
  }
});

// router.get(
//   "/admin/all",
//   authToken(USER_TYPES.ADMIN),
//   restrictAdmin(ADMIN_ROLES.ADMIN),
//   async (req, res, next) => {
//     try {
//       const flats = await flatController.getAllFlats({
//         ...sanitisePayload(req.query),
//         propertyId: req.currentAdmin.propertyId,
//       });
//       res.json({
//         status: "success",
//         data: flats,
//       });
//     } catch (error) {
//       error.reference = error.reference
//         ? error.reference
//         : "GET /flats/admin/all";
//       next(error);
//     }
//   }
// );

router.get("/address", authToken(), async (req, res, next) => {
  try {
    const response = await flatController.getFlatAddress(
      { id: req.currentUser.flatId },
      req.language
    );
    res.json({
      status: "success",
      data: response,
    });
  } catch (error) {
    error.reference = error.reference ? error.reference : "GET /flats";
    next(error);
  }
});

router.patch(
  "/owner",
  authToken(USER_TYPES.ADMIN),
  restrictAdmin(ADMIN_ROLES.ADMIN),
  async (req, res, next) => {
    try {
      const owner = await flatController.updateOwner({
        ...req.body,
        propertyId: req.currentAdmin.propertyId,
      });
      res.json({
        status: "success",
        data: owner,
      });
    } catch (error) {
      error.reference = error.reference
        ? error.reference
        : "PATCH /flats/owner";
      next(error);
    }
  }
);

//add owner to flat
router.post(
  "/owner",
  authToken(USER_TYPES.ADMIN),
  restrictAdmin(),
  async (req, res, next) => {
    try {
      // TODO: flatId to admin Id check missing
      const ownerDetails = await flatController.addOwner(
        req.body,
        req.timezone
      );
      res.json({
        status: "success",
        data: ownerDetails,
      });
    } catch (error) {
      error.reference = error.reference ? error.reference : "POST /flats/owner";
      next(error);
    }
  }
);

//TODO: move to admin route file
//get all flats
router.get(
  "/admin",
  authToken(USER_TYPES.ADMIN),
  restrictAdmin(ADMIN_ROLES.ADMIN),
  validateBuildingIdForAdmin,
  pagination,
  async (req, res, next) => {
    try {
      const params = { ...sanitisePayload(req.query) };
      if (req.currentAdmin.buildingId) {
        params.buildingId = req.currentAdmin.buildingId;
      } else {
        params["$building.propertyId$"] = req.currentAdmin.propertyId;
      }

      const flats = await flatController.countAndGetFlats(
        params,
        req.paginate,
        req.language
      );
      res.json({
        status: "success",
        data: flats,
      });
    } catch (error) {
      error.reference = error.reference ? error.reference : "GET /flats/admin";
      next(error);
    }
  }
);

router.get(
  "/admin/owner/:flatId",
  authToken(USER_TYPES.ADMIN),
  restrictAdmin(ADMIN_ROLES.ADMIN),
  async (req, res, next) => {
    try {
      const flatOwner = await flatController.getFlatOwnerDetails({
        id: req.params.flatId,
      });
      res.json({
        status: "success",
        data: flatOwner,
      });
    } catch (error) {
      error.reference = error.reference
        ? error.reference
        : "GET /flats/admin/owner/:flatId";
      next(error);
    }
  }
);

router.post(
  "/csv",
  authToken(USER_TYPES.ADMIN),
  validateBuildingIdForAdmin, //TODO: testing to be done
  upload.single("file"),
  async (req, res, next) => {
    try {
      let buildingId;
      if (req.currentAdmin.role === ADMIN_ROLES.ADMIN) {
        buildingId = req.currentAdmin.buildingId;
      } else {
        buildingId = req.body.buildingId;
      }

      if (!buildingId) {
        throw new AppError("", "Building Id is required", "custom", 412);
      }

      if (!req.file) {
        throw new AppError(
          "",
          "Please send a csv file in request body",
          "custom",
          412
        );
      }

      if (req.file.mimetype !== "text/csv") {
        throw new AppError("", "Only a csv file is accepted", "custom", 412);
      }
      const flats = [];
      const rows = [];
      let invalidRows = {};

      pipeline(
        Readable.from(req.file.buffer),
        csv.parse({ headers: true }),
        (err) => {
          if (err) {
            return next(new AppError("POST /flats/csv", err.message));
          }
        }
      )
        .on("data", (row) => {
          rows.push(row);
        })
        .on("end", async () => {
          for (const i in rows) {
            const row = rows[i];
            try {
              if (row.images) {
                row.images = row.images.split(",").map((el) => el.trim());
              }
              const flat = await flatController.addFlat({
                ...row,
                buildingId: req.currentAdmin.buildingId,
              });
              flats.push(flat);
            } catch (error) {
              logger.warn(error.message);
              invalidRows[+i + 2] = Array.isArray(error.errors)
                ? error.errors.map((e) => e.message)
                : [];
            }
          }
          res.json({
            status: "success",
            msg: `Unit stats: ${flats.length} created, ${
              Object.keys(invalidRows).length
            } failed`,
            data: {
              flats,
              invalidRows,
            },
          });
        });
    } catch (error) {
      error.reference = error.reference ? error.reference : "GET /flats/csv/";
      next(error);
    }
  }
);

//TODO: deprecate
router.delete(
  "/:flatId",
  authToken(USER_TYPES.ADMIN),
  restrictAdmin(ADMIN_ROLES.ADMIN),
  async (req, res, next) => {
    try {
      await flatController.deleteFlat({
        id: req.params.flatId,
        propertyId: req.currentAdmin.propertyId,
      });
      res.json({
        status: "success",
        msg: "Flat deleted successfully",
        data: null,
      });
    } catch (error) {
      error.reference = error.reference
        ? error.reference
        : "DELETE /flats/:flatId";
      next(error);
    }
  }
);

module.exports = router;
