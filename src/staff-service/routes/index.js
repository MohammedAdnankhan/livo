const router = require("express").Router();
const { USER_TYPES, ADMIN_ROLES } = require("../../config/constants");
const { authToken } = require("../../utils/middlewares/authTokenMiddleware");
const {
  checkBuildingId,
} = require("../../utils/middlewares/checkBuildingIdMiddleware");
const { pagination } = require("../../utils/middlewares/paginationMiddleware");
const {
  restrictAdmin,
} = require("../../utils/middlewares/restrictMiddlewares");
const { validatePayload } = require("../../utils/middlewares/requestValidator");
const {
  validateBuildingIdForAdmin,
} = require("../../utils/middlewares/validateBuildingIdMiddleware");
const { sendResponse } = require("../../utils/responseHandler");
const { sanitisePayload } = require("../../utils/utility");
const staffController = require("../controllers/staff");
const authController = require("../controllers/auth");
const { staffLoginSchema } = require("../validators");
const staffRoutes = require("./staff.routes");

//get department types
router.get(
  "/departments",
  authToken(USER_TYPES.ADMIN),
  restrictAdmin(),
  async (req, res, next) => {
    try {
      const departments = await staffController.getDepartments();
      res.json({
        status: "success",
        data: departments,
      });
    } catch (error) {
      error.reference = error.reference
        ? error.reference
        : "GET /staffs/departments";
      next(error);
    }
  }
);

//get designation types
router.get(
  "/designations",
  authToken(USER_TYPES.ADMIN),
  restrictAdmin(),
  async (req, res, next) => {
    try {
      const designations = await staffController.getDesignations();
      res.json({
        status: "success",
        data: designations,
      });
    } catch (error) {
      error.reference = error.reference
        ? error.reference
        : "GET /staffs/designations";
      next(error);
    }
  }
);

//get appointment types
router.get(
  "/appointments",
  authToken(USER_TYPES.ADMIN),
  restrictAdmin(),
  async (req, res, next) => {
    try {
      const appointments = await staffController.getAppointments();
      res.json({
        status: "success",
        data: appointments,
      });
    } catch (error) {
      error.reference = error.reference
        ? error.reference
        : "GET /staffs/appointments";
      next(error);
    }
  }
);

//add new staff
router.post(
  "/",
  authToken(USER_TYPES.ADMIN),
  restrictAdmin(ADMIN_ROLES.ADMIN),
  async (req, res, next) => {
    try {
      await staffController.createStaff({
        ...req.body,
        propertyId: req.currentAdmin.propertyId,
      });
      res.json({
        status: "success",
        msg: "Staff created successfully",
        data: null,
      });
    } catch (error) {
      error.reference = error.reference ? error.reference : "POST /staffs";
      next(error);
    }
  }
);

//get all staffs
router.get(
  "/",
  authToken(USER_TYPES.ADMIN),
  restrictAdmin(ADMIN_ROLES.ADMIN),
  pagination,
  async (req, res, next) => {
    try {
      const staffs = await staffController.getAllStaffs(
        {
          ...sanitisePayload(req.query),
          propertyId: req.currentAdmin.propertyId,
        },
        req.paginate
      );
      res.json({
        status: "success",
        data: staffs,
      });
    } catch (error) {
      error.reference = error.reference ? error.reference : "GET /staffs";
      next(error);
    }
  }
);

//edit staff details
router.patch(
  "/",
  authToken(USER_TYPES.ADMIN),
  restrictAdmin(ADMIN_ROLES.ADMIN),
  async (req, res, next) => {
    try {
      await staffController.editStaffDetails({
        ...req.body,
        propertyId: req.currentAdmin.propertyId,
      });
      sendResponse(res, null, "Staff updated successfully");
    } catch (error) {
      error.reference = error.reference ? error.reference : "PATCH /staffs";
      next(error);
    }
  }
);

//get staffs with department names
router.get(
  "/admin",
  authToken(USER_TYPES.ADMIN),
  restrictAdmin(ADMIN_ROLES.ADMIN),
  async (req, res, next) => {
    try {
      const staffWithDepartments =
        await staffController.getStaffWithDepartmentNames({
          ...req.query,
          propertyId: req.currentAdmin.propertyId,
        });
      res.json({
        status: "success",
        data: staffWithDepartments,
      });
    } catch (error) {
      error.reference = error.reference ? error.reference : "GET /staffs/admin";
      next(error);
    }
  }
);

//get staff details
router.get(
  "/:staffId",
  authToken(USER_TYPES.ADMIN),
  restrictAdmin(ADMIN_ROLES.ADMIN),
  async (req, res, next) => {
    try {
      const staff = await staffController.getStaffDetails({
        id: req.params.staffId,
        propertyId: req.currentAdmin.propertyId,
      });
      res.json({
        status: "success",
        data: staff,
      });
    } catch (error) {
      error.reference = error.reference
        ? error.reference
        : "GET /staffs/:staffId";
      next(error);
    }
  }
);

