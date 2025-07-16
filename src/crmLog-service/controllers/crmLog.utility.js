const aws = require("aws-sdk");
const env = process.env.NODE_ENV || "development";
const awsConfig = require("../../config/aws.json")[env];

/**
 * @async
 * @param {string} s3url
 * @returns {Promise<string>}
 * @description Function to get Base 64 encoded image from S3 URL
 */
module.exports.getBase64ImageFromS3Object = async (s3url) => {
  try {
    const parsedURL = new URL(s3url);
    const s3 = new aws.S3({
      region: awsConfig["region"],
      accessKeyId: awsConfig["accessKeyId"],
      secretAccessKey: awsConfig["secretAccessKey"],
    });
    const data = await s3
      .getObject({
        Bucket: awsConfig["bucket"],
        Key: decodeURIComponent(parsedURL.pathname.slice(1)),
      })
      .promise();
    return data.Body.toString("base64");
  } catch (error) {
    throw error;
  }
};
