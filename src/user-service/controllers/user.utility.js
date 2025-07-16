const { getAdmin } = require("../../admin-service/controllers/admin");
const { UAE_OFFSET } = require("../../config/constants");
const db = require("../../database");
const { getFlatWithBuilding } = require("../../flat-service/controllers/flat");
const {
  singUpInitiatedForUser,
  singUpInitiatedForAdmin,
  signupCompletedBypassForUser,
} = require("../../utils/email");
const moment = require("moment-timezone");

/**
 * @async
 * @function getFlatAndAdmins
 * @param {string} flatId
 * @returns {Promise<import("../types").IGetFlatAndAdminsResponse[]>}
 * @description Function to get flat admins
 */
async function getFlatAndAdmins(flatId) {
  const query = `
    SELECT f.name_en AS "flatName", b.name_en AS "buildingName", b."propertyId", a.name AS "adminName", a.email AS "adminEmail" FROM flats f
    JOIN buildings b ON (b.id = f."buildingId" AND b."deletedAt" IS NULL)
    JOIN administrators a ON (a."propertyId" = b."propertyId" AND a."deletedAt" IS NULL)
    WHERE f.id = :flatId AND f."deletedAt" IS NULL`;

  return await db.sequelize.query(query, {
    type: db.Sequelize.QueryTypes.SELECT,
    raw: true,
    replacements: {
      flatId,
    },
  });
}

/**
 * @async
 * @function sendSignUpInitiatedEmail
 * @param {object} user
 * @param {string} user.name
 * @param {string} user.email
 * @param {string} user.mobileNumber
 * @param {string} flatId
 * @param {Date} requestTime
 * @returns {Promise<null>}
 */
module.exports.sendSignUpInitiatedEmail = async (user, flatId, requestTime) => {
  const flatAdmins = await getFlatAndAdmins(flatId);

  const emailToUserObj = {
    buildingName: flatAdmins[0].buildingName,
    residentName: user.name,
    flatName: flatAdmins[0].flatName,
  };
  singUpInitiatedForUser(user.email, emailToUserObj);
  for (const admin of flatAdmins) {
    const emailToAdminObj = {
      adminName: admin.adminName,
      residentName: user.name,
      buildingName: admin.buildingName,
      flatName: admin.flatName,
      buildingAndFlatName: `${admin.flatName}, ${admin.buildingName}`,
      requestedTime: moment(requestTime).utcOffset(UAE_OFFSET).format("LLLL"),
      residentMobileNumber: user.mobileNumber,
      residentEmail: user.email,
      requestType: "Registration",
    };
    singUpInitiatedForAdmin(admin.adminEmail, emailToAdminObj);
  }
  return null;
};

/**
 * @async
 * @function sendSignUpEmailsToSobha
 * @param {object} user
 * @param {string} user.name
 * @param {string} user.email
 * @param {string} user.mobileNumber
 * @param {string} flatId
 * @param {Date} requestTime
 * @returns {Promise<null>}
 */
module.exports.sendSignUpEmailsToSobha = async (user, flatId, requestTime) => {
  const flatAdmins = await getFlatAndAdmins(flatId);

  const emailToUserObj = {
    buildingName: flatAdmins[0].buildingName,
    residentName: user.name,
  };

  signupCompletedBypassForUser(user.email, emailToUserObj);
  for (const admin of flatAdmins) {
    const emailToAdminObj = {
      adminName: admin.adminName,
      residentName: user.name,
      buildingName: admin.buildingName,
      flatName: admin.flatName,
      buildingAndFlatName: `${admin.flatName}, ${admin.buildingName}`,
      requestedTime: moment(requestTime).utcOffset(UAE_OFFSET).format("LLLL"),
      residentMobileNumber: user.mobileNumber,
      residentEmail: user.email,
      requestType: "Registration",
    };
    singUpInitiatedForAdmin(admin.adminEmail, emailToAdminObj);
  }
};
