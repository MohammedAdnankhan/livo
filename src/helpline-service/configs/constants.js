const { LANGUAGES } = require("../../config/constants");

const NAME_LANGUAGE_KEYS = ["name_en", "name_ar"];

const NAME_LANGUAGE_VARS = {
  [LANGUAGES.EN]: {
    name_en: "name",
  },
  [LANGUAGES.AR]: {
    name_ar: "name",
  },
};

module.exports = { NAME_LANGUAGE_KEYS, NAME_LANGUAGE_VARS };
