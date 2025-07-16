const User = require("../models/User");
const UserInformation = require("../models/UserInformation");
const { AppError } = require("../../utils/errorHandler");
const { Op } = require("sequelize");
const Flat = require("../../flat-service/models/Flat");
const db = require("../../database");
const { LANGUAGES } = require("../../config/constants");
const Building = require("../../building-service/models/Building");

const getUser = async (params = {}) => {
  const findUser = await User.findOne({ where: params });
  return findUser;
};

const updateUser = async (params, data) => {
  delete data.email;
  delete data.mobileNumber;
  delete data.password;
  delete data.role;
  const user = await User.findOne({
    where: params,
  });
  if (!user) {
    return null;
  }
  for (const key in data) {
    user[key] = data[key];
  }

  await user.save();
  user.password = undefined;
  return user;
};

//get other user profile info
const getProfileDetails = async (params, language = LANGUAGES.EN) => {
  const findUserInfo = await UserInformation.findOne({
    where: params,
  });

  let attributes = ["id", "name", "profilePicture", "about"],
    address;

  if (findUserInfo) {
    findUserInfo.isEmailPublic && attributes.push("email");
    findUserInfo.isMobileNumberPublic && attributes.push("mobileNumber");
    findUserInfo.isAddressPublic && attributes.push("flatId");
  }

  const userInfo = await User.findOne({
    where: { id: params.userId },
    attributes,
  });
  if (!userInfo) {
    throw new AppError("getProfileDetails", "User not found");
  }

  if (userInfo.flatId) {
    const flatLocation = (
      await db.sequelize.query(
        `select f.name_${language} as "flatName", f.floor, b.name_${language} as "buildingName", l.name_${language} as "localityName", c.name_${language} as "cityName" from flats f
        join buildings b on f."buildingId" = b.id
        join localities l on l.id = b."localityId"
        join cities c on c.id = l."cityId"
        where f.id = :id and f."deletedAt" is null`,
        {
          raw: true,
          type: db.Sequelize.QueryTypes.SELECT,
          replacements: {
            id: userInfo.flatId,
          },
        }
      )
    )[0];
    address = `Flat no.${flatLocation.floor ? " " + flatLocation.floor : ""} ${
      flatLocation.flatName
    }, ${flatLocation.buildingName}, ${flatLocation.localityName}, ${
      flatLocation.cityName
    }`;
  }
  return { userInfo, address };
};

//get users who requested flats
const requestedFlatUsers = async ({
  buildingId,
  propertyId,
  search = null,
}) => {
  const params = {
    flatId: null,
    requestedFlat: { [Op.ne]: null },
  };
  params["$flatRequested->building.propertyId$"] = propertyId;
  params["$flatRequested->building.id$"] = buildingId;

  if (search) {
    params[Op.or] = [
      { name: { [Op.iLike]: `%${search}%` } },
      { email: { [Op.iLike]: `%${search}%` } },
      { mobileNumber: { [Op.iLike]: `%${search}%` } },
      { role: { [Op.iLike]: `%${search}%` } },
      { "$flatRequested.name_en$": { [Op.iLike]: `%${search}%` } },
      { "$flatRequested->building.name_en$": { [Op.iLike]: `%${search}%` } },
    ];
  }

  return await User.findAndCountAll({
    where: params,
    attributes: [
      "id",
      "name",
      "email",
      "countryCode",
      "mobileNumber",
      "role",
      "requestedFlat",
      "createdAt",
    ],
    include: {
      model: Flat,
      as: "flatRequested",
      required: true,
      attributes: ["id", "name_en", "name_ar", "buildingId"],
      include: {
        model: Building,
        as: "building",
        required: true,
        attributes: ["id", "name_en", "name_ar"],
      },
    },
  });
};

const requestedFlatUsersInProperty = async ({ propertyId, search }) => {
  const params = {
    flatId: null,
    requestedFlat: { [Op.ne]: null },
    "$flatRequested->building.propertyId$": propertyId,
  };

  if (search) {
    params[Op.or] = [
      { name: { [Op.iLike]: `%${search}%` } },
      { email: { [Op.iLike]: `%${search}%` } },
      { mobileNumber: { [Op.iLike]: `%${search}%` } },
      { role: { [Op.iLike]: `%${search}%` } },
      { "$flatRequested.name_en$": { [Op.iLike]: `%${search}%` } },
      { "$flatRequested->building.name_en$": { [Op.iLike]: `%${search}%` } },
    ];
  }

  return await User.findAndCountAll({
    where: params,
    attributes: [
      "id",
      "name",
      "email",
      "countryCode",
      "mobileNumber",
      "role",
      "requestedFlat",
      "createdAt",
    ],
    include: [
      {
        model: Flat,
        as: "flatRequested",
        required: true,
        attributes: ["id", "name_en", "name_ar", "buildingId"],
        include: [
          {
            model: Building,
            as: "building",
            attributes: ["id", "name_en", "name_ar"],
            required: true,
          },
        ],
      },
    ],
  });
};

