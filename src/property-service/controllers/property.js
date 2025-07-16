const { FLAT_USAGE, PAYMENT_FREQUENCIES } = require("../../config/constants");
const db = require("../../database");
const Locality = require("../../locality-service/models/Locality");
const {
  getCategoriesList,
  createCategories,
} = require("../../maintenanceRequest-service/controllers/maintenanceCategory");
const { AppError } = require("../../utils/errorHandler");
const logger = require("../../utils/logger");
const { enableSearch } = require("../../utils/utility");
const Property = require("../models/Property");
const PropertyFeature = require("../models/PropertyFeature");

const getProperties = async (params = {}, { offset, limit }) => {
  enableSearch(params, "name");
  return await Property.findAndCountAll({
    where: params,
    limit,
    offset,
    include: [
      {
        model: PropertyFeature,
        as: "propertyFeature",
        attributes: [
          "communityManagement",
          "serviceManagement",
          "visitorManagement",
          "isMaintenanceFree",
        ],
      },
      {
        model: Locality,
        as: "locality",
        attributes: ["id", "name_en", "name_ar"],
      },
    ],
  });
};

const createProperty = async (data) => {
  if (!data.name || !data.localityId) {
    throw new AppError("createProperty", "Name and locality ID are required");
  }
  const property = await Property.create(data);
  const propertyFeatureData = {
    propertyId: property.id,
    isSignupApprovalRequired:
      "isSignupApprovalRequired" in data &&
      typeof data.isSignupApprovalRequired === "boolean"
        ? data.isSignupApprovalRequired
        : true,
  };
  if (!propertyFeatureData.isSignupApprovalRequired) {
    propertyFeatureData.approvalDetails = {
      approvalDuration:
        "approvalDuration" in data && !isNaN(data.approvalDuration)
          ? data.approvalDuration
          : 1,
      flatUsage: data.flatUsage ? data.flatUsage : FLAT_USAGE.RESIDENTIAL,
      securityDeposit:
        "securityDeposit" in data && !isNaN(data.securityDeposit)
          ? data.securityDeposit
          : 0,
      activationFee:
        "activationFee" in data && !isNaN(data.activationFee)
          ? data.activationFee
          : 0,
      paymentFrequency: data.paymentFrequency
        ? data.paymentFrequency
        : PAYMENT_FREQUENCIES.YEARLY,
      paymentMode: data.paymentMode ? data.paymentMode : "Cash",
      currency: data.currency ? data.currency : "AED",
      noticePeriod:
        "noticePeriod" in data && !isNaN(data.noticePeriod)
          ? data.noticePeriod
          : 0,
      rentAmount:
        "rentAmount" in data && !isNaN(data.noticePeriod) ? data.rentAmount : 0,
    };
  }
  await PropertyFeature.create(propertyFeatureData);
  const propertyCategories = [];
  getCategoriesList({ propertyId: null })
    .then(async ({ rows }) => {
      rows.map((category) => {
        propertyCategories.push({
          propertyId: property.id,
          isVisible: true,
          name_en: category.name_en,
          name_ar: category.name_ar,
          image: category.image,
        });
      });
      await createCategories(propertyCategories);
    })
    .catch((err) => {
      logger.error(
        `Error in creating categories for ${property.name} property`
      );
      logger.error(`${JSON.stringify(err)}`);
    });
  return property;
};

const updateProperty = async (data) => {
  if (!data.name) {
    throw new AppError("updateProperty", "Name is required");
  }
  const property = await getProperty({ id: data.id });
  if (!property) {
    throw new AppError("updateProperty", "Property not found");
  }
  property.name = data.name;
  await property.save();
  return property;
};

const updatePropertyFeatures = async (data) => {
  const feature = await getPropertyFeature({ propertyId: data.propertyId });
  if (!feature) {
    throw new AppError(
      "updatePropertyFeatures",
      "Property features not found",
      "custom",
      404
    );
  }
  delete data.propertyId;
  for (const key in data) {
    feature[key] = data[key];
  }
  await feature.save();
  return feature;
};

async function getProperty(params) {
  return await Property.findOne({ where: params });
}

async function getPropertyFeature(params, scope = "defaultScope") {
  return await PropertyFeature.scope(scope).findOne({ where: params });
}

async function getPropertyFeatureFromFlat(flatId) {
  const query = `
  select pf."propertyId", pf."communityManagement", pf."serviceManagement", pf."visitorManagement", pf.dashboard, pf."invoiceManagement", pf."isMaintenanceFree", pf."isSignupApprovalRequired", pf."approvalDetails" from property_features pf 
  join properties pr on pr.id = pf."propertyId" AND (pr."deletedAt" is null) 
  join buildings b on b."propertyId" = pr.id AND (b."deletedAt" is null)
  join flats f on f."buildingId" = b.id AND (f."deletedAt" is null AND f.id = :flatId)
  where pf."deletedAt" is null
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

async function getPropertyFromFlat(flatId) {
  const query = `
  select pr.id, pr.name, pr."localityId" from properties pr 
  join buildings b on b."propertyId" = pr.id AND (b."deletedAt" is null)
  join flats f on f."buildingId" = b.id AND (f."deletedAt" is null AND f.id = :flatId)
  where pr."deletedAt" is null
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
const getSideBarData = async (propertyId) => {
  try {
    const propertyFeature = await PropertyFeature.findOne({
      where: { propertyId },
    });
    if (propertyFeature) {
      return propertyFeature.adminSidebar;
    } else {
      return [];
    }
  } catch (error) {
    throw error;
  }
};

module.exports = {
  getProperties,
  createProperty,
  updateProperty,
  getProperty,
  getPropertyFeature,
  updatePropertyFeatures,
  getPropertyFeatureFromFlat,
  getPropertyFromFlat,
  getSideBarData,
};
