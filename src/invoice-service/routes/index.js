const { Router } = require("express");
const { authToken } = require("../../utils/middlewares/authTokenMiddleware");
const {
  ADMIN_ROLES,
  USER_TYPES,
  APP_FEATURES,
} = require("../../config/constants");
const {
  restrictAdmin,
} = require("../../utils/middlewares/restrictMiddlewares");
const invoiceController = require("../controllers/invoice");
const { sendResponse } = require("../../utils/responseHandler");
const { validatePayload } = require("../../utils/middlewares/requestValidator");
const {
  addInvoiceSchema,
  getInvoicesSchema,
  getInvoiceDetailsSchema,
  updateInvoiceSchema,
} = require("../validators");
const { pagination } = require("../../utils/middlewares/paginationMiddleware");
const { checkFeature } = require("../../utils/middlewares/checkFeature");

const invoiceRoutes = Router();

invoiceRoutes
  .route("/add")
  .post(
    authToken([USER_TYPES.ADMIN]),
    restrictAdmin([ADMIN_ROLES.ADMIN]),
    checkFeature(APP_FEATURES.INVOICE),
    validatePayload({ body: addInvoiceSchema }),
    async (req, res, next) => {
      try {
        await invoiceController.generateInvoice({
          ...req.validatedBody,
          propertyId: req.currentAdmin.propertyId,
        });
        sendResponse(res, null, "Invoice added successfully");
      } catch (error) {
        error.reference = error.reference
          ? error.reference
          : "POST /invoices/add";
        next(error);
      }
    }
  );

invoiceRoutes
  .route("/list")
  .get(
    authToken([USER_TYPES.ADMIN]),
    restrictAdmin([ADMIN_ROLES.ADMIN]),
    checkFeature(APP_FEATURES.INVOICE),
    pagination,
    validatePayload({ query: getInvoicesSchema }),
    async (req, res, next) => {
      try {
        const invoices = await invoiceController.getInvoices(
          {
            ...req.validatedQuery,
            propertyId: req.currentAdmin.propertyId,
          },
          req.paginate
        );
        sendResponse(res, invoices, "Invoices fetched successfully");
      } catch (error) {
        error.reference = error.reference
          ? error.reference
          : "GET /invoices/list";
        next(error);
      }
    }
  );

invoiceRoutes
  .route("/details/:invoiceId")
  .get(
    authToken([USER_TYPES.ADMIN]),
    restrictAdmin([ADMIN_ROLES.ADMIN]),
    checkFeature(APP_FEATURES.INVOICE),
    validatePayload({ params: getInvoiceDetailsSchema }),
    async (req, res, next) => {
      try {
        const invoice = await invoiceController.getInvoiceDetails({
          ...req.validatedParams,
          propertyId: req.currentAdmin.propertyId,
        });
        sendResponse(res, invoice, "Invoice details retrieved successfully");
      } catch (error) {
        error.reference = error.reference
          ? error.reference
          : "GET /invoices/details/:invoiceId";
        next(error);
      }
    }
  );
invoiceRoutes.route("/:invoiceId").patch(
  authToken([USER_TYPES.ADMIN]),
  checkFeature(APP_FEATURES.INVOICE),
  restrictAdmin([ADMIN_ROLES.ADMIN]),
  validatePayload({
    body: updateInvoiceSchema,
    params: getInvoiceDetailsSchema,
  }),
  async (req, res, next) => {
    try {
      await invoiceController.updateInvoice({
        ...req.validatedBody,
        invoiceId: req.params.invoiceId,
        propertyId: req.currentAdmin.propertyId,
      });
      sendResponse(res, null, "Invoice updated successfully");
    } catch (error) {
      error.reference = error.reference
        ? error.reference
        : "PATCH /invoices/:invoiceId";
      next(error);
    }
  }
);

module.exports = invoiceRoutes;
