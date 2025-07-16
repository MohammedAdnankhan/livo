const { AppError } = require("../../utils/errorHandler");
const Amenity = require("../models/Amenity");
const { enableSearch } = require("../../utils/utility");
const db = require("../../database");

//* Create amenity --admin
module.exports.createAmenity = async (data) => {
  const reference = "createAmenity";

  if (
    await Amenity.findOne({
      where: { name: data.name, raisedFor: data.raisedFor },
      paranoid: false,
    })
  ) {
    throw new AppError(reference, "Amenity already exists", "custom", 412);
  }
  await Amenity.create(data);
  return null;
};

// //*Get Amenity --admin
module.exports.getAmenityList = async (params) => {
  return await Amenity.findAll({
    order: [[`name`, "ASC"]],
    where: params,
  });
};

//* Get amenities --admin
module.exports.getAmenities = async (params, { offset, limit }) => {
  enableSearch(params, "name");

  return await Amenity.findAndCountAll({
    where: params,
    order: [
      ["createdAt", "DESC"],
      [`name`, "ASC"],
    ],
    offset,
    limit,
  });
};

//*Get amenity by id

module.exports.getAmenityById = async (id) => {
  return await Amenity.findByPk(id);
};

//*Update amenity by id
module.exports.updateAmenity = async (data, params) => {
  const reference = "updateAmenity";
  const amenity = await getAmenity(params);

  if (!amenity) {
    throw new AppError(reference, "amenity not found", "custom", 404);
  }

  data.name && (amenity.name = data.name);
  data.image && (amenity.image = data.image);

  await amenity.save();

  return null;
};

//*Delete amenity by id
module.exports.deleteAmenity = async (params) => {
  const reference = "deleteAmenity";
  const amenity = await getAmenity(params);
  if (!amenity) {
    throw new AppError(reference, "Amenity not found", "custom", 404);
  }
  await amenity.destroy();
  return null;
};

async function getAmenity(params) {
  return await Amenity.findOne({
    where: params,
  });
}

//* Toggle is visible feature
module.exports.amenitiesVisibility = async (params) => {
  const reference = "amenitiesVisibility";
  //check if amenity exists
  const amenity = await getAmenity(params);
  if (!amenity) {
    throw new AppError(reference, "amenity not found", "custom", 404);
  }
  amenity.isVisible = !amenity.isVisible;
  await amenity.save();

  return amenity.isVisible;
};
