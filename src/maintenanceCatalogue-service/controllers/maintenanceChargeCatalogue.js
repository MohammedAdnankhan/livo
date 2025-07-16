const { CHARGE_CATEGORIES, CURRENCY } = require("../../config/constants");
const { AppError } = require("../../utils/errorHandler");
const MaintenanceChargeCatalogue = require("../models/MaintenanceChargeCatalogue");

//get charge catalogues
const getChargeCatalogueTypes = async () => {
  return Object.keys(CHARGE_CATEGORIES).map((key) => {
    return {
      key,
      value: CHARGE_CATEGORIES[key],
    };
  });
};

//create charge catalogue
const createChargeCatalogue = async (data) => {
  if (!data.chargeName || !data.serviceCost || !data.category) {
    throw new AppError("createChargeCatalogue", "Required fields are empty");
  }
  if (!Object.keys(CHARGE_CATEGORIES).includes(data.category)) {
    throw new AppError("createChargeCatalogue", "Enter valid category");
  }
  if (data.currency && !Object.values(CURRENCY).includes(data.currency)) {
    throw new AppError(
      "createChargeCatalogue",
      "Provided currency not supported"
    );
  }
  return await MaintenanceChargeCatalogue.create(data);
};

//edit charge catalogue
const editChargeCatalogue = async (data) => {
  if (!data.chargeCatalogueId) {
    throw new AppError(
      "editChargeCatalogue",
      "Maintenance Charge Catalogue ID is required"
    );
  }
  const chargeCatalogue = await getChargeCatalogue({
    id: data.chargeCatalogueId,
  });
  if (!chargeCatalogue) {
    throw new AppError("editChargeCatalogue", "Charge details not found");
  }
  delete data.chargeCatalogueId;

  for (let key in data) {
    chargeCatalogue[key] = data[key];
  }
  await chargeCatalogue.save();
  return chargeCatalogue;
};

//get charges of a category
const getChargeCatalogueByCategory = async (params) => {
  if (!params.category) {
    throw new AppError("getChargeCatalogueByCategory", "Enter a category");
  }
  if (!Object.keys(CHARGE_CATEGORIES).includes(params.category)) {
    throw new AppError("getChargeCatalogueByCategory", "Enter valid category");
  }
  return await MaintenanceChargeCatalogue.findAll({
    where: params,
  });
};

//get all charges catalogue
const getChargesCatalogue = async () => {
  const charges = await MaintenanceChargeCatalogue.findAll();
  for (let charge of charges) {
    charge.category = CHARGE_CATEGORIES[charge.category];
  }
  const chargesCatalogue = {};

  for (let charge of charges) {
    if (!chargesCatalogue.hasOwnProperty(charge.category)) {
      chargesCatalogue[charge.category] = [charge];
    } else {
      chargesCatalogue[charge.category].push(charge);
    }
  }
  return chargesCatalogue;
};

async function getChargeCatalogue(params) {
  return await MaintenanceChargeCatalogue.findOne({
    where: params,
  });
}

module.exports = {
  getChargeCatalogueTypes,
  createChargeCatalogue,
  getChargeCatalogueByCategory,
  getChargesCatalogue,
  editChargeCatalogue,
  getChargeCatalogue,
};
