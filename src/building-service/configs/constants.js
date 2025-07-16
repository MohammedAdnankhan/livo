const { LANGUAGES } = require("../../config/constants");

const BUILDING_LANGUAGE_KEYS = [
  "name_en",
  "name_ar",
  "address_en",
  "address_ar",
  "description_en",
  "description_ar",
];

const BUILDING_LANGUAGE_VARS = {
  [LANGUAGES.EN]: {
    name_en: "name",
    address_en: "address",
    description_en: "description",
  },
  [LANGUAGES.AR]: {
    name_ar: "name",
    address_ar: "address",
    description_ar: "description",
  },
};

module.exports = {
  BUILDING_LANGUAGE_VARS,
  BUILDING_LANGUAGE_KEYS,
};
