const moment = require("moment-timezone");
const {
  LANGUAGES,
  ITEM_CATEGORIES,
  ITEM_CONDITIONS,
} = require("../../config/constants");
const db = require("../../database");
const MarketPlace = require("../../marketPlace-service/models/MarketPlace");
const { AppError } = require("../../utils/errorHandler");
const SavedItem = require("../models/SavedItem");

//add to / remove from saved item
const createOrUpdateSavedItem = async (data) => {
  if (!data.itemId) {
    throw new AppError("", "Item Id is required");
  }
  const findItem = await MarketPlace.findOne({ where: { id: data.itemId } });
  if (!findItem) {
    throw new AppError("", "Item does not exist");
  }
  let saveNewItem, isSaved;
  const findSavedItem = await SavedItem.findOne({
    where: data,
    paranoid: false,
  });
  if (!findSavedItem) {
    saveNewItem = await SavedItem.create(data);
    isSaved = true;
  } else if (findSavedItem.deletedAt !== null) {
    saveNewItem = await findSavedItem.restore();
    isSaved = true;
  } else if (findSavedItem.deletedAt == null) {
    await findSavedItem.destroy();
    saveNewItem = "Item removed";
    isSaved = false;
  }
  return { isSaved, item: saveNewItem };
};

//get saved items for a user
const getSavedItem = async (
  params,
  { offset, limit },
  language = LANGUAGES.EN
) => {
  const query = `
    select mp.category as category, mp.condition as condition, mp.title, mp.price, mp.age, mp.currency, mp.images as files, mp."createdAt", mp."updatedAt", mp.id, mp.description,
    u.name as "userDetails.name", u.id as "userDetails.id", u."profilePicture" as "userDetails.profilePicture", 
    true as "isMarketPlace"
    from saved_items si
    join market_places mp on mp.id = si."itemId"
    join users u on u.id = mp."createdBy"
    where si."userId"=:userId
    and mp."deletedAt" is null
    and si."deletedAt" is null
    ${params.title ? `and mp.title ilike :titleRegex` : ``}
    order by mp."createdAt" DESC
    limit :limit offset :offset
  `;

  const marketPlaces = await db.sequelize.query(query, {
    raw: true,
    type: db.Sequelize.QueryTypes.SELECT,
    replacements: {
      userId: params.userId,
      titleRegex: params.title ? `%${params.title}%` : "%",
      limit,
      offset,
    },
    nest: true,
  });

  for (const marketPlace of marketPlaces) {
    marketPlace.creationTime = moment(marketPlace.createdAt).from(moment());
    marketPlace.category =
      ITEM_CATEGORIES[marketPlace.category][`category_${language}`];
    marketPlace.condition =
      ITEM_CONDITIONS[marketPlace.condition][`condition_${language}`];
    marketPlace.age = moment(marketPlace.updatedAt)
      .subtract(marketPlace.age, "seconds")
      .from(moment(marketPlace.updatedAt), true);
  }

  return marketPlaces;
};

module.exports = { createOrUpdateSavedItem, getSavedItem };
