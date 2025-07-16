const { LANGUAGES } = require("../../config/constants");

const LOCALITY_LANGUAGE_KEYS = ["name_en", "name_ar"];

const LOCALITY_LANGUAGE_VARS = {
  [LANGUAGES.EN]: {
    name_en: "name",
  },
  [LANGUAGES.AR]: {
    name_ar: "name",
  },
};

module.exports = {
  LOCALITY_LANGUAGE_VARS,
  LOCALITY_LANGUAGE_KEYS,
};
