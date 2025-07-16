const { Router } = require("express");
const { addTagsSchema, getTagsSchema } = require("../validators");
const adminTagsController = require("../controllers/tags");
const { validatePayload } = require("../../utils/middlewares/requestValidator");
const { authToken } = require("../../utils/middlewares/authTokenMiddleware");
const {
  restrictAdmin,
} = require("../../utils/middlewares/restrictMiddlewares");
const { USER_TYPES, ADMIN_ROLES } = require("../../config/constants");
const { sendResponse } = require("../../utils/responseHandler");

const adminTagRoutes = Router();

adminTagRoutes
  .route("/admin")
  .get(
    authToken(USER_TYPES.ADMIN),
    restrictAdmin(ADMIN_ROLES.ADMIN),
    validatePayload({ query: getTagsSchema }),
    async (req, res, next) => {
      try {
        const { propertyId } = req.currentAdmin;
        const params = {
          ...req.validatedQuery,
          propertyId,
        };
        const getTags = await adminTagsController.getAllTags(params);
        sendResponse(res, getTags, "Tags retrieved successfully");
      } catch (error) {
        error.reference = error.reference ? error.reference : "GET /tags/admin";
        next(error);
      }
    }
  )
  .post(
    authToken(USER_TYPES.ADMIN),
    restrictAdmin(ADMIN_ROLES.ADMIN),
    validatePayload({
      body: addTagsSchema,
    }),
    async (req, res, next) => {
      try {
        const tag = await adminTagsController.addTags({
          name: req.validatedBody.name,
          propertyId: req.currentAdmin.propertyId,
        });
        sendResponse(res, tag, "Tags added successfully", 201);
      } catch (error) {
        error.reference = error.reference
          ? error.reference
          : "POST /tags/admin";
        next(error);
      }
    }
  );

module.exports = adminTagRoutes;
