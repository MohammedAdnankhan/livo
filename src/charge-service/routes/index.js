const router = require("express").Router();
const {
  PAYMENT_STATUSES,
  USER_TYPES,
  ADMIN_ROLES,
} = require("../../config/constants");
const { authToken } = require("../../utils/middlewares/authTokenMiddleware");
const {
  checkBuildingId,
} = require("../../utils/middlewares/checkBuildingIdMiddleware");
const logger = require("../../utils/logger");
const { pagination } = require("../../utils/middlewares/paginationMiddleware");
const {
  restrictAdmin,
} = require("../../utils/middlewares/restrictMiddlewares");
const {
  validateBuildingIdForAdmin,
} = require("../../utils/middlewares/validateBuildingIdMiddleware");
const chargeController = require("../controllers/charge");
const env = process.env.NODE_ENV || "development";
const stripeConfig = require("./../../config/stripe.json")[env];
const stripe = require("stripe")(stripeConfig.SECRET_KEY, {
  apiVersion: "2020-08-27",
});
const paymentController = require("./../controllers/payment");

//create new charge
router.post(
  "/",
  authToken([USER_TYPES.USER, USER_TYPES.ADMIN]),
  async (req, res, next) => {
    if (req.currentUser) {
      req.body.flatId = req.currentUser.flatId;
    }

    try {
      const newCharge = await chargeController.createNewCharge(
        {
          ...req.body,
        },
        req.timezone
      );
      res.json({
        status: "success",
        data: newCharge,
      });
    } catch (error) {
      error.reference = error.reference ? error.reference : "POST /charges";
      next(error);
    }
  }
);

//get charge lists
router.get("/", authToken(), pagination, async (req, res, next) => {
  try {
    const chargeLists = await chargeController.getChargeLists(
      {
        flatId: req.currentUser.flatId,
      },
      req.query,
      req.paginate,
      req.language
    );
    res.json({
      status: "success",
      data: chargeLists,
    });
  } catch (error) {
    error.reference = error.reference ? error.reference : "GET /charges";
    next(error);
  }
});

//get charge lists for admin
router.get(
  "/admin",
  authToken(USER_TYPES.ADMIN),
  restrictAdmin([ADMIN_ROLES.ADMIN]),
  validateBuildingIdForAdmin,
  pagination,
  async (req, res, next) => {
    try {
      let chargeLists;
      if (req.currentAdmin.buildingId) {
        chargeLists = await chargeController.getChargeListsByBuilding(
          {
            buildingId: req.currentAdmin.buildingId,
          },
          req.query,
          req.paginate,
          req.language
        );
      } else {
        chargeLists = await chargeController.getChargeListsByProperty(
          { propertyId: req.currentAdmin.propertyId },
          req.query,
          req.paginate,
          req.language
        );
      }
      res.json({
        status: "success",
        data: chargeLists,
      });
    } catch (error) {
      error.reference = error.reference
        ? error.reference
        : "GET /charges/admin";
      next(error);
    }
  }
);

router.post(
  "/bulk",
  authToken([USER_TYPES.ADMIN]),
  restrictAdmin([ADMIN_ROLES.ADMIN]),
  validateBuildingIdForAdmin,
  checkBuildingId,
  async (req, res, next) => {
    try {
      const newCharges = await chargeController.createChargesByBuilding(
        {
          ...req.body,
          buildingId: req.currentAdmin.buildingId,
        },
        req.timezone
      );
      res.json({
        status: "success",
        data: newCharges,
      });
    } catch (error) {
      error.reference = error.reference
        ? error.reference
        : "POST /charges/bulk";
      next(error);
    }
  }
);

//get charge types
router.get("/types", async (req, res, next) => {
  try {
    const chargeTypes = await chargeController.getChargeTypes(req.language);
    res.json({
      status: "success",
      data: chargeTypes,
    });
  } catch (error) {
    error.reference = error.reference ? error.reference : "GET /charges/types";
    next(error);
  }
});

