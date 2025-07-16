const { LANGUAGES } = require("../../config/constants");

const CITY_LANGUAGE_KEYS = ["name_en", "country_en", "name_ar", "country_ar"];

const CITY_LANGUAGE_VARS = {
  [LANGUAGES.EN]: {
    name_en: "name",
    country_en: "country",
  },
  [LANGUAGES.AR]: {
    name_ar: "name",
    country_ar: "country",
  },
};

module.exports = {
  CITY_LANGUAGE_VARS,
  CITY_LANGUAGE_KEYS,
};
