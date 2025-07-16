const { Router } = require("express");
const tokenController = require("../controllers/token");
const { sendResponse } = require("../../utils/responseHandler");
const { validatePayload } = require("../../utils/middlewares/requestValidator");
const { generateTokensSchema } = require("../validators");
const tokenRoutes = Router();

tokenRoutes
  .route("/")
  .post(
    validatePayload({ body: generateTokensSchema }),
    async (req, res, next) => {
      try {
        const tokens = await tokenController.generateNewTokens(
          req.validatedBody.refreshToken
        );
        sendResponse(res, tokens, "New tokens generated successfully");
      } catch (error) {
        error.reference = error.reference ? error.reference : "POST /tokens";
        next(error);
      }
    }
  );

module.exports = tokenRoutes;
