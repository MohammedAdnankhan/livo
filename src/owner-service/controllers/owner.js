const { LANGUAGES } = require("../../config/constants");
const db = require("../../database");
const MasterUser = require("../../masterUser-service/models/MasterUser");
const { AppError } = require("../../utils/errorHandler");
const { isArrayEmpty } = require("../../utils/utility");
const Owner = require("../models/Owner");
const BankDetail = require("../../masterUser-service/models/BankDetail");

async function getOwner(params, scope = "defaultScope") {
  return await Owner.scope(scope).findOne({ where: params });
}

async function getBankDetails(masterUserId) {
  const bankDetails = await BankDetail.findOne({ where: { masterUserId } });
  return bankDetails;
}

async function createOwner(data, transaction = null) {
  return await Owner.create(data, { transaction });
}

//get owner info
const getMasterUserFromOwner = async (ownerId, language = LANGUAGES.EN) => {
  const reference = "getMasterUserFromOwner";

  const query = `
        select mu.id, mu.name, mu.email, mu."countryCode", mu."mobileNumber", mu."profilePicture",
        mu.documents, mu.nationality, mu."documentType", mu."documentId", mu."documentDetails",
        mu."alternateContact", mu.gender, mu."dateOfBirth",
        f.id as "flat.id", f.name_${language} as "flat.name", f."buildingId" as "flat.buildingId",
        b.id as "building.id", b.name_${language} as "building.name" from owners ow
        join master_users mu on (ow."mobileNumber" = mu."mobileNumber" and mu."deletedAt" is null)
        join flats f on (mu.id = f."ownerId" and f."deletedAt" is null)
        join buildings b on (b.id = f."buildingId" and b."deletedAt" is null)
        where ow.id= :ownerId and ow."deletedAt" is null`;

  const ownerDetails = await db.sequelize.query(query, {
    type: db.Sequelize.QueryTypes.SELECT,
    raw: true,
    nest: true,
    replacements: {
      ownerId,
    },
  });

  //Return null if no user found
  if (isArrayEmpty(ownerDetails)) {
    return null; // TODO: This scenario to be tested wherever this function si being utilized
  }

  const buildingsLookup = new Map(
    ownerDetails.map(({ building }) => [building.id, building])
  );

  const flatsLookup = new Map();

  ownerDetails.forEach(({ flat }) => {
    const { buildingId, ...flatObj } = flat;
    const flatLookUpData = flatsLookup.get(buildingId);
    if (flatLookUpData) {
      flatLookUpData.push(flatObj);
      flatsLookup.set(buildingId, flatLookUpData);
    } else {
      flatsLookup.set(buildingId, [flatObj]);
    }
  });

  const buildings = Array.from(buildingsLookup.values());

  buildings.forEach((building) => {
    building.flats = flatsLookup.get(building.id)
      ? flatsLookup.get(building.id)
      : [];
  });

  delete ownerDetails[0].flat;
  delete ownerDetails[0].building;
  return { ...ownerDetails[0], buildings };
};

const updateOwnerDetails = async (mobileNumber, data) => {
  const ownerData = await getOwner({ mobileNumber });
  if (!ownerData) {
    throw new AppError("updateOwnerDetails", "owner not found", "custom", 404);
  }
  const masterUser = await MasterUser.findOne({
    where: { mobileNumber },
    include: [
      {
        model: BankDetail,
        as: "bankDetails",
        required: true,
      },
    ],
  });

  if (data.email) {
    const user = await MasterUser.findOne({ where: { email: data.email } });
    if (user) {
      throw new AppError(
        "updateOwnerDetails",
        "Email already exists",
        "custom",
        412
      );
    }
  }
  if (data.bankDetails) {
    for (const key in data.bankDetails) {
      masterUser.bankDetails[key] = data.bankDetails[key];
    }

    await masterUser.bankDetails.save();
  }
  if (data.alternateCountryCode) {
    masterUser["alternateContact"]["countryCode"] = data.alternateCountryCode;
  }

  if (data.alternateEmail) {
    masterUser["alternateContact"]["email"] = data.alternateEmail;
  }

  if (data.alternateMobileNumber) {
    masterUser["alternateContact"]["mobileNumber"] = data.alternateMobileNumber;
  }

  if (
    data.alternateCountryCode ||
    data.alternateEmail ||
    data.alternateMobileNumber
  ) {
    masterUser.changed("alternateContact", true);
  }
  for (const key in data) {
    masterUser[key] = data[key];
  }
  const transaction = await db.sequelize.transaction();
  try {
    await masterUser.save({ transaction });
    if (data.email) {
      ownerData.email = data.email;
    }
    if (data.name) {
      ownerData.name = data.name;
    }
    if (data.email || data.name) {
      await ownerData.save({ transaction });
    }
    await transaction.commit();
    return null;
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

module.exports = {
  getOwner,
  createOwner,
  getMasterUserFromOwner,
  updateOwnerDetails,
  getBankDetails,
};
