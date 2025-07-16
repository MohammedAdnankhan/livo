const router = require("express").Router();
const { authToken } = require("../../utils/middlewares/authTokenMiddleware");
const { pagination } = require("../../utils/middlewares/paginationMiddleware");
const {
  restrictAdmin,
} = require("../../utils/middlewares/restrictMiddlewares");

const { AppError } = require("../../utils/errorHandler");

const {
  createAmenitySchema,
  getAmenitiesListSchema,
  getAmenitiesSchema,
  getAmenityByIdSchema,
  updateAmenitySchema,
} = require("../validators");
const { USER_TYPES, ADMIN_ROLES } = require("../../config/constants");
const amenityController = require("../controllers/amenity");
const { validatePayload } = require("../../utils/middlewares/requestValidator");
const { sendResponse } = require("../../utils/responseHandler");

const amenityRoutes = router;

amenityRoutes
  .route("/admin")
  .post(
    authToken(USER_TYPES.ADMIN),
    restrictAdmin(ADMIN_ROLES.ADMIN),
    validatePayload({ body: createAmenitySchema }),
    async (req, res, next) => {
      try {
        await amenityController.createAmenity({
          ...req.validatedBody,
          propertyId: req.currentAdmin.propertyId,
        });
        sendResponse(res, null, `Amenity created successfully`);
      } catch (error) {
        error.reference = error.reference
          ? error.reference
          : "POST /amenities/admin";
        next(error);
      }
    }
  )
  .get(
    authToken(USER_TYPES.ADMIN),
    restrictAdmin(ADMIN_ROLES.ADMIN),
    pagination,
    validatePayload({ query: getAmenitiesSchema }),
    async (req, res, next) => {
      try {
        const amenities = await amenityController.getAmenities(
          {
            ...req.validatedQuery,
            propertyId: req.currentAdmin.propertyId,
          },
          req.paginate
        );
        sendResponse(res, amenities, `amenities fetched successfully`);
      } catch (error) {
        error.reference = error.reference
          ? error.reference
          : "GET /amenities/admin";
        next(error);
      }
    }
  )

  .patch(
    authToken(USER_TYPES.ADMIN),
    restrictAdmin(ADMIN_ROLES.ADMIN),
    validatePayload({ query: getAmenityByIdSchema, body: updateAmenitySchema }),
    async (req, res, next) => {
      try {
        await amenityController.updateAmenity(req.validatedBody, {
          propertyId: req.currentAdmin.propertyId,
          id: req.validatedQuery.amenityId,
        });
        sendResponse(res, null, `amenity updated successfully`);
      } catch (error) {
        error.reference = error.reference
          ? error.reference
          : "PATCH /amenities/admin";
        next(error);
      }
    }
  )

  .delete(
    authToken(USER_TYPES.ADMIN),
    restrictAdmin(ADMIN_ROLES.ADMIN),
    validatePayload({ query: getAmenityByIdSchema }),
    async (req, res, next) => {
      try {
        await amenityController.deleteAmenity({
          propertyId: req.currentAdmin.propertyId,
          id: req.validatedQuery.amenityId,
        });
        sendResponse(res, null, `amenity deleted successfully`);
      } catch (error) {
        error.reference = error.reference
          ? error.reference
          : "DELETE /amenities/admin";
        next(error);
      }
    }
  );

amenityRoutes
  .route("/visibility/admin")
  .patch(
    authToken(USER_TYPES.ADMIN),
    restrictAdmin(ADMIN_ROLES.ADMIN),
    validatePayload({ query: getAmenityByIdSchema }),
    async (req, res, next) => {
      try {
        const amenity = await amenityController.amenitiesVisibility({
          id: req.validatedQuery.amenityId,
          propertyId: req.currentAdmin.propertyId,
        });
        const message = `Amenity ${
          amenity ? `enabled` : " disabled"
        } successfully`;
        sendResponse(res, null, message);
      } catch (error) {
        error.reference = error.reference
          ? error.reference
          : "PATCH /amenities/visibility/admin";
        next(error);
      }
    }
  );

amenityRoutes
  .route("/list/admin")
  .get(
    authToken(USER_TYPES.ADMIN),
    restrictAdmin(ADMIN_ROLES.ADMIN),
    validatePayload({ query: getAmenitiesListSchema }),
    async (req, res, next) => {
      try {
        const amenity = await amenityController.getAmenityList({
          ...req.validatedQuery,
          propertyId: req.currentAdmin.propertyId,
          isVisible: true,
        });
        sendResponse(res, amenity, null);
      } catch (error) {
        error.reference = error.reference
          ? error.reference
          : "POST /amenities/admin";
        next(error);
      }
    }
  );

module.exports = amenityRoutes;
