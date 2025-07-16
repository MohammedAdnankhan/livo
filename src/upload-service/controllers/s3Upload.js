const aws = require("aws-sdk");
const multer = require("multer");
const multerS3 = require("multer-s3-transform");
const sharp = require("sharp");
const { AppError } = require("../../utils/errorHandler");
const env = process.env.NODE_ENV || "development";
const awsConfig = require("../../config/aws.json")[env];

const accessKeyId = awsConfig.accessKeyId;
const secretAccessKey = awsConfig.secretAccessKey;
const region = awsConfig.region;

const s3 = new aws.S3({
  accessKeyId,
  secretAccessKey,
  region,
});

const s3Upload = multer({
  storage: multerS3({
    s3: s3,
    acl: "public-read",
    bucket: awsConfig.bucket,
    contentType: multerS3.AUTO_CONTENT_TYPE,
    shouldTransform: function (req, file, cb) {
      cb(null, /^(?!image\/svg\+xml)image/i.test(file.mimetype));
    },
    key: function (req, file, cb) {
      const extArray = file.originalname.split(".");
      const extension = extArray[extArray.length - 1];
      const fullName = extArray[0].split(" ");
      const finalName = fullName.join("-");
      cb(null, `${finalName}-${Date.now().toString()}.${extension}`);
    },
    transforms: [
      {
        id: "compressed",
        key: function (req, file, cb) {
          const extArray = file.originalname.split(".");
          const extension = extArray[extArray.length - 1];
          const fullName = extArray[0].split(" ");
          const finalName = fullName.join("-");
          cb(null, `${finalName}-${Date.now().toString()}.${extension}`);
        },
        transform: function (req, file, cb) {
          cb(
            null,
            sharp()
              .resize(1280, 720, {
                fit: sharp.fit.inside,
                withoutEnlargement: true,
              })
              .jpeg({ quality: 80 })
          );
        },
      },
    ],
  }),
  fileFilter: function (req, file, cb) {
    if (parseInt(req.headers["content-length"]) > 50 * 1024 * 1024) {
      return cb(
        new AppError("s3UploadMiddleware", "File size too large"),
        false
      );
    }
    cb(null, true);
  },
});

const uploadFiles = async (data) => {
  let uploadedFiles = [];
  if (data.length > 0) {
    uploadedFiles = data.map((file) => {
      if (file.transforms) {
        return {
          key: file.transforms[0].key,
          location: file.transforms[0].location,
          originalName: file.originalname,
          size: file.transforms[0].size,
          contentType: file.transforms[0].contentType,
        };
      } else {
        return {
          key: file.key,
          location: file.location,
          originalName: file.originalname,
          size: file.size,
          contentType: file.contentType,
        };
      }
    });
  }
  return uploadedFiles;
};

async function deleteFile({ url }) {
  const reference = "deleteFile";
  if (!url) {
    throw new AppError(reference, "Please enter URL", "custom", 412);
  }
  const parsedURL = new URL(url);
  const params = {
    Bucket: awsConfig.bucket,
    Key: decodeURIComponent(parsedURL.pathname.slice(1)),
  };
  await s3.deleteObject(params).promise();
  return null;
}

module.exports = { s3Upload, uploadFiles, deleteFile };
