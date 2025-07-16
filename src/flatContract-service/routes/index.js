const router = require("express").Router();
const { USER_TYPES, ADMIN_ROLES } = require("../../config/constants");
const { authToken } = require("../../utils/middlewares/authTokenMiddleware");
const { pagination } = require("../../utils/middlewares/paginationMiddleware");
const {
  restrictAdmin,
} = require("../../utils/middlewares/restrictMiddlewares");
const { sanitisePayload } = require("../../utils/utility");
const flatContractController = require("../controllers/flatContract");
const contractRenewalController = require("../controllers/contractRenewal");
const {
  validateBuildingIdForAdmin,
} = require("../../utils/middlewares/validateBuildingIdMiddleware");

//create flat contract
router.post(
  "/",
  authToken(USER_TYPES.ADMIN),
  restrictAdmin(ADMIN_ROLES.ADMIN),
  async (req, res, next) => {
    try {
      const contract = await flatContractController.createContract({
        ...req.body,
        propertyId: req.currentAdmin.propertyId,
      });
      res.json({
        status: "success",
        msg: `Contract created successfully`,
        data: contract,
      });
    } catch (error) {
      error.reference = error.reference
        ? error.reference
        : "POST /flat-contracts";
      next(error);
    }
  }
);

//get all contracts
router.get(
  "/",
  authToken(USER_TYPES.ADMIN),
  restrictAdmin(ADMIN_ROLES.ADMIN),
  pagination,
  async (req, res, next) => {
    try {
      const contracts = await flatContractController.getContracts(
        {
          ...sanitisePayload(req.query),
          propertyId: req.currentAdmin.propertyId,
        },
        req.paginate,
        req.timezone
      );
      res.json({
        status: "success",
        data: contracts,
      });
    } catch (error) {
      error.reference = error.reference
        ? error.reference
        : "GET /flat-contracts";
      next(error);
    }
  }
);

//get all contracts for export
router.get(
  "/export",
  authToken(USER_TYPES.ADMIN),
  restrictAdmin(ADMIN_ROLES.ADMIN),
  pagination,
  async (req, res, next) => {
    try {
      const contracts = await flatContractController.getContractsForExport(
        {
          ...sanitisePayload(req.query),
          propertyId: req.currentAdmin.propertyId,
        },
        req.timezone
      );
      res.json({
        status: "success",
        data: contracts,
      });
    } catch (error) {
      error.reference = error.reference
        ? error.reference
        : "GET /flat-contracts/export";
      next(error);
    }
  }
);

router.get(
  "/payments/:contractId",
  authToken(USER_TYPES.ADMIN),
  restrictAdmin(ADMIN_ROLES.ADMIN),
  async (req, res, next) => {
    try {
      const contractPayments = await flatContractController.getContractPayments(
        {
          id: req.params.contractId,
        }
      );
      res.json({
        status: "success",
        data: contractPayments,
      });
    } catch (error) {
      error.reference = error.reference
        ? error.reference
        : "GET /flat-contracts/payments/:contractId";
      next(error);
    }
  }
);

router.get("/my", authToken(), async (req, res, next) => {
  try {
    const contract = await flatContractController.getFlatContractForResident({
      mobileNumber: req.currentUser.mobileNumber,
    });
    res.json({
      status: "success",
      msg: "Lease details retrieved",
      data: contract,
    });
  } catch (error) {
    next(error);
  }
});

//get contract
router.get(
  "/:contractId",
  authToken(USER_TYPES.ADMIN),
  restrictAdmin(ADMIN_ROLES.ADMIN),
  async (req, res, next) => {
    try {
      const contract = await flatContractController.getContract({
        id: req.params.contractId,
        propertyId: req.currentAdmin.propertyId,
      });
      res.json({
        status: "success",
        data: contract,
      });
    } catch (error) {
      error.reference = error.reference
        ? error.reference
        : "GET /flat-contracts/:contractId";
      next(error);
    }
  }
);

