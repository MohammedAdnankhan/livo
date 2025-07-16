const router = require("express").Router();
const { USER_TYPES, ADMIN_ROLES } = require("../../config/constants");
const { authToken } = require("../../utils/middlewares/authTokenMiddleware");
const {
  restrictAdmin,
} = require("../../utils/middlewares/restrictMiddlewares");
const { sanitisePayload } = require("../../utils/utility");
const imageController = require("../controllers/image");

//get images
router.get(
  "/",
  authToken(Object.values(USER_TYPES)),
  async (req, res, next) => {
    try {
      const images = await imageController.getImages({
        ...sanitisePayload(req.query),
      });
      res.json({
        status: "success",
        data: images,
      });
    } catch (error) {
      error.reference = error.reference ? error.reference : "GET /images";
      next(error);
    }
  }
);

//get image categories
router.get(
  "/categories",
  authToken(Object.values(USER_TYPES)),
  async (req, res, next) => {
    try {
      const categories = await imageController.getCategories();
      res.json({
        status: "success",
        data: categories,
      });
    } catch (error) {
      error.reference = error.reference
        ? error.reference
        : "GET /images/categories";
      next(error);
    }
  }
);

//get image
router.get(
  "/:imageId",
  authToken(Object.values(USER_TYPES)),
  async (req, res, next) => {
    try {
      const image = await imageController.getImage({
        id: req.params.imageId,
      });
      res.json({
        status: "success",
        data: image,
      });
    } catch (error) {
      error.reference = error.reference
        ? error.reference
        : "GET /images/:imageId";
      next(error);
    }
  }
);

//create image
router.post(
  "/",
  authToken(USER_TYPES.ADMIN),
  restrictAdmin(ADMIN_ROLES.MASTER_ADMIN),
  async (req, res, next) => {
    try {
      const image = await imageController.createImage({
        ...req.body,
      });
      res.json({
        status: "success",
        data: image,
      });
    } catch (error) {
      error.reference = error.reference ? error.reference : "POST /images";
      next(error);
    }
  }
);

//create multiple image
router.post(
  "/multiple",
  authToken(USER_TYPES.ADMIN),
  restrictAdmin(ADMIN_ROLES.MASTER_ADMIN),
  async (req, res, next) => {
    try {
      const image = await imageController.createImages(req.body);
      res.json({
        status: "success",
        data: image,
      });
    } catch (error) {
      error.reference = error.reference ? error.reference : "POST /images";
      next(error);
    }
  }
);

//edit image
router.patch(
  "/:imageId",
  authToken(USER_TYPES.ADMIN),
  restrictAdmin(ADMIN_ROLES.MASTER_ADMIN),
  async (req, res, next) => {
    try {
      const image = await imageController.editImage(
        {
          ...req.body,
        },
        req.params.imageId
      );
      res.json({
        status: "success",
        data: image,
      });
    } catch (error) {
      error.reference = error.reference
        ? error.reference
        : "PATCH /images/:imageId";
      next(error);
    }
  }
);

//delete image
router.delete(
  "/:imageId",
  authToken(USER_TYPES.ADMIN),
  restrictAdmin(ADMIN_ROLES.MASTER_ADMIN),
  async (req, res, next) => {
    try {
      const image = await imageController.deleteImage({
        id: req.params.imageId,
      });
      res.json({
        status: "success",
        data: image,
      });
    } catch (error) {
      error.reference = error.reference
        ? error.reference
        : "DELETE /images/:imageId";
      next(error);
    }
  }
);

//delete category with images
router.delete(
  "/category/:category",
  authToken(USER_TYPES.ADMIN),
  restrictAdmin(ADMIN_ROLES.MASTER_ADMIN),
  async (req, res, next) => {
    try {
      const resp = await imageController.deleteCategory({
        category: req.params.category,
      });
      res.json({
        status: "success",
        data: resp,
      });
    } catch (error) {
      error.reference = error.reference
        ? error.reference
        : "DELETE /images/category/:category";
      next(error);
    }
  }
);

module.exports = router;
