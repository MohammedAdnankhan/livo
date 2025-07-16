const bcrypt = require("bcryptjs");
const { Op } = require("sequelize");
const { USER_TYPES } = require("../../config/constants");
const { AppError } = require("../../utils/errorHandler");
const {
  generateRefreshToken,
  generateAccessToken,
} = require("../../utils/generateToken");
const Administrator = require("../models/Admin");
const { createTokenEntity } = require("../../token-service/controllers/token");
const {
  getSideBarData,
} = require("../../property-service/controllers/property");
const Tenant = require('../../Tenant-services/models/tenant');
//login admin
const loginAdmin = async (data) => {

  let username = data.username ? data.username : null;

  if (!data.password)
    throw new AppError("loginAdmin", "Enter Password", "custom", 412, [
      {
        column: "password",
        message: "Enter Password",
      },
    ]);
//  let findAdmin
  let findAdmin = await Administrator.scope(null).findOne({
    where: {
      [Op.or]: [{ email: username }, { mobileNumber: username }],
    },
  });

  const checkPassword = await bcrypt.compare(data.password, findAdmin.password);
  if (!checkPassword) {
    throw new AppError("loginAdmin", "Incorrect password", "custom", 400, [
      {
        column: "password",
        message: "Incorrect password",
      },
    ]);
  }

  


  

let sidebarData=[
  "My Properties",
  "Services",
  "Lease Management",
  "Visitor Management",
  "Guard Management",
  "Notices",
  "Helpline",
  "Configuration",
  "Dashboard",
  "Invoice Management"
]
  const [refreshToken, accessToken, 
  // sidebarData
  ] = await Promise.all([
    generateRefreshToken(findAdmin.id, USER_TYPES.ADMIN),
    generateAccessToken(findAdmin.id, USER_TYPES.ADMIN),
    // getSideBarData(findAdmin.propertyId),
  ]);
  await createTokenEntity({ token: refreshToken, adminId: findAdmin.id });

  const adminType = Buffer.from(findAdmin.role).toString("base64");
  return { accessToken, refreshToken, a_t: adminType, sidebarData};
};

//change password
const changeAdminPassword = async (data) => {
  if (!data.currentPassword || !data.newPassword) {
    throw new AppError(
      "changeAdminPassword",
      "Current Password and New Password are required",
      "custom",
      412
    );
  }
  const admin = await Administrator.scope(null).findByPk(data.id);
  if (!(await bcrypt.compare(data.currentPassword, admin.password))) {
    throw new AppError(
      "changeAdminPassword",
      "Incorrect password",
      "custom",
      412,
      [
        {
          column: "password",
          message: "Incorrect password",
        },
      ]
    );
  }
  if (
    data.newPassword.length <= 5 ||
    data.newPassword == data.currentPassword
  ) {
    throw new AppError(
      "changeAdminPassword",
      "Enter valid password",
      "custom",
      412,
      [
        {
          column: "password",
          message: "Enter valid password",
        },
      ]
    );
  }
  admin.password = await bcrypt.hash(data.newPassword, 10);
  await admin.save();

  return;
};

module.exports = { loginAdmin, changeAdminPassword };
