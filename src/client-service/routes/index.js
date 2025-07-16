const express = require("express");
const { validatePayload } = require("../../utils/middlewares/requestValidator");
const clientController = require("./../controllers/client");
const { clientRegistrationSchema } = require("../validators");
const { sendResponse } = require("../../utils/responseHandler");
const router = express.Router();

router.post(
  "/",
  validatePayload({ body: clientRegistrationSchema }),
  async (req, res, next) => {
    try {
      const data = await clientController.registerNewClient(req.validatedBody);
      sendResponse(res, data, "User authenticated successfully");
    } catch (error) {
      error.reference = error.reference ? error.reference : "POST /clients";
      next(error);
    }
  }
);
module.exports = router;
