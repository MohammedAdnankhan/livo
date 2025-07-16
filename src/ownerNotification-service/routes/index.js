const { Router } = require("express");
const { authToken } = require("../../utils/middlewares/authTokenMiddleware");
const { USER_TYPES } = require("../../config/constants");
const { validatePayload } = require("../../utils/middlewares/requestValidator");
const { createOwnerToken, deleteOwnerToken } = require("../validators");
const { sendResponse } = require("../../utils/responseHandler");
const pushDeviceController = require("../controllers/pushDevice");

const ownerNotificationRoutes = Router();

ownerNotificationRoutes.use(authToken([USER_TYPES.OWNER]));

ownerNotificationRoutes
  .route("/add-token")
  .post(validatePayload({ body: createOwnerToken }), async (req, res, next) => {
    try {
      /**@type {import("../types").IAddOwnerToken} */
      const payload = {
        ...req.validatedBody,
        ownerId: req.ownerEntity.id,
      };

      await pushDeviceController.addOwnerToken(payload);

      sendResponse(res, null, "Token added successfully", 201);
    } catch (error) {
      error.reference = error.reference
        ? error.reference
        : "POST /owner-notifications/add-token";
      next(error);
    }
  });

ownerNotificationRoutes
  .route("/remove-token")
  .post(validatePayload({ body: deleteOwnerToken }), async (req, res, next) => {
    try {
      /**@type {import("../types").IRemoveOwnerToken} */
      const payload = {
        ownerId: req.ownerEntity.id,
        token: req.validatedBody.token,
      };

      await pushDeviceController.removeOwnerToken(payload);

      sendResponse(res, null, "Token removed successfully");
    } catch (error) {
      error.reference = error.reference
        ? error.reference
        : "POST /owner-notifications/remove-token";
      next(error);
    }
  });

module.exports = ownerNotificationRoutes;
