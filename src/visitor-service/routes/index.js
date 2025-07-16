const express = require("express");
const visitorTypeController = require("./../controllers/visitorType");
const visitorController = require("../controllers/visitor");
const { AppError } = require("../../utils/errorHandler");
const { authToken } = require("../../utils/middlewares/authTokenMiddleware");
const { validatePayload } = require("../../utils/middlewares/requestValidator");
const { sendResponse } = require("../../utils/responseHandler");
const {
  USER_TYPES,
  ADMIN_ROLES,
  APP_FEATURES,
} = require("../../config/constants");
const {
  restrictAdmin,
} = require("../../utils/middlewares/restrictMiddlewares");
const { checkFeature } = require("../../utils/middlewares/checkFeature");
const { Op } = require("sequelize");
const {
  getVisitorTypeByVisitorIdSchema,
  getVisitorTypeListing,
  addVisitorTypeSchema,
  addVisitorCompanySchema,
  updateVisitorCompanySchema,
  toggleVisitorCompanySchema,
} = require("../validators");
const {
  getPropertyFromFlat,
} = require("../../property-service/controllers/property");
const { pagination } = require("../../utils/middlewares/paginationMiddleware");
const router = express.Router();

router.get("/types", async (req, res, next) => {
  try {
    const visitorTypes = await visitorTypeController.getVisitorTypes(req.query);
    res.json({
      status: "success",
      data: visitorTypes,
    });
  } catch (error) {
    error.reference = error.reference ? error.reference : "GET /visitors/types";
    next(error);
  }
});

router.post(
  "/types",
  authToken(USER_TYPES.ADMIN),
  restrictAdmin(ADMIN_ROLES.MASTER_ADMIN),
  async (req, res, next) => {
    try {
      const visitorType = await visitorTypeController.addVisitorType(req.body);
      res.json({
        status: "success",
        data: visitorType,
      });
    } catch (error) {
      error.reference = error.reference
        ? error.reference
        : "POST /visitors/types";
      next(error);
    }
  }
);

router.post(
  "/types/new",
  authToken(USER_TYPES.ADMIN),
  restrictAdmin(ADMIN_ROLES.MASTER_ADMIN),
  validatePayload({ body: addVisitorTypeSchema }),
  async (req, res, next) => {
    try {
      const visitorType = await visitorTypeController.addVisitorTypeNew(
        req.validatedBody
      );
      sendResponse(res, visitorType, "category added successfully");
    } catch (error) {
      error.reference = error.reference
        ? error.reference
        : "POST /visitors/types/new";
      next(error);
    }
  }
);

router.post(
  "/types/new-company",
  authToken(USER_TYPES.ADMIN),
  restrictAdmin(ADMIN_ROLES.ADMIN),
  validatePayload({ body: addVisitorCompanySchema }),
  async (req, res, next) => {
    try {
      const visitorType = await visitorTypeController.addVisitorCompany({
        propertyId: req.currentAdmin.propertyId,
        ...req.validatedBody,
      });
      sendResponse(res, visitorType, "company added successfully");
    } catch (error) {
      error.reference = error.reference
        ? error.reference
        : "POST /visitors/types/new-company";
      next(error);
    }
  }
);

router.get(
  "/types/all-companies",
  authToken(USER_TYPES.ADMIN),
  restrictAdmin(ADMIN_ROLES.ADMIN),
  pagination,
  async (req, res, next) => {
    try {
      const visitorTypes = await visitorTypeController.getAllVisitorCompanies({
        propertyId: req.currentAdmin.propertyId,
        search: req.query?.search,
        ...req.paginate,
      });
      sendResponse(res, visitorTypes, "companies retrieved successfully");
    } catch (error) {
      error.reference = error.reference
        ? error.reference
        : "GET /visitors/types/all-companies";
      next(error);
    }
  }
);

router.patch(
  "/types/update-company",
  authToken(USER_TYPES.ADMIN),
  restrictAdmin(ADMIN_ROLES.ADMIN),
  validatePayload({ body: updateVisitorCompanySchema }),
  async (req, res, next) => {
    try {
      const visitorTypes = await visitorTypeController.updateVisitorCompany({
        propertyId: req.currentAdmin.propertyId,
        ...req.validatedBody,
      });
      sendResponse(res, visitorTypes, "company updated successfully");
    } catch (error) {
      error.reference = error.reference
        ? error.reference
        : "PATCH /visitors/types/update-company";
      next(error);
    }
  }
);

