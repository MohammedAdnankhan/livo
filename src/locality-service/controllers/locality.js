const { Op } = require("sequelize");
const City = require("../../city-service/models/City");
const { LANGUAGES } = require("../../config/constants");
const { enableSearch } = require("../../utils/utility");
const { LOCALITY_LANGUAGE_VARS } = require("../configs/constants");
const Locality = require("../models/Locality");
const { City: CityData } = require("country-state-city");
const { getCity } = require("../../city-service/controllers/city");
const { AppError } = require("../../utils/errorHandler");

const getLocalities = async (params = {}, language = LANGUAGES.EN) => {
  if (params.country) {
    params[`$city.country_${language}$`] = `${params.country}`;
  }
  delete params.country;
  enableSearch(params, "name", language);
  const localities = await Locality.scope("languageHelper").findAll({
    where: params,
    attributes: {
      include: Object.entries(LOCALITY_LANGUAGE_VARS[language]),
    },
    include: {
      model: City,
      as: "city",
      attributes: [
        [`name_${language}`, "name"],
        [`country_${language}`, "country"],
      ],
    },
    order: [[`name_${language}`, "ASC"]],
  });

  return localities;
};

const getLocalitiesForAdmin = async (
  params,
  { offset, limit },
  language = LANGUAGES.EN
) => {
  enableSearch(params, "name", language);
  return await Locality.findAndCountAll({
    where: params,
    include: {
      model: City,
      as: "city",
    },
    limit,
    offset,
  });
};

const addLocality = async (data) => {
  const reference = "addLocality";
  const [findCityLocality, city] = await Promise.all([
    getLocality({ cityId: data.cityId, name_en: data.name_en }),
    getCity({ id: data.cityId }),
  ]);
  if (!city) {
    throw new AppError(reference, "City not found", "custom", 404);
  }
  if (findCityLocality) {
    throw new AppError(reference, "Locality already exists", "custom", 409);
  }

  const locality = await Locality.create(data);
  const { id, name_en, cityId } = locality;
  return { id, name_en, cityId };
};

async function getLocality(params) {
  return await Locality.findOne({ where: params });
}

function getCities(countryCode) {
  if (countryCode) {
    return CityData.getCitiesOfCountry(countryCode);
  }
  return CityData.getCitiesOfCountry();
}

module.exports = {
  getLocalities,
  addLocality,
  getLocalitiesForAdmin,
  getLocality,
  getCities,
};
