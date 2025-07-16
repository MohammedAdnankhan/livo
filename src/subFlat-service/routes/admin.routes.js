const { Router } = require("express");
const { pagination } = require("../../utils/middlewares/paginationMiddleware");
const adminSubFlatController = require("../controllers/adminSubFlat");
const { validatePayload } = require("../../utils/middlewares/requestValidator");
const {
  getSubFlatsSchema,
  getSubFlatBySubFlatIdSchema,
  updateSubFlatSchema,
  createSubFlatsSchema,
  getSubFlatsForDropDownSchema,
} = require("../validators");
const { sendResponse } = require("../../utils/responseHandler");
const { formGroupOfIds } = require("../../flat-service/utils/flat.utility");
const adminSubFlatRoutes = Router();

adminSubFlatRoutes
  .route("/")
  .get(
    pagination,
    formGroupOfIds,
    validatePayload({ query: getSubFlatsSchema }),
    async (req, res, next) => {
      try {
        const { propertyId } = req.currentAdmin;
        const params = {
          ...req.validatedQuery,
          propertyId,
        };
        const subFlats = await adminSubFlatController.getSubFlatsForAdmin(
          params,
          req.paginate
        );
        sendResponse(res, subFlats, "Sub Units retrieved successfully");
      } catch (error) {
        error.reference = error.reference
          ? error.reference
          : "GET /sub-flats/admin/:flatId";
        next(error);
      }
    }
  )
  .post(
    validatePayload({
      body: createSubFlatsSchema,
    }),
    async (req, res, next) => {
      try {
        await adminSubFlatController.createSubFlats(
          req.validatedBody,
          req.currentAdmin.propertyId
        );
        sendResponse(res, null, "Sub Unit created successfully", 201);
      } catch (error) {
        error.reference = error.reference
          ? error.reference
          : "POST /sub-flats/admin/:flatId";
        next(error);
      }
    }
  );

adminSubFlatRoutes
  .route("/export")
  .get(
    pagination,
    formGroupOfIds,
    validatePayload({ query: getSubFlatsSchema }),
    async (req, res, next) => {
      try {
        const { propertyId } = req.currentAdmin;
        const params = {
          ...req.validatedQuery,
          propertyId,
        };
        const subFlats = await adminSubFlatController.getSubFlatsForAdminExport(
          params,
          req.paginate
        );
        sendResponse(res, subFlats, "Sub Units retrieved successfully");
      } catch (error) {
        error.reference = error.reference
          ? error.reference
          : "GET /sub-flats/admin/export";
        next(error);
      }
    }
  );

adminSubFlatRoutes
  .route("/all")
  .get(
    validatePayload({ query: getSubFlatsForDropDownSchema }),
    async (req, res, next) => {
      try {
        const subFlats = await adminSubFlatController.getSubFlatsForDropDown({
          ...req.validatedQuery,
          propertyId: req.currentAdmin.propertyId,
        });
        sendResponse(res, subFlats, "Sub-Units retrieved successfully");
      } catch (error) {
        error.reference = error.reference
          ? error.reference
          : "GET /sub-flats/admin/all";
        next(error);
      }
    }
  );

adminSubFlatRoutes
  .route("/vacant")
  .get(
    validatePayload({ query: getSubFlatsForDropDownSchema }),
    async (req, res, next) => {
      try {
        const subFlats = await adminSubFlatController.getVacantSubFlats({
          ...req.validatedQuery,
          propertyId: req.currentAdmin.propertyId,
        });
        sendResponse(res, subFlats, "Vacant Sub-Units retrieved successfully");
      } catch (error) {
        error.reference = error.reference
          ? error.reference
          : "GET /sub-flats/admin/vacant";
        next(error);
      }
    }
  );

adminSubFlatRoutes
  .route("/:subFlatId")
  .get(
    validatePayload({ params: getSubFlatBySubFlatIdSchema }),
    async (req, res, next) => {
      try {
        const params = {
          subFlatId: req.validatedParams.subFlatId,
          propertyId: req.currentAdmin.propertyId,
        };
        const subFlat = await adminSubFlatController.getSubFlatByIdForAdmin(
          params
        );
        sendResponse(res, subFlat, "Sub Flat retrieved successfully");
      } catch (error) {
        error.reference = error.reference
          ? error.reference
          : "GET /sub-flats/admin/:subFlatId";
        next(error);
      }
    }
  )
  .patch(
    validatePayload({
      params: getSubFlatBySubFlatIdSchema,
      body: updateSubFlatSchema,
    }),
    async (req, res, next) => {
      try {
        const params = {
          ...req.validatedBody,
          subFlatId: req.validatedParams.subFlatId,
          propertyId: req.currentAdmin.propertyId,
        };
        await adminSubFlatController.updateSubFlat(params);
        sendResponse(res, null, "Sub Unit updated successfully");
      } catch (error) {
        error.reference = error.reference
          ? error.reference
          : "PATCH /sub-flats/admin/:subFlatId";
        next(error);
      }
    }
  )
  .delete(
    validatePayload({ params: getSubFlatBySubFlatIdSchema }),
    async (req, res, next) => {
      try {
        const params = {
          subFlatId: req.validatedParams.subFlatId,
          propertyId: req.currentAdmin.propertyId,
        };
        await adminSubFlatController.deleteSubFlat(params);
        sendResponse(res, null, "Sub Unit deleted successfully");
      } catch (error) {
        error.reference = error.reference
          ? error.reference
          : "DELETE /sub-flats/admin/:subFlatId";
        next(error);
      }
    }
  );

module.exports = adminSubFlatRoutes;