router.patch(
  "/types/company/change-visibility",
  authToken(USER_TYPES.ADMIN),
  restrictAdmin(ADMIN_ROLES.ADMIN),
  validatePayload({ body: toggleVisitorCompanySchema }),
  async (req, res, next) => {
    try {
      const visitorMessage = await visitorTypeController.toggleVisitorCompany({
        propertyId: req.currentAdmin.propertyId,
        ...req.validatedBody,
      });
      sendResponse(res, null, visitorMessage);
    } catch (error) {
      error.reference = error.reference
        ? error.reference
        : "PATCH /visitors/types/company/change-visibility";
      next(error);
    }
  }
);
// router.post(
//   "/add-types",
//   authToken(USER_TYPES.ADMIN),
//   restrictAdmin(ADMIN_ROLES.ADMIN),
//   validatePayload({ body: addVisitorTypeSchema }),
//   async (req, res, next) => {
//     try {
//       const visitorType = await visitorTypeController.createVisitorType({
//         ...req.validatedBody,
//         propertyId: req.currentAdmin.propertyId,
//       });
//       sendResponse(res, visitorType);
//     } catch (error) {
//       error.reference = error.reference
//         ? error.reference
//         : "POST /visitors/add-types";
//       next(error);
//     }
//   }
// );

router.get(
  "/categories/all",
  authToken(USER_TYPES.ADMIN),
  restrictAdmin(ADMIN_ROLES.ADMIN),
  pagination,
  validatePayload({ query: getVisitorTypeListing }),
  async (req, res, next) => {
    try {
      const response = await visitorTypeController.getAllVisitorCategories(
        req.language,
        req.currentAdmin.propertyId,
        req.validatedQuery,
        req.paginate
      );

      // visitorTypeController.sortVisitorCategories(response);
      sendResponse(res, response);
    } catch (error) {
      error.reference = error.reference
        ? error.reference
        : "GET /visitors/categories/all";
      next(error);
    }
  }
);

router.patch(
  "/types/visibility/:visitorId",
  authToken(USER_TYPES.ADMIN),
  restrictAdmin(ADMIN_ROLES.ADMIN),
  validatePayload({
    params: getVisitorTypeByVisitorIdSchema,
  }),
  async (req, res, next) => {
    try {
      const visitorType =
        await visitorTypeController.updateVisitorTypeVisibility(
          req.validatedParams.visitorId,
          req.currentAdmin.propertyId
        );
      sendResponse(res, null, visitorType);
    } catch (error) {
      error.reference = error.reference
        ? error.reference
        : "PATCH /visitors/types/visibility/:visitorId";
      next(error);
    }
  }
);

router.get(
  "/dropdown/categories",
  authToken([USER_TYPES.USER, USER_TYPES.GUARD, USER_TYPES.ADMIN]),
  async (req, res, next) => {
    try {
      let response;
      if (req.currentUser) {
        const property = await getPropertyFromFlat(req.currentUser.flatId);
        response = await visitorTypeController.getVisitorCategoriesNew(
          req.language,
          property.id
        );
      } else if (req.currentGuard) {
        const propertyId = await req.currentGuard.propertyId;
        response = await visitorTypeController.getVisitorCategoriesNew(
          req.language,
          propertyId
        );
      } else {
        const role = USER_TYPES.ADMIN;
        response = await visitorTypeController.getVisitorCategoriesNew(
          req.language,
          req.currentAdmin.propertyId,
          role
        );
      }

      // visitorTypeController.sortVisitorCategories(response);
      sendResponse(res, response);
    } catch (error) {
      error.reference = error.reference
        ? error.reference
        : "GET /visitors/dropdown/categories";
      next(error);
    }
  }
);

router.get("/categories", async (req, res, next) => {
  try {
    const response = await visitorTypeController.getVisitorCategories(
      req.language
    );

    visitorTypeController.sortVisitorCategories(response);
    res.json({
      status: "success",
      data: response,
    });
  } catch (error) {
    error.reference = error.reference
      ? error.reference
      : "GET /visitors/categories";
    next(error);
  }
});

