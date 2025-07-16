const router = require("express").Router();
const { USER_TYPES } = require("../../config/constants");
const { authToken } = require("../../utils/middlewares/authTokenMiddleware");
const { sendResponse } = require("../../utils/responseHandler");

const staffRoutes = router;

//get staff details
staffRoutes.get("/profile/me", async (req, res, next) => {
  try {
    const details = req.currentStaff;
    sendResponse(res, details, "Staff details retrieved successfully");
  } catch (error) {
    error.reference = error.reference
      ? error.reference
      : "GET /staffs/profile/me";
    next(error);
  }
});

module.exports = staffRoutes;
