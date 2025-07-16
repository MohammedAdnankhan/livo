const { Op } = require("sequelize");
const db = require("../../database");
const { AppError } = require("../../utils/errorHandler");
const Image = require("../models/Image");

const getImages = async (params) => {
  if (params.search) {
    params[Op.or] = [
      { name: { [Op.iLike]: `%${params.search}%` } },
      { category: { [Op.iLike]: `%${params.search}%` } },
    ];
  }
  delete params.search;
  return await Image.findAndCountAll({
    where: params,
  });
};

const createImage = async (data) => {
  const reference = "createImage";
  if (!data.image || !data.category || !data.name) {
    throw new AppError(
      reference,
      "Image, Name and category are required",
      "custom",
      412
    );
  }
  await Image.create(data);
  return "Image created successfully";
};

const getImage = async (params) => {
  return await Image.findOne({
    where: params,
  });
};

const editImage = async (data, id) => {
  const reference = "editImage";
  const image = await getImage({ id });
  if (!image) {
    throw new AppError(reference, "Image not found", "custom", 404);
  }
  data.image && (image.image = data.image);
  if (data.category) {
    image.category = data.category;
  }
  await image.save();
  return "Image updated successfully";
};

const deleteImage = async (params) => {
  await Image.destroy({
    where: params,
    force: true,
  });
  return "Image deleted successfully";
};

const getCategories = async (params = {}) => {
  return (
    await Image.findAll({
      where: params,
      attributes: [
        [db.Sequelize.fn("DISTINCT", db.Sequelize.col("category")), "category"],
      ],
    })
  ).map((category) => category.category);
};

const deleteCategory = async (params) => {
  const reference = "deleteCategory";
  if (!(await getImage(params))) {
    throw new AppError(reference, "Category not found", "custom", 404);
  }
  await Image.destroy({
    where: params,
    force: true,
  });
  return "Category deleted successfully";
};

const createImages = async (data) => {
  const reference = "createImages";
  if (!Array.isArray(data) || !data.length) {
    throw new AppError(reference, "Required fields are empty", "custom", 412);
  }
  if (!data.every((row) => row.image && row.category && row.name)) {
    throw new AppError(
      reference,
      "Some of the mentioned image is invalid",
      "custom",
      412
    );
  }
  await Image.bulkCreate(data);
  return "Images created successfully";
};

module.exports = {
  getImages,
  createImage,
  editImage,
  getImage,
  deleteImage,
  getCategories,
  deleteCategory,
  createImages,
};