router.get("/companies", async (req, res, next) => {
  try {
    const companies = await visitorTypeController.getVisitorTypes({
      company_en: { [Op.ne]: null },
    });
    res.json({
      status: "success",
      data: companies,
    });
  } catch (error) {
    error.reference = error.reference
      ? error.reference
      : "GET /visitors/companies";
    next(error);
  }
});

router.get(
  "/companies-all",
  authToken([USER_TYPES.ADMIN, USER_TYPES.GUARD, USER_TYPES.USER]),
  async (req, res, next) => {
    try {
      let response;
      if (req.currentUser) {
        const property = await getPropertyFromFlat(req.currentUser.flatId);
        response = await visitorTypeController.getVisitorTypes({
          company_en: { [Op.ne]: null },
          propertyId: property.id,
          isVisible: true,
        });
      } else if (req.currentGuard) {
        const propertyId = await req.currentGuard.propertyId;
        response = await visitorTypeController.getVisitorTypes({
          company_en: { [Op.ne]: null },
          propertyId,
          isVisible: true,
        });
      } else {
        const propertyId = req.currentAdmin.propertyId;
        response = await visitorTypeController.getVisitorTypes({
          company_en: { [Op.ne]: null },
          propertyId,
        });
      }
      sendResponse(res, response);
    } catch (error) {
      error.reference = error.reference
        ? error.reference
        : "GET /visitors/companies-all";
      next(error);
    }
  }
);
//TODO: Have to deprecate this route
router.get("/categories/non-guest", async (req, res, next) => {
  try {
    const response = await visitorTypeController.getNonGuestCategories(
      req.language
    );

    res.json({
      status: "success",
      data: response,
    });
  } catch (error) {
    error.reference = error.reference
      ? error.reference
      : "GET /visitors/categories";
    next(error);
  }
});

router.get(
  "/non-guest/categories",
  authToken([USER_TYPES.USER, USER_TYPES.GUARD, USER_TYPES.ADMIN]),
  async (req, res, next) => {
    try {
      let response;
      if (req.currentUser) {
        const property = await getPropertyFromFlat(req.currentUser.flatId);
        response = await visitorTypeController.getNonGuestCategoriesNew(
          req.language,
          property.id
        );
      } else if (req.currentGuard) {
        const propertyId = await req.currentGuard.propertyId;
        response = await visitorTypeController.getNonGuestCategoriesNew(
          req.language,
          propertyId
        );
      } else {
        const role = USER_TYPES.ADMIN;
        response = await visitorTypeController.getNonGuestCategoriesNew(
          req.language,
          req.currentAdmin.propertyId,
          role
        );
      }
      sendResponse(res, response);
    } catch (error) {
      error.reference = error.reference
        ? error.reference
        : "GET /visitors/non-guest/categories";
      next(error);
    }
  }
);
//TODO: Have to deprecate this route
router.get(
  "/types/companies/:categoryId",
  authToken([USER_TYPES.GUARD, USER_TYPES.USER]),
  async (req, res, next) => {
    try {
      const response = await visitorTypeController.getVisitorCompanies(
        {
          propertyId: req.currentGuard
            ? req.currentGuard.propertyId
            : (
                await getPropertyFromFlat(req.currentUser.flatId)
              ).id,
          categoryId: req.params.categoryId,
        },
        req.language
      );
      res.json({
        status: "success",
        data: response,
      });
    } catch (error) {
      error.reference = error.reference
        ? error.reference
        : "GET /visitors/types/companies";
      next(error);
    }
  }
);

router.get(
  "/types/all-companies/:categoryId",
  authToken([USER_TYPES.USER, USER_TYPES.GUARD, USER_TYPES.ADMIN]),
  async (req, res, next) => {
    try {
      let response;
      if (req.currentUser) {
        const property = await getPropertyFromFlat(req.currentUser.flatId);
        response = await visitorTypeController.getVisitorCompaniesNew(
          {
            categoryId: req.params.categoryId,
            propertyId: property.id,
          },
          req.language
        );
      } else if (req.currentGuard) {
        const propertyId = await req.currentGuard.propertyId;
        response = await visitorTypeController.getVisitorCompaniesNew(
          {
            categoryId: req.params.categoryId,
            propertyId,
          },
          req.language
        );
      } else {
        response = await visitorTypeController.getVisitorCompaniesNew(
          {
            categoryId: req.params.categoryId,
            propertyId: req.currentAdmin.propertyId,
            role: USER_TYPES.ADMIN,
          },
          req.language
        );
      }
      sendResponse(res, response);
    } catch (error) {
      error.reference = error.reference
        ? error.reference
        : "GET /visitors/types/all-companies/:categoryId";
      next(error);
    }
  }
);

