const moment = require("moment-timezone");
const MarketPlace = require("../models/MarketPlace");
const SavedItem = require("../../savedItem-service/models/SavedItem");
const { AppError } = require("../../utils/errorHandler");
const {
  LANGUAGES,
  ITEM_CONDITIONS,
  ITEM_CATEGORIES,
  TARGET_AUDIENCE,
} = require("../../config/constants");
const db = require("../../database");
const Rating = require("../models/Rating");
const User = require("../../user-service/models/User");
const {
  getFlat,
  getFlatWithLocality,
} = require("../../flat-service/controllers/flat");
const { isValidPhoneNumber } = require("../../utils/utility");

//view product conditions
const getConditions = async (language = LANGUAGES.EN) => {
  let conditions = [];
  for (const key of Object.keys(ITEM_CONDITIONS)) {
    const condition = ITEM_CONDITIONS[key][`condition_${language}`];
    const image = ITEM_CONDITIONS[key]["img"];
    conditions.push({ key, condition, image });
  }
  return conditions;
};

//view product categories
const getCategories = async (language = LANGUAGES.EN) => {
  let categories = [];
  for (const key of Object.keys(ITEM_CATEGORIES)) {
    const category = ITEM_CATEGORIES[key][`category_${language}`];
    const image = ITEM_CATEGORIES[key]["img"];
    categories.push({ key, category, image });
  }
  return categories;
};

//add new product
const addProduct = async (data) => {
  if (
    !data.title ||
    !data.age ||
    !data.price ||
    !data.condition ||
    !data.category ||
    !data.description
  ) {
    throw new AppError("addProduct", "All fields are required");
  }

  if (!ITEM_CONDITIONS[data.condition]) {
    throw new AppError("addProduct", "Condition not found");
  }
  if (!ITEM_CATEGORIES[data.category]) {
    throw new AppError("addProduct", "Category not found");
  }
  data.age = await calculateAge(data.age);

  if (data.contactNumber && !isValidPhoneNumber(data.contactNumber)) {
    throw new AppError("addProduct", "Enter valid Contact Number");
  }

  if (!Object.values(TARGET_AUDIENCE).includes(data.targetAudience))
    throw new AppError("addProduct", "Invalid Target Audience Value");

  if (data.targetAudience === TARGET_AUDIENCE.BUILDING) {
    data.targetId = (await getFlat({ id: data.flatId })).buildingId;
  } else {
    data.targetId = (
      await getFlatWithLocality({ id: data.flatId })
    ).building.locality.id;
  }

  const newItem = await MarketPlace.create(data);
  return newItem;
};

//view a specific product
const getProduct = async (params, { userId }, language = LANGUAGES.EN) => {
  const item = await MarketPlace.findOne({
    where: params,
    include: [
      {
        model: Rating,
        as: "rating",
        required: false,
        where: { userId },
      },
      {
        model: User,
        as: "user",
        attributes: ["id", "name", "profilePicture"],
      },
    ],
  });
  if (!item) {
    throw new AppError("", "Item not found");
  }
  item.age = moment(item.updatedAt)
    .subtract(item.age, "seconds")
    .from(moment(item.updatedAt), true);
  item.category = ITEM_CATEGORIES[item.category][`category_${language}`];
  item.condition = ITEM_CONDITIONS[item.condition][`condition_${language}`];
  const ratings = await db.sequelize.query(
    `select round(avg(rating), 1), count(*) from ratings where ratings."itemId"=:itemId`,
    {
      raw: true,
      replacements: { itemId: item.id },
      type: db.Sequelize.QueryTypes.SELECT,
    }
  );
  ratings[0].round = ratings[0].round != "0" ? ratings[0].round : "0";
  ratings[0].count = ratings[0].count != "0" ? ratings[0].count : "0";

  const checkIfSaved = await SavedItem.findOne({
    where: { itemId: item.id, userId },
  });
  const isSaved = checkIfSaved ? true : false;

  return {
    avg: ratings[0].round,
    totalRatings: ratings[0].count,
    item,
    isSaved,
  };
};

//edit a product
const editProduct = async (params, data) => {
  const findItem = await MarketPlace.findOne({ where: params });
  if (!findItem) {
    throw new AppError("", "No Product found");
  }
  delete data.productId;
  delete data.category;
  if (data.age) {
    data.age = await calculateAge(data.age);
  }

  if (
    data.condition &&
    !Object.keys(ITEM_CONDITIONS).includes(data.condition)
  ) {
    throw new AppError("", "Invalid condition type");
  }

  for (const key in data) {
    findItem[key] = data[key];
  }
  await findItem.save();
  return findItem;
};

//delete a product
const deleteProduct = async (params) => {
  const findProduct = await MarketPlace.findOne({ where: params });
  if (!findProduct) {
    throw new AppError("", "Invalid product");
  }
  await findProduct.destroy();
  return "Product deleted";
};

//view all marketplace items added by a user
const getMyListings = async (params, language = LANGUAGES.EN) => {
  const listings = await MarketPlace.findAll({
    where: params,
  });
  for (let listing of listings) {
    listing.category =
      ITEM_CATEGORIES[listing.category][`category_${language}`];
    listing.condition =
      ITEM_CONDITIONS[listing.condition][`condition_${language}`];
  }
  return listings;
};

const calculateAge = async (age) => {
  let newAge;
  let ageArray = age.split(" ");
  if (!ageArray[1]) {
    throw new AppError("calculateAge", "Enter valid age");
  }
  if (ageArray[1].startsWith("m") || ageArray[1].startsWith("M")) {
    newAge = ageArray[0] * 30 * 24 * 60 * 60;
  } else if (ageArray[1].startsWith("y") || ageArray[1].startsWith("Y")) {
    newAge = ageArray[0] * 12 * 30 * 24 * 60 * 60;
  } else if (ageArray[1].startsWith("d") || ageArray[1].startsWith("D")) {
    newAge = ageArray[0] * 24 * 60 * 60;
  } else {
    throw new AppError("calculateAge", "Enter valid age");
  }
  return newAge;
};

module.exports = {
  addProduct,
  editProduct,
  deleteProduct,
  getConditions,
  getCategories,
  getProduct,
  getMyListings,
};
