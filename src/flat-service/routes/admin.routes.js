const { Router } = require("express");
const { sanitisePayload } = require("../../utils/utility");
const flatController = require("../controllers/flat");
const flatAdminController = require("../controllers/adminFlat");
const { sendResponse } = require("../../utils/responseHandler");
const { validatePayload } = require("../../utils/middlewares/requestValidator");
const {
  mapOwnerToFlatSchema,
  createFlatSchema,
  getFlatByFlatIdSchema,
  updateFlatSchema,
  getFlatsSchema,
} = require("../validators");
const {
  validateBuildingIdForAdmin,
} = require("../../utils/middlewares/validateBuildingIdMiddleware");
const { pagination } = require("../../utils/middlewares/paginationMiddleware");
const { formGroupOfIds } = require("../utils/flat.utility");

const flatAdminRouter = Router();

flatAdminRouter
  .route("/")
  .post(validatePayload({ body: createFlatSchema }), async (req, res, next) => {
    try {
      await flatAdminController.createFlat(
        req.validatedBody,
        req.currentAdmin.propertyId
      );
      sendResponse(res, null, "Unit created successfully");
    } catch (error) {
      error.reference = error.reference ? error.reference : "POST /flats/admin";
      next(error);
    }
  });

flatAdminRouter
  .route("/owner")
  .post(
    validatePayload({ body: mapOwnerToFlatSchema }),
    async (req, res, next) => {
      try {
        const payload = {
          ...req.validatedBody,
          propertyId: req.currentAdmin.propertyId,
        };

        await flatController.addOwner(payload);
        sendResponse(res, null, "Owner mapped successfully");
      } catch (error) {
        error.reference = error.reference
          ? error.reference
          : "POST /flats/admin/owner";
        next(error);
      }
    }
  );

flatAdminRouter.route("/all").get(async (req, res, next) => {
  try {
    const flats = await flatController.getAllFlats({
      ...sanitisePayload(req.query),
      propertyId: req.currentAdmin.propertyId,
    });

    sendResponse(res, flats);
  } catch (error) {
    error.reference = error.reference
      ? error.reference
      : "GET /flats/admin/all";
    next(error);
  }
});

flatAdminRouter
  .route("/list") //TODO: modify with new flow and restrictions
  .get(
    validateBuildingIdForAdmin,
    pagination,
    formGroupOfIds,
    validatePayload({ query: getFlatsSchema }),
    async (req, res, next) => {
      try {
        const params = { ...sanitisePayload(req.validatedQuery) };

        if (req.currentAdmin.buildingId) {
          params.buildingId = req.currentAdmin.buildingId;
        }
        const flats = await flatController.countAndGetFlatsWithFilters(
          params,
          req.currentAdmin.propertyId,
          req.paginate,
          req.language
        );

        sendResponse(res, flats, "Units retrieved successfully");
      } catch (error) {
        error.reference = error.reference
          ? error.reference
          : "GET /flats/admin/list";
        next(error);
      }
    }
  );

flatAdminRouter
  .route("/export")
  .get(validatePayload({ query: getFlatsSchema }), async (req, res, next) => {
    try {
      const flatExports = await flatController.getFlatsInPropertyForExport({
        ...sanitisePayload(req.validatedQuery),
        propertyId: req.currentAdmin.propertyId,
        buildingId: req.query?.buildingId,
      });
      sendResponse(res, flatExports, "Units retrieved successfully");
    } catch (error) {
      error.reference = error.reference
        ? error.reference
        : "GET /flats/admin/export";
      next(error);
    }
  });

flatAdminRouter
  .route("/:flatId")
  .patch(
    validatePayload({ params: getFlatByFlatIdSchema, body: updateFlatSchema }),
    async (req, res, next) => {
      try {
        await flatAdminController.updateFlat(
          req.validatedParams.flatId,
          req.currentAdmin.propertyId,
          req.validatedBody
        );

        sendResponse(res, null, "Unit updated successfully");
      } catch (error) {
        error.reference = error.reference
          ? error.reference
          : "PATCH /flats/admin/:flatId";
        next(error);
      }
    }
  )
  .get(
    validatePayload({ params: getFlatByFlatIdSchema }),
    async (req, res, next) => {
      try {
        const flat = await flatController.getFlatDetails({
          id: req.validatedParams.flatId,
          propertyId: req.currentAdmin.propertyId,
        }); //TODO: trim data in this function

        sendResponse(res, flat, "Unit retrieved successfully");
      } catch (error) {
        error.reference = error.reference
          ? error.reference
          : "GET /flats/admin/:flatId";
        next(error);
      }
    }
  )
  .delete(
    validatePayload({ params: getFlatByFlatIdSchema }),
    async (req, res, next) => {
      try {
        await flatController.deleteFlat({
          id: req.validatedParams.flatId,
          propertyId: req.currentAdmin.propertyId,
        });
        sendResponse(res, null, "Unit deleted successfully");
      } catch (error) {
        error.reference = error.reference
          ? error.reference
          : "DELETE /flats/admin/:flatId";
        next(error);
      }
    }
  );

module.exports = flatAdminRouter;
