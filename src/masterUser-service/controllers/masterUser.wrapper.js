const BankDetail = require("../models/BankDetail");
const MasterUser = require("../models/MasterUser");

/**
 * @async
 * @param {object} params
 * @param {string} params.mobileNumber
 * @param {object} data
 * @param {string} propertyId
 * @param {any} transaction
 */
module.exports.findOrCreateMuForHomeTherapy = async (
  params,
  data,
  propertyId,
  transaction = null
) => {
  const findUser = await MasterUser.findOne({ where: params });
  if (findUser) {
    return findUser;
  }
  const muData = {
    ...params,
    ...data,
    propertyId,
    isCompany: false,
    alternateContact: {
      email: null,
      countryCode: null,
      mobileNumber: null,
    },
  };
  const newMasterUser = await MasterUser.create(muData, { transaction });
  await BankDetail.create({ masterUserId: newMasterUser.id }, { transaction });
  return newMasterUser;
};
