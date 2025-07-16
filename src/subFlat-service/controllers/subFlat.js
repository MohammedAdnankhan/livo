const Building = require("../../building-service/models/Building");
const SubFlat = require("../models/SubFlat");
const Flat = require("../../flat-service/models/Flat");

const getSubFlat = async (params = {}) => {
  return await SubFlat.findOne({
    where: params,
  });
};

async function getSubFlatFromParamsAndPropertyId({ params, propertyId }) {
  return await SubFlat.findOne({
    where: {
      ...params,
      "$flat->building.propertyId$": propertyId,
    },
    include: [
      {
        model: Flat,
        as: "flat",
        attributes: [],
        required: true,
        include: [
          {
            model: Building,
            as: "building",
            required: true,
            attributes: [],
          },
        ],
      },
    ],
  });
}

module.exports = {
  getSubFlat,
  getSubFlatFromParamsAndPropertyId,
};