//add or update public info
const addOrUpdateDetails = async (params, data) => {
  const findInfo = await UserInformation.findOrCreate({
    where: params,
    defaults: {
      params,
      ...data,
    },
  });
  if (!findInfo[1]) {
    for (const key in data) {
      findInfo[0][key] = data[key];
    }
    await findInfo[0].save();
  }
  return findInfo[0];
};

async function getUsers(params) {
  return User.findAll({
    where: params,
  });
}

async function deleteUser(params, transaction) {
  const user = await User.findOne({
    where: params,
  });
  if (user) {
    await Promise.all([
      UserInformation.destroy({ where: { userId: user.id }, transaction }),
      user.destroy({ transaction }),
    ]);
  }
  return null;
}

async function getUserWithInfo(userId) {
  return (
    await db.sequelize.query(
      `
  select u.id, u.name, u.email, u.language, ui."notificationEnabled" from users u
  left join user_informations ui on (ui."userId" = u.id and ui."deletedAt" is null)
  where u.id = :userId and u."deletedAt" is null`,
      {
        raw: true,
        type: db.Sequelize.QueryTypes.SELECT,
        replacements: {
          userId,
        },
      }
    )
  )[0];
}

async function updateNotificationPreference(data) {
  const reference = "updateNotificationPreference";
  const userId = data.userId;
  delete data.userId;
  const userInfo = await UserInformation.findOne({
    where: { userId },
    attributes: ["id", "userId", "notificationEnabled"],
  });

  if (!userInfo) {
    throw new AppError(reference, "User information not found");
  }
  for (const key in data) {
    userInfo.notificationEnabled[key] = data[key];
  }
  userInfo.changed("notificationEnabled", true);
  await userInfo.save();
  return;
}

async function getUserInformation(params) {
  return await UserInformation.findOne({
    where: params,
  });
}

async function getUsersCount({ startDate, endDate, propertyId, buildingId }) {
  const query = ` 
  select 
  COUNT (*)::INTEGER
  from master_users mu
  left join (
    select distinct on("masterUserId") id, "masterUserId", "flatId"
    from leases
    where "deletedAt" is null
    order by "masterUserId", "createdAt" desc
  ) l on l."masterUserId" = mu.id
  left join flats f on (f.id = l."flatId" and f."deletedAt" is null)
  left join buildings b on (b.id = f."buildingId" and b."deletedAt" is null ${
    buildingId ? `b.id = '${buildingId}'` : ""
  })
  where mu."deletedAt" is null ${
    propertyId ? `and mu."propertyId" = '${propertyId}'` : ""
  } AND mu."isCompany" IS FALSE ${
    startDate && endDate
      ? `and mu."createdAt"  between :startDate and :endDate`
      : ""
  }`;
  return await db.sequelize.query(query, {
    raw: true,
    type: db.Sequelize.QueryTypes.SELECT,
    replacements: {
      startDate,
      endDate,
      propertyId,
      buildingId,
    },
  });
}

const getLoginRequestCount = async (params) => {
  const [loginRequests] = await Promise.all([
    User.count({
      where: params,
      include: [
        {
          model: Flat,
          as: "flatRequested",
          required: true,
          attributes: [],
          include: [
            {
              model: Building,
              as: "building",
              attributes: [],
              required: true,
            },
          ],
        },
      ],
    }),
  ]);
  return loginRequests;
};

const createUserAfterLeaseApproval = async (data, transaction = null) => {
  const user = await User.create(data, { transaction });
  await UserInformation.create({ userId: user.id }, { transaction });
};

module.exports = {
  getUser,
  updateUser,
  getProfileDetails,
  addOrUpdateDetails,
  getUsers,
  deleteUser,
  requestedFlatUsers,
  requestedFlatUsersInProperty,
  getUserWithInfo,
  getUsersCount,
  updateNotificationPreference,
  getUserInformation,
  getLoginRequestCount,
  createUserAfterLeaseApproval,
};