//edit flat contract
router.patch(
  "/",
  authToken(USER_TYPES.ADMIN),
  restrictAdmin(ADMIN_ROLES.ADMIN),
  async (req, res, next) => {
    try {
      // TODO: flatId to adminId check missing
      const contract = await flatContractController.editContract(
        req.body,
        req.timezone
      );
      res.json({
        status: "success",
        data: contract,
      });
    } catch (error) {
      error.reference = error.reference
        ? error.reference
        : "PATCH /flat-contracts";
      next(error);
    }
  }
);

//remove resident from a flat
router.patch(
  "/void/:contractId",
  authToken(USER_TYPES.ADMIN),
  restrictAdmin(),
  async (req, res, next) => {
    try {
      // TODO: flatId to adminId check missing
      await flatContractController.voidContract({
        ...req.body,
        contractId: req.params.contractId,
      });
      res.json({
        status: "success",
        msg: "Contract canceled successfully",
        data: null,
      });
    } catch (error) {
      error.reference = error.reference
        ? error.reference
        : "PATCH /flat-contracts/void/:contractId";
      next(error);
    }
  }
);

router.post("/cron/contract-expiry", async (req, res, next) => {
  try {
    const resp = await flatContractController.contractExpiryCron();
    res.json({
      status: "success",
      data: resp,
    });
  } catch (error) {
    error.reference = error.reference
      ? error.reference
      : "POST /flat-contracts/cron/contract-expiry";
    next(error);
  }
});

router.get("/cron/renewal-reminder", async (_req, res, next) => {
  try {
    const contractCount = await flatContractController.renewalRemindersCron();
    res.json({
      status: "success",
      msg: `${contractCount} reminders were sent!`,
    });
  } catch (error) {
    error.reference = error.reference
      ? error.reference
      : "GET /flat-contracts/cron/renewal-reminder";
    next(error);
  }
});
//TODO: Have to deprecate this route
router.get(
  "/admin/statistics",
  authToken(USER_TYPES.ADMIN),
  restrictAdmin(ADMIN_ROLES.ADMIN),
  async (req, res, next) => {
    try {
      const contractStats = await flatContractController.flatContractStats({
        propertyId: req.currentAdmin.propertyId,
      });
      res.json({
        status: "success",
        data: contractStats,
      });
    } catch (error) {
      error.reference = error.reference
        ? error.reference
        : "GET /flat-contracts/admin/statistics";
      next(error);
    }
  }
);
//* create renewal requests for user
router.post(
  "/user/renew",
  authToken(USER_TYPES.USER),
  async (req, res, next) => {
    try {
      await contractRenewalController.renewContractForUser({
        ...req.body,
        mobileNumber: req.currentUser.mobileNumber,
        userId: req.currentUser.id,
      });
      res.json({
        status: "success",
        msg: `Contract renewal request received`,
        data: null,
      });
    } catch (error) {
      error.reference = error.reference
        ? error.reference
        : "POST /flat-contacts/user/renew";
      next(error);
    }
  }
);

//* create renewal requests for admin
router.post(
  "/admin/renew",
  authToken(USER_TYPES.ADMIN),
  restrictAdmin(ADMIN_ROLES.ADMIN),
  async (req, res, next) => {
    try {
      await contractRenewalController.renewContractForAdmin({
        ...req.body,
      });
      res.json({
        status: "success",
        msg: `Contract renewal request added`,
        data: null,
      });
    } catch (error) {
      error.reference = error.reference
        ? error.reference
        : "POST /flat-contracts/admin/renew";
      next(error);
    }
  }
);

