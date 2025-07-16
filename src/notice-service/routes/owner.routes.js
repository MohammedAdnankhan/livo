const { pagination } = require("../../utils/middlewares/paginationMiddleware");
const { validatePayload } = require("../../utils/middlewares/requestValidator");
const { sendResponse } = require("../../utils/responseHandler");
const ownerNoticeController = require("../controllers/noticeOwner");
const { Router } = require("express");
const {
  getNoticeByNoticeIdSchema,
  getNoticesForOwnerSchema,
} = require("../validators");
const validateOwnerBuildingAccess = require("../../utils/middlewares/validateOwnerBuildingAccess");

const ownerNoticeRoutes = Router();

ownerNoticeRoutes
  .route("/")
  .get(
    validateOwnerBuildingAccess("query", false),
    pagination,
    validatePayload({ query: getNoticesForOwnerSchema }),
    async (req, res, next) => {
      try {
        const { buildingId } = req.validatedQuery;
        const payload = {
          buildingIds: buildingId
            ? [buildingId]
            : req.currentOwner.buildings.map(({ id }) => id),
          ownerId: req.currentOwner.id,
        };
        const notices = await ownerNoticeController.getNoticesForOwner(
          payload,
          req.paginate,
          req.language
        );
        sendResponse(res, notices, "Notices retrieved successfully");
      } catch (error) {
        error.reference = error.reference
          ? error.reference
          : "GET /notices/owner";
        next(error);
      }
    }
  );

ownerNoticeRoutes
  .route("/:noticeId")
  .get(
    validatePayload({ params: getNoticeByNoticeIdSchema }),
    async (req, res, next) => {
      try {
        const params = {
          buildingIds: req.currentOwner.buildings.map(({ id }) => id),
          noticeId: req.validatedParams.noticeId,
          ownerId: req.currentOwner.id,
        };
        const notice = await ownerNoticeController.getNoticeForOwner(
          params,
          req.language
        );
        sendResponse(res, notice, "Notice retrieved successfully");
      } catch (error) {
        error.reference = error.reference
          ? error.reference
          : "GET /notices/owner/:noticeId";
        next(error);
      }
    }
  );

module.exports = ownerNoticeRoutes;
