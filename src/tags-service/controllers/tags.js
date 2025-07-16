const { Op } = require("sequelize");
const Tags = require("../../tags-service/models/Tags");
const { AppError } = require("../../utils/errorHandler");

module.exports.addTags = async (data) => {
  const reference = `addTags`;
  const existingTag = await Tags.findOne({
    where: data,
  });
  if (existingTag) {
    throw new AppError(reference, `Tag already exists`, "custom", 404);
  }
  const tag = await Tags.create(data);
  const tagData = {
    id: tag.id,
    name: tag.name,
  };
  return tagData;
};

module.exports.getAllTags = async (params) => {
  if (params.search) {
    params.name = { [Op.iLike]: `%${params.search}%` };
    delete params.search;
  }
  const tags = Tags.findAll({
    where: params,
    attributes: ["id", "name"],
  });

  return tags;
};
