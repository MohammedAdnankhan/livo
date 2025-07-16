const router = require("express").Router();
const { USER_TYPES } = require("../../config/constants");
const { authToken } = require("../../utils/middlewares/authTokenMiddleware");
const { validatePayload } = require("../../utils/middlewares/requestValidator");
const { sendResponse } = require("../../utils/responseHandler");
const authController = require("../controllers/auth");
const { updateOwnerDetails, getBankDetails } = require("../controllers/owner");
const {
  ownerLoginSchema,
  ownerUpdateSchema,
  resetPasswordOtpSchema,
  resetPasswordSchema,
} = require("../validators");

//login owner
router.post(
  "/login",
  validatePayload({ body: ownerLoginSchema }),
  async (req, res, next) => {
    try {
      const data = await authController.loginOwner(req.validatedBody);
      sendResponse(res, data, "Owner logged in successfully");
    } catch (error) {
      error.reference = error.reference
        ? error.reference
        : "POST /owners/login";
      next(error);
    }
  }
);

router
  .route("/my")
  .get(authToken([USER_TYPES.OWNER]), async (req, res, next) => {
    try {
      const details = req.currentOwner;
      const bankDetails = await getBankDetails(req.currentOwner.id);
      details["bankDetails"] = bankDetails;
      sendResponse(res, details, "Details fetched successfully");
    } catch (error) {
      error.reference = error.reference ? error.reference : "GET /owner/my";
      next(error);
    }
  })
  .patch(
    authToken([USER_TYPES.OWNER]),
    validatePayload({ body: ownerUpdateSchema }),
    async (req, res, next) => {
      try {
        const owner = req.currentOwner;
        const details = await updateOwnerDetails(
          owner.mobileNumber,
          req.validatedBody
        );
        sendResponse(res, details, "Details updated successfully");
      } catch (error) {
        error.reference = error.reference
          ? error.reference
          : "PATCH /owners/my";
        next(error);
      }
    }
  );

router
  .route("/reset-password")
  .post(
    validatePayload({ body: resetPasswordOtpSchema }),
    async (req, res, next) => {
      try {
        await authController.resetPasswordOtp(req.validatedBody.mobileNumber);
        sendResponse(res, null, "Reset Password OTP sent successfully");
      } catch (error) {
        error.reference = error.reference
          ? error.reference
          : "POST /owners/reset-password";
        next(error);
      }
    }
  )
  .patch(
    validatePayload({ body: resetPasswordSchema }),
    async (req, res, next) => {
      try {
        /**@type {import("../types").IResetPassword} */
        const payload = req.validatedBody;

        await authController.resetPassword(payload);
        sendResponse(res, null, "Password modified successfully");
      } catch (error) {
        error.reference = error.reference
          ? error.reference
          : "PATCH /owners/reset-password";
        next(error);
      }
    }
  );

module.exports = router;
