const { USER_TYPES } = require("../../config/constants");
const { authToken } = require("../../utils/middlewares/authTokenMiddleware");
const timeslotController = require("../controllers/timeslot");

const router = require("express").Router();

//get timeslots
router.get("/", authToken(USER_TYPES.ADMIN), async (req, res, next) => {
  try {
    const slots = await timeslotController.getTimeSlots(
      { ...req.query },
      req.timezone
    );
    res.json({
      status: "success",
      data: slots,
    });
  } catch (error) {
    error.reference = error.reference ? error.reference : "GET /timeslots";
    next(error);
  }
});

//add timeslots
router.post("/cron", async (req, res, next) => {
  try {
    const resp = await timeslotController.addTimeSlots();
    res.json({
      status: "success",
      data: resp,
    });
  } catch (error) {
    error.reference = error.reference
      ? error.reference
      : "POST /timeslots/cron";
    next(error);
  }
});

module.exports = router;