//list all cards of a user
router.get("/my-cards", authToken(), async (req, res, next) => {
  try {
    const cards = await paymentController.getPaymentMethodList({
      userId: req.currentUser.id,
    });
    res.json({
      status: "success",
      data: cards,
    });
  } catch (error) {
    error.reference = error.reference
      ? error.reference
      : "GET /charges/my-cards";
    next(error);
  }
});

//get specific charge details
router.get("/:chargeId", authToken(), async (req, res, next) => {
  try {
    const chargeDetails = await chargeController.getChargeDetail(
      {
        id: req.params.chargeId,
      },
      req.language
    );
    res.json({
      status: "success",
      data: chargeDetails,
    });
  } catch (error) {
    error.reference = error.reference
      ? error.reference
      : "GET /charges/chargeId";
    next(error);
  }
});

//add new card
router.post("/save-card", authToken(), async (req, res, next) => {
  try {
    const newCard = await paymentController.addPaymentMethod({
      ...req.body,
      email: req.currentUser.email,
      name: req.currentUser.name,
      userId: req.currentUser.id,
      phone: req.currentUser.mobileNumber,
    });
    res.json({
      status: "success",
      data: newCard,
    });
  } catch (error) {
    error.reference = error.reference
      ? error.reference
      : "POST /charges/save-card";
    next(error);
  }
});

//delete saved card
router.post("/remove-card", authToken(), async (req, res, next) => {
  try {
    const result = await paymentController.removeCard(req.body);
    res.json({
      status: "success",
      data: result,
    });
  } catch (error) {
    error.reference = error.reference
      ? error.reference
      : "POST /charges/remove-card";
    next(error);
  }
});

//create payment-intent
router.post("/payment-intent", authToken(), async (req, res, next) => {
  try {
    const intent = await paymentController.createIntent({
      ...req.body,
      userId: req.currentUser.id,
      name: req.currentUser.name,
      email: req.currentUser.email,
      phone: req.currentUser.mobileNumber,
      flatId: req.currentUser.flatId,
    });
    res.json({
      status: "success",
      data: intent,
    });
  } catch (error) {
    error.reference = error.reference
      ? error.reference
      : "POST /charges/payment-intent";
    next(error);
  }
});

router.post("/stripe/webhook", async (req, res) => {
  const sig = req.headers["stripe-signature"];

  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.rawBody,
      sig,
      stripeConfig.WEBHOOK_SECRET
    );

    const paymentIntent = event.data.object;

    // Handle the event
    switch (event.type) {
      case "payment_intent.payment_failed":
        logger.warn(
          `Payment failed for Payment Intent Id: ${paymentIntent.id}`
        );
        await paymentController.updatePaymentStatus(
          { stripePaymentIntentId: paymentIntent.id },
          { payStatus: PAYMENT_STATUSES.FAILED.key }
        );
        break;
      case "payment_intent.succeeded":
        logger.info(
          `Payment captured for Payment Intent Id: ${paymentIntent.id}`
        );
        await paymentController.updatePaymentStatus(
          { stripePaymentIntentId: paymentIntent.id },
          { payStatus: PAYMENT_STATUSES.COMPLETED.key }
        );
        break;
      case "payment_intent.processing":
        logger.info(
          `Payment captured for Payment Intent Id: ${paymentIntent.id}`
        );
        await paymentController.updatePaymentStatus(
          { stripePaymentIntentId: paymentIntent.id },
          { payStatus: PAYMENT_STATUSES.PENDING.key }
        );
        break;
      // ... handle other event types
      default:
        logger.warn(`Unhandled event type ${event.type}`);
    }

    // Return a 200 res to acknowledge receipt of the event
    res.json();

    return;
  } catch (err) {
    logger.warn(`Webhook Error: ${err.message}`);
    res.status(400).json({ error: `Webhook Error: ${err.message}` });
    return;
  }
});

module.exports = router;
