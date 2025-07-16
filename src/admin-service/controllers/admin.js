const bcrypt = require("bcryptjs");
const { getBuildings } = require("../../building-service/controllers/building");
const db = require("../../database");
const { AppError } = require("../../utils/errorHandler");
const Administrator = require("../models/Admin");

//create new admin
const createAdmin = async (data) => {

  if (!data.name || !data.email || !data.mobileNumber) {
    throw new AppError("createAdmin", "All fields are required");
  }
  // if (!data.propertyId) {
  //   throw new AppError("createAdmin", "Invalid Body", "custom", 200, [
  //     {
  //       column: "propertyId",
  //       message: "Please select a property",
  //     },
  //   ]);
  // }

  if (!data.password || data.password.length < 6) {
    throw new AppError("createAdmin", "Invalid Body", "custom", 200, [
      {
        column: "password",
        message: "Enter valid password",
      },
    ]);
  }

  data.password = await bcrypt.hash(data.password, 10);
  const newAdmin = await Administrator.create(data);
  newAdmin.password = undefined;
  return newAdmin;
};

//update admin details
const updateAdmin = async (params, data) => {
  const admin = await Administrator.findOne({ where: params });
  if (!admin) {
    throw new AppError("updateAdmin", "Admin not found");
  }
  delete data.id;
  delete data.role;
  for (const key in data) {
    admin[key] = data[key];
  }
  await admin.save();
  return admin;
};

async function getAdmin(params) {
  return await Administrator.findOne({ where: params });
}

async function getAdminForFlat(flatId) {
  const query = `
  select a.id, a.name, a.email, a."mobileNumber" from administrators a
  join properties p on p.id = a."propertyId" AND (p."deletedAt" is null) 
  join buildings b on b."propertyId" = p.id AND (b."deletedAt" is null)
  join flats f on f."buildingId" = b.id AND (f."deletedAt" is null AND f.id = :flatId)
  where a."deletedAt" is null
  `;
  return (
    await db.sequelize.query(query, {
      raw: true,
      type: db.Sequelize.QueryTypes.SELECT,
      replacements: {
        flatId,
      },
    })
  )[0];
}

async function getAllAdminsForFlat(flatId) {
  // flatId = "00035980-1a41-11ee-9d20-716a8c9d54bb";
  const query = `
  select a.id, a.name, a.email, a."mobileNumber" from administrators a
  join properties p on p.id = a."propertyId" AND (p."deletedAt" is null)
  join buildings b on b."propertyId" = p.id AND (b."deletedAt" is null)
  join flats f on f."buildingId" = b.id AND (f."deletedAt" is null AND f.id = :flatId)
  where a."deletedAt" is null
  `;
  return await db.sequelize.query(query, {
    raw: true,
    type: db.Sequelize.QueryTypes.SELECT,
    replacements: {
      flatId,
    },
  });
}

//get admin details
const getDetails = async (params) => {
  const buildings = await getBuildings(params);
  return buildings;
};

module.exports = {
  createAdmin,
  updateAdmin,
  getDetails,
  getAdmin,
  getAdminForFlat,
  getAllAdminsForFlat,
};
