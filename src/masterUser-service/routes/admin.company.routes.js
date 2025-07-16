const { Router } = require("express");
const muCompanyController = require("../controllers/companyUser");
const muController = require("../controllers/masterUser");
const { sendResponse } = require("../../utils/responseHandler");
const { validatePayload } = require("../../utils/middlewares/requestValidator");
const {
  getCompanyByCompanyIdSchema,
  updateCompanySchema,
  getCompaniesSchema,
  createCompanySchema,
} = require("../validators");
const { pagination } = require("../../utils/middlewares/paginationMiddleware");

const muAdminCompanyRoutes = Router();

muAdminCompanyRoutes
  .route("/")
  .post(
    validatePayload({ body: createCompanySchema }),
    async (req, res, next) => {
      try {
        const payload = {
          ...req.validatedBody,
          propertyId: req.currentAdmin.propertyId,
        };
        await muController.createMasterUserV2(payload);
        sendResponse(res, null, "Company created successfully");
      } catch (error) {
        error.reference = error.reference
          ? error.reference
          : "POST /master-users/admin/companies";
        next(error);
      }
    }
  )
  .get(
    pagination,
    validatePayload({ query: getCompaniesSchema }),
    async (req, res, next) => {
      try {
        const companies = await muCompanyController.getCompanies(
          { ...req.validatedQuery, propertyId: req.currentAdmin.propertyId },
          req.paginate
        );

        sendResponse(res, companies, "Companies retrieved successfully");
      } catch (error) {
        error.reference = error.reference
          ? error.reference
          : "GET /master-users/admin/companies";
        next(error);
      }
    }
  );

muAdminCompanyRoutes.route("/list").get(async (req, res, next) => {
  try {
    const companies = await muCompanyController.getCompaniesDropDown(
      req.currentAdmin.propertyId
    );

    sendResponse(res, companies, "Companies retrieved successfully");
  } catch (error) {
    error.reference = error.reference
      ? error.reference
      : "GET /master-users/admin/companies/list";
    next(error);
  }
});

muAdminCompanyRoutes
  .route("/export")
  .get(
    pagination,
    validatePayload({ query: getCompaniesSchema }),
    async (req, res, next) => {
      try {
        const companies = await muCompanyController.getCompaniesExport(
          { ...req.validatedQuery, propertyId: req.currentAdmin.propertyId },
          req.paginate
        );

        sendResponse(res, companies, "Companies retrieved successfully");
      } catch (error) {
        error.reference = error.reference
          ? error.reference
          : "GET /master-users/admin/companies/export";
        next(error);
      }
    }
  );

muAdminCompanyRoutes
  .route("/:companyId")
  .get(
    validatePayload({ params: getCompanyByCompanyIdSchema }),
    async (req, res, next) => {
      try {
        const company = await muCompanyController.getCompanyById({
          companyId: req.validatedParams.companyId,
          propertyId: req.currentAdmin.propertyId,
        });

        sendResponse(res, company, "Company retrieved successfully");
      } catch (error) {
        error.reference = error.reference
          ? error.reference
          : "GET /master-users/admin/companies/:companyId";
        next(error);
      }
    }
  )
  .patch(
    validatePayload({
      params: getCompanyByCompanyIdSchema,
      body: updateCompanySchema,
    }),
    async (req, res, next) => {
      try {
        const params = {
          companyId: req.validatedParams.companyId,
          propertyId: req.currentAdmin.propertyId,
        };
        await muCompanyController.updateCompany(params, req.validatedBody);
        sendResponse(res, null, "Company updated successfully");
      } catch (error) {
        error.reference = error.reference
          ? error.reference
          : "PATCH /master-users/admin/companies/:companyId";
        next(error);
      }
    }
  )
  .delete(
    validatePayload({ params: getCompanyByCompanyIdSchema }),
    async (req, res, next) => {
      try {
        await muCompanyController.deleteCompanyById({
          companyId: req.validatedParams.companyId,
          propertyId: req.currentAdmin.propertyId,
        });
        sendResponse(res, null, "Company deleted successfully");
      } catch (error) {
        error.reference = error.reference
          ? error.reference
          : "DELETE /master-users/admin/companies/:companyId";
        next(error);
      }
    }
  );

module.exports = muAdminCompanyRoutes;
