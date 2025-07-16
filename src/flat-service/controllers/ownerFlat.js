const OwnerFlat = require("../models/OwnerFlat");

async function createOwnerFlat(data, transaction = null) {
  return await OwnerFlat.create(data, { transaction });
}

module.exports = {
  createOwnerFlat,
};
