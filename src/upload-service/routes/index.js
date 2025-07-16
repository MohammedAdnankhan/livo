const router = require("express").Router();
const { USER_TYPES } = require("../../config/constants");
const { authToken } = require("../../utils/middlewares/authTokenMiddleware");
const { AppError } = require("../../utils/errorHandler");
const uploadController = require("../controllers/s3Upload");

//upload to S3
router.post(
  "/upload-file",
  authToken([
    USER_TYPES.ADMIN,
    USER_TYPES.GUARD,
    USER_TYPES.USER,
    USER_TYPES.OWNER,
  ]),
  uploadController.s3Upload.array("file"),
  async (req, res, next) => {
    try {
      if (!req.files || req.files.length == 0) {
        throw new AppError("", "Invalid Body", "custom", 200, [
          {
            column: "file",
            message: "No files selected",
          },
        ]);
      }

      const uploads = await uploadController.uploadFiles(req.files);
      return res.status(200).json({
        status: "success",
        data: uploads,
      });
    } catch (error) {
      error.reference = error.reference ? error.reference : "POST files/upload";
      next(error);
    }
  }
);

router.post(
  "/delete-file",
  authToken([USER_TYPES.ADMIN, USER_TYPES.GUARD, USER_TYPES.USER]),
  async (req, res, next) => {
    try {
      await uploadController.deleteFile({ url: req.body.url });
      return res.status(200).json({
        status: "success",
        msg: "File deleted successfully",
        data: null,
      });
    } catch (error) {
      error.reference = error.reference
        ? error.reference
        : "POST files/delete-file";
      next(error);
    }
  }
);

module.exports = router;
