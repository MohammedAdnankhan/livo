const { Op } = require("sequelize");
const { getBuilding } = require("../../building-service/controllers/building");
const {
  getMasterUser,
} = require("../../masterUser-service/controllers/masterUser");
const { AppError } = require("../../utils/errorHandler");
const Flat = require("../models/Flat");
const FlatInformation = require("../models/FlatInformation");
const { getFlat } = require("./flat");
const Building = require("../../building-service/models/Building");

/**
 * @async
 * @function createFlat
 * @param {import("../types").ICreateFlat} data
 * @param {string} propertyId - Property ID of the logged in admin
 * @description Function to create a flat
 * @returns {Promise<null>}
 */
exports.createFlat = async (data, propertyId) => {
  const reference = "createFlat";
  const { flatInformation, ...flatData } = data;

  const [building, existingFlat] = await Promise.all([
    getBuilding({ id: flatData.buildingId, propertyId }),
    getFlat({ name_en: flatData.name_en, buildingId: flatData.buildingId }),
  ]);

  if (!building) {
    throw new AppError(reference, "Property not found", "custom", 404);
  }

  if (existingFlat) {
    throw new AppError(reference, "Unit already exists", "custom", 412);
  }

  if (
    flatData.ownerId &&
    !(await getMasterUser({ id: flatData.ownerId, propertyId }))
  ) {
    throw new AppError(reference, "Owner not found", "custom", 404);
  }

  if (flatData.unitId && (await getFlat({ unitId: flatData.unitId }))) {
    throw new AppError(
      reference,
      "Unit with mentioned Government Id already exists",
      "custom",
      404
    );
  }
  const flat = await Flat.create(flatData);
  flatInformation["flatId"] = flat.id;
  await FlatInformation.create(flatInformation);
  return null;
};

/**
 * @param {string} flatId
 * @param {string} propertyId
 * @param {import("../types").IUpdateFlat} flatData
 */
exports.updateFlat = async (flatId, propertyId, flatData) => {
  const reference = "updateFlat";
  const flat = await Flat.findOne({
    where: { id: flatId, "$building.propertyId$": propertyId },
    include: [
      { model: FlatInformation, as: "flatInfo", required: true },
      {
        model: Building,
        as: "building",
        required: true,
        attributes: [],
      },
    ],
  });
  if (!flat) {
    throw new AppError(reference, "Flat not found", "custom", 404);
  }

  const { flatInformation, ...data } = flatData;

  if (data.buildingId) {
    const buildingParams = {
      id: data.buildingId,
      propertyId,
    };
    const flatParams = {
      name_en: data.name_en ? data.name_en : flat.name_en,
      buildingId: data.buildingId,
      id: {
        [Op.ne]: flat.id,
      },
    };
    const [building, checkExistingFlat] = await Promise.all([
      getBuilding(buildingParams),
      getFlat(flatParams),
    ]);
    if (!building) {
      throw new AppError(reference, "Building not found", "custom", 404);
    }
    if (checkExistingFlat) {
      throw new AppError(
        reference,
        "Flat already exists with the name",
        "custom",
        409
      );
    }
  }
  if (
    data.ownerId &&
    !(await getMasterUser({ id: data.ownerId, propertyId }))
  ) {
    throw new AppError(reference, "Owner not found", "custom", 404);
  }

  if (
    data.unitId &&
    (await getFlat({ unitId: data.unitId, id: { [Op.ne]: flat.id } }))
  ) {
    throw new AppError(
      reference,
      "Unit with mentioned Government Id already exists",
      "custom",
      409
    );
  }

  if (data.contactEmail) {
    flat["flatInfo"]["primaryContact"]["email"] = data.contactEmail;
  }
  if (data.contactCountryCode) {
    flat["flatInfo"]["primaryContact"]["countryCode"] = data.contactCountryCode;
  }
  if (data.contactMobileNumber) {
    flat["flatInfo"]["primaryContact"]["mobileNumber"] =
      data.contactMobileNumber;
  }
  if (data.contactName) {
    flat["flatInfo"]["primaryContact"]["name"] = data.contactName;
  }

  if (data.poaEmail) {
    flat["flatInfo"]["poaDetails"]["email"] = data.poaEmail;
  }
  if (data.poaCountryCode) {
    flat["flatInfo"]["poaDetails"]["countryCode"] = data.poaCountryCode;
  }
  if (data.poaMobileNumber) {
    flat["flatInfo"]["poaDetails"]["mobileNumber"] = data.poaMobileNumber;
  }
  if (data.poaName) {
    flat["flatInfo"]["poaDetails"]["name"] = data.poaName;
  }
  if (data.leaseType) {
    flat["flatInfo"]["leaseType"] = data.leaseType;
  }
  if (data.rentalType) {
    flat["flatInfo"]["rentalType"] = data.rentalType;
  }

  flat["flatInfo"].changed("primaryContact", true); //TODO: mark as changed only when keys for the object are received in payload
  flat["flatInfo"].changed("poaDetails", true); //TODO: mark as changed only when keys for the object are received in payload

  for (const key in data) {
    flat[key] = data[key];
  }

  for (const key in flatInformation) {
    flat["flatInfo"][key] = flatInformation[key];
  } //TODO: update only when the object is not empty. Find so using existing util function

  await Promise.all([flat.save(), flat.flatInfo.save()]);
  return null;
};
