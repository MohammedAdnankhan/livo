const { Op } = require("sequelize");
const { LANGUAGES } = require("../../config/constants");
const { enableSearch } = require("../../utils/utility");
const {
  CITY_LANGUAGE_VARS,
  CITY_LANGUAGE_KEYS,
} = require("../configs/constants");
const City = require("../models/City");
const { Country } = require("country-state-city");
const db = require("../../database");
const { AppError } = require("../../utils/errorHandler");
const countriesData = require("../data/countries.json");
const citiesData = require("../data/cities.json");

const getCities = async (params = {}, language = LANGUAGES.EN) => {
  params["name_en"] = { [Op.ne]: null };
  if (params.country) {
    params[`country_${language}`] = { [Op.iLike]: `%${params.country}%` };
  }
  delete params.country;
  enableSearch(params, "name", language);
  const cities = await City.scope("languageHelper").findAll({
    where: params,
    attributes: {
      include: Object.entries(CITY_LANGUAGE_VARS[language]),
    },
  });

  return cities;
};

const addCity = async (data = {}) => {
  const city = await City.create(data);
  return city;
};

const getCitiesForAdmin = async (
  params,
  { offset, limit },
  language = LANGUAGES.EN
) => {
  params["name_en"] = { [Op.ne]: null };
  enableSearch(params, "name", language);
  return await City.findAndCountAll({
    where: params,
    limit,
    offset,
  });
};

function getCountries() {
  return Country.getAllCountries().map((country) => {
    return {
      name: country.name,
      isoCode: country.isoCode,
      flag: country.flag,
      countryCode: country.phonecode.startsWith("+")
        ? country.phonecode
        : `+${country.phonecode}`,
    };
  });
}

async function getInternalCountriesList() {
  return (
    await City.findAll({
      order: [["country_en", "ASC"]],
      attributes: [
        [
          db.Sequelize.fn("DISTINCT", db.Sequelize.col("country_en")),
          "country",
        ],
      ],
    })
  ).map(({ dataValues: { country } }) => country);
}

async function getInternalCitiesList(country) {
  const reference = "getInternalCitiesList";
  if (!country) {
    throw new AppError(reference, "Country name is required", "custom", 412);
  }
  return await City.findAll({
    where: {
      country_en: country,
      name_en: { [Op.ne]: null },
    },
    order: [["name_en", "ASC"]],
    attributes: ["id", "name_en"],
  });
}

async function getCity(params) {
  return await City.findOne({ where: params });
}
//for shoba country and city by countryID
function getCountriesList(req, res) {
  return (countriesData);
}

async function getCitiesByCountry(countryId) {
  const reference = "getCitiesByCountry";
  if (!countryId) {
    throw new AppError(reference, "Country Id is required", "custom", 412);}
  const filteredCities = citiesData.filter(city => city.countryId === parseInt(countryId));
  return (filteredCities);
}

module.exports = {
  getCities,
  addCity,
  getCitiesForAdmin,
  getCountries,
  getInternalCountriesList,
  getInternalCitiesList,
  getCity,
  getCitiesByCountry,
  getCountriesList,
};