router.get(
  "/admin/export",
  authToken(USER_TYPES.ADMIN),
  restrictAdmin(ADMIN_ROLES.ADMIN),
  async (req, res, next) => {
    try {
      const staffExports = await staffController.getStaffForExport({
        ...sanitisePayload(req.query),
        propertyId: req.currentAdmin.propertyId,
      });
      res.json({
        status: "success",
        data: staffExports,
      });
    } catch (error) {
      error.reference = error.reference
        ? error.reference
        : "GET /staffs/admin/export";
      next(error);
    }
  }
);

//get staff availability
router.get(
  "/availability/:staffId",
  authToken(USER_TYPES.ADMIN),
  restrictAdmin(ADMIN_ROLES.ADMIN),
  async (req, res, next) => {
    try {
      const availability = await staffController.getStaffAvailability(
        {
          id: req.params.staffId,
          date: req?.query?.date,
          isWeekly: req?.query?.isWeekly,
        },
        req.timezone
      );
      res.json({
        status: "success",
        data: availability,
      });
    } catch (error) {
      error.reference = error.reference
        ? error.reference
        : "GET /staffs/availability/:staffId";
      next(error);
    }
  }
);

//get staff calender
router.get(
  "/calender/:staffId",
  authToken(USER_TYPES.ADMIN),
  restrictAdmin(ADMIN_ROLES.ADMIN),
  async (req, res, next) => {
    try {
      const calender = await staffController.getStaffCalender(
        {
          id: req.params.staffId,
          date: req?.query?.date,
          status: req?.query?.status,
        },
        req.timezone
      );
      res.json({
        status: "success",
        data: calender,
      });
    } catch (error) {
      error.reference = error.reference
        ? error.reference
        : "GET /staffs/calender/:staffId";
      next(error);
    }
  }
);

//add staff timeslots for month
router.post(
  "/slots/:staffId",
  authToken(USER_TYPES.ADMIN),
  restrictAdmin(ADMIN_ROLES.ADMIN),
  async (req, res, next) => {
    try {
      const response = await staffController.addStaffSlotsForMonth(
        {
          ...req.body,
          propertyId: req.currentAdmin.propertyId,
          staffId: req.params.staffId,
        },
        req.timezone
      );
      res.json({
        status: "success",
        data: response,
      });
    } catch (error) {
      error.reference = error.reference
        ? error.reference
        : "POST /staffs/slots/:staffId";
      next(error);
    }
  }
);

//add specific staff timeslots
router.post(
  "/slots/specific/:staffId",
  authToken(USER_TYPES.ADMIN),
  restrictAdmin(ADMIN_ROLES.ADMIN),
  async (req, res, next) => {
    try {
      const response = await staffController.addStaffSlots(
        {
          ...req.body,
          propertyId: req.currentAdmin.propertyId,
          staffId: req.params.staffId,
        },
        req.timezone
      );
      res.json({
        status: "success",
        data: response,
      });
    } catch (error) {
      error.reference = error.reference
        ? error.reference
        : "POST /staffs/slots/:staffId";
      next(error);
    }
  }
);

router.post("/cron/availability", async (req, res, next) => {
  try {
    const response = await staffController.addStaffSlotsCron();
    res.json({
      status: "success",
      data: response,
    });
  } catch (error) {
    error.reference = error.reference
      ? error.reference
      : "POST /staffs/cron/availability";
    next(error);
  }
});

//change staff timeslots status
router.patch(
  "/slots/:staffId",
  authToken(USER_TYPES.ADMIN),
  restrictAdmin(ADMIN_ROLES.ADMIN),
  async (req, res, next) => {
    try {
      const response = await staffController.changeStaffSlotStatus(
        {
          id: req.params.staffId,
          propertyId: req.currentAdmin.propertyId,
        },
        { ...req.body }
      );
      res.json({
        status: "success",
        data: response,
      });
    } catch (error) {
      error.reference = error.reference
        ? error.reference
        : "PATCH /staffs/slots/:staffId";
      next(error);
    }
  }
);

router.delete(
  "/:staffId",
  authToken(USER_TYPES.ADMIN),
  restrictAdmin(ADMIN_ROLES.ADMIN),
  async (req, res, next) => {
    try {
      const staff = await staffController.deleteStaff({
        id: req.params.staffId,
        propertyId: req.currentAdmin.propertyId,
      });
      res.json({
        status: "success",
        msg: "Staff deleted successfully",
        data: staff,
      });
    } catch (error) {
      error.reference = error.reference
        ? error.reference
        : "DELETE /staffs/:staffId";
      next(error);
    }
  }
);

//login
router.post(
  "/login",
  validatePayload({ body: staffLoginSchema }),
  async (req, res, next) => {
    try {
      const result = await authController.loginStaff(req.validatedBody);

      sendResponse(res, result, "Staff logged in");
    } catch (error) {
      error.reference = error.reference
        ? error.reference
        : "POST /staffs/login";
      next(error);
    }
  }
);
router.use(authToken(USER_TYPES.STAFF), staffRoutes);

module.exports = router;
