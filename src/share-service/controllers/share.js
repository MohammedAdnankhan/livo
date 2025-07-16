const { AppError } = require("../../utils/errorHandler");
const Share = require("../models/Share");

//share a post
const share = async (data) => {
  if (!data.postId) {
    throw new AppError("", "Post ID is required");
  }
  const newShare = await Share.create(data);
  return newShare;
};

async function getShare(params, attributes = []) {
  return Share.findOne({
    where: params,
    attributes: attributes.length ? attributes : null,
  });
}

module.exports = { share, getShare };
