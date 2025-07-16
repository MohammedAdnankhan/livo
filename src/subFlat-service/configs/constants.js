const { LANGUAGES } = require("../../config/constants");

const SUB_FLAT_LANGUAGE_KEYS = ["name_en", "name_ar"];

const SUB_FLAT_LANGUAGE_VARS = {
  [LANGUAGES.EN]: {
    name_en: "name",
  },
  [LANGUAGES.AR]: {
    name_ar: "name",
  },
};

module.exports = {
  SUB_FLAT_LANGUAGE_VARS,
  SUB_FLAT_LANGUAGE_KEYS,
};
