const { LANGUAGES } = require("../../config/constants");

const FLAT_LANGUAGE_KEYS = ["name_en", "name_ar"];

const FLAT_LANGUAGE_VARS = {
  [LANGUAGES.EN]: {
    name_en: "name",
  },
  [LANGUAGES.AR]: {
    name_ar: "name",
  },
};

module.exports = {
  FLAT_LANGUAGE_VARS,
  FLAT_LANGUAGE_KEYS,
};