//* get renewal requests
router.get(
  "/admin/renewal-requests",
  authToken(USER_TYPES.ADMIN),
  restrictAdmin(ADMIN_ROLES.ADMIN),
  pagination,
  async (req, res, next) => {
    try {
      const requests =
        await contractRenewalController.getRenewalRequestsForAdmin(
          { ...sanitisePayload(req.query) },
          req.currentAdmin.propertyId,
          req.paginate
        );
      res.json({
        status: "success",
        data: requests,
      });
    } catch (error) {
      error.reference = error.reference
        ? error.reference
        : "GET /flat-contracts/admin/renewal-requests";
      next(error);
    }
  }
);

//*approve request with id
router.patch(
  "/admin/approve-request/:renewRequestId",
  authToken(USER_TYPES.ADMIN),
  restrictAdmin(ADMIN_ROLES.ADMIN),
  async (req, res, next) => {
    try {
      await contractRenewalController.approveRequest(
        {
          id: req.params.renewRequestId,
          isApproved: false,
        },
        req.body,
        req.currentAdmin.propertyId
      );
      res.json({
        status: "success",
        msg: `Request approved successfully`,
        data: null,
      });
    } catch (error) {
      error.reference = error.reference
        ? error.reference
        : "PATCH /flat-contracts/admin/approve-request/:id";
      next(error);
    }
  }
);

//*get request details with id
router.get(
  "/admin/requests/:renewRequestId",
  authToken(USER_TYPES.ADMIN),
  restrictAdmin(ADMIN_ROLES.ADMIN),
  async (req, res, next) => {
    try {
      const data = await contractRenewalController.getRenewRequestDetails({
        id: req.params.renewRequestId,

        propertyId: req.currentAdmin.propertyId,
      });
      res.json({
        status: "success",
        data: data,
      });
    } catch (error) {
      error.reference = error.reference
        ? error.reference
        : "PATCH /flat-contracts/admin/requests/:renewRequestId";
      next(error);
    }
  }
);

//*reject request
router.delete(
  "/admin/reject-request/:renewRequestId",
  authToken(USER_TYPES.ADMIN),
  restrictAdmin(ADMIN_ROLES.ADMIN),
  async (req, res, next) => {
    try {
      await contractRenewalController.rejectRenewRequestDetails({
        id: req.params.renewRequestId,

        propertyId: req.currentAdmin.propertyId,
      });
      res.json({
        status: "success",
        msg: `Request rejected successfully`,
        data: null,
      });
    } catch (error) {
      error.reference = error.reference
        ? error.reference
        : "DELETE /flat-contracts/admin/reject-request/:renewRequestId";
      next(error);
    }
  }
);
//*renewal contract cron

router.post("/cron/renewal-request", async (_req, res, next) => {
  try {
    await contractRenewalController.contractRenewalCron();
    res.json({
      status: "success",
      msg: `contracts were created!`,
      data: null,
    });
  } catch (error) {
    error.reference = error.reference
      ? error.reference
      : "GET /flat-contracts/cron/renewal-request";
    next(error);
  }
});

//* get declined renewal requests
router.get(
  "/admin/declined-requests",
  authToken(USER_TYPES.ADMIN),
  restrictAdmin(ADMIN_ROLES.ADMIN),
  validateBuildingIdForAdmin,
  pagination,
  async (req, res, next) => {
    try {
      if (req.currentAdmin.buildingId) {
        const requests =
          await contractRenewalController.declinedRequestsListingsByBuildingId(
            { ...sanitisePayload(req.query) },
            req.currentAdmin.propertyId,
            req.currentAdmin.buildingId,
            req.paginate
          );
        res.json({
          status: "success",
          data: requests,
        });
      } else {
        const requests =
          await contractRenewalController.declinedRequestsListings(
            { ...sanitisePayload(req.query) },
            req.currentAdmin.propertyId,
            req.paginate
          );
        res.json({
          status: "success",
          data: requests,
        });
      }
    } catch (error) {
      error.reference = error.reference
        ? error.reference
        : "GET /flat-contracts/admin/declined-requests";
      next(error);
    }
  }
);

module.exports = router;