router.patch(
  "/update",
  authToken(USER_TYPES.GUARD), //TODO: guard building validation missing
  checkFeature(APP_FEATURES.VISITOR),
  async (req, res, next) => {
    try {
      if (!req.body.visitorId) {
        throw new AppError("", "Visitor ID not found");
      }
      const updatedVisitor = await visitorController.updateVisitor(
        { id: req.body.visitorId },
        req.body
      );
      res.json({
        status: "success",
        data: updatedVisitor,
      });
    } catch (error) {
      error.reference = error.reference
        ? error.reference
        : "PATCH /visitors/update";
      next(error);
    }
  }
);

//get companies by category name
router.get(
  "/daily-help/types",
  authToken([USER_TYPES.USER, USER_TYPES.GUARD, USER_TYPES.ADMIN]),
  async (req, res, next) => {
    try {
      let response;
      if (req.currentUser) {
        const property = await getPropertyFromFlat(req.currentUser.flatId);
        response = await visitorTypeController.getCompaniesForDailyHelp(
          req.language,
          property.id
        );
      } else if (req.currentGuard) {
        response = await visitorTypeController.getCompaniesForDailyHelp(
          req.language,
          req.currentGuard.propertyId
        );
      } else {
        response = await visitorTypeController.getVisitorCompaniesNew(
          req.language,
          req.currentAdmin.propertyId
        );
      }
      // visitorTypeController.sortDailyHelpTypes(response);
      res.json({
        status: "success",
        data: response,
      });
    } catch (error) {
      error.reference = error.reference
        ? error.reference
        : "GET /visitors/daily-help/types";
      next(error);
    }
  }
);

//get companies by category name
router.get(
  "/daily-help/types/new",
  authToken([USER_TYPES.ADMIN, USER_TYPES.GUARD, USER_TYPES.USER]),
  async (req, res, next) => {
    try {
      let response;
      if (req.currentUser) {
        const property = await getPropertyFromFlat(req.currentUser.flatId);
        response = await visitorTypeController.getCompaniesForDailyHelpNew(
          req.language,
          property.id
        );
      } else if (req.currentGuard) {
        const propertyId = await req.currentGuard.propertyId;
        response = await visitorTypeController.getCompaniesForDailyHelpNew(
          req.language,
          propertyId
        );
      } else {
        const role = USER_TYPES.ADMIN;
        const propertyId = await req.currentAdmin.propertyId;
        response = await visitorTypeController.getCompaniesForDailyHelpNew(
          req.language,
          propertyId,
          role
        );
      }

      visitorTypeController.sortDailyHelpTypes(response);
      sendResponse(res, response);
    } catch (error) {
      error.reference = error.reference
        ? error.reference
        : "GET /visitors/daily-help/types/new";
      next(error);
    }
  }
);

router.get(
  "/:mobileNumber",
  authToken(USER_TYPES.GUARD), //TODO: guard building validation missing
  checkFeature(APP_FEATURES.VISITOR),
  async (req, res, next) => {
    try {
      const response = await visitorController.getVisitorWithLastVisitedTime({
        mobileNumber: req.params.mobileNumber,
        propertyId: req.currentGuard.propertyId,
      });

      res.json({
        status: "success",
        data: response,
      });
    } catch (error) {
      error.reference = error.reference
        ? error.reference
        : "GET /visitors/:mobileNumber";
      next(error);
    }
  }
);

router.get("/documents/pixlab", async (req, res, next) => {
  try {
    const response = await visitorController.getpixlabDocumentTypes(
      req.language
    );

    res.json({
      status: "success",
      data: response,
    });
  } catch (error) {
    error.reference = error.reference
      ? error.reference
      : "GET /visitors/documents/pixlab";
    next(error);
  }
});

router.get("/countries/pixlab", async (req, res, next) => {
  try {
    const response = await visitorController.getpixlabCountries(req.language);

    res.json({
      status: "success",
      data: response,
    });
  } catch (error) {
    error.reference = error.reference
      ? error.reference
      : "GET /visitors/countries/pixlab";
    next(error);
  }
});

module.exports = router;
