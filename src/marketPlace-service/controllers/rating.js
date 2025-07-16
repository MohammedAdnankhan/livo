const { AppError } = require("../../utils/errorHandler");
const MarketPlace = require("../models/MarketPlace");
const Rating = require("../models/Rating");

const addOrUpdateRating = async (data) => {
  if (!data.itemId) {
    throw new AppError("", "Item ID is required");
  }
  if (data.rating > 5 || data.rating < 1) {
    throw new AppError("", "Please enter valid rating");
  }
  const findItem = await MarketPlace.findOne({ where: { id: data.itemId } });
  if (!findItem) {
    throw new AppError("", "Invalid Item ID");
  }
  const params = {
    userId: data.userId,
    itemId: data.itemId,
  };
  const checkRating = await Rating.findOrCreate({
    where: params,
    defaults: {
      rating: data.rating,
      ...params,
    },
  });
  if (!checkRating[1]) {
    checkRating[0].rating = data.rating;
    await checkRating[0].save();
  }
  return checkRating[0];
};

module.exports = { addOrUpdateRating };
