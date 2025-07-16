const { LANGUAGES } = require("../../config/constants");

const VISITOR_TYPE_LANGUAGE_KEYS = [
  "category_en",
  "company_en",
  "category_ar",
  "company_ar",
];

const VISITOR_TYPE_LANGUAGE_VARS = {
  [LANGUAGES.EN]: {
    category_en: "category",
    company_en: "company",
  },
  [LANGUAGES.AR]: {
    category_ar: "category",
    company_ar: "company",
  },
};

module.exports = {
  VISITOR_TYPE_LANGUAGE_VARS,
  VISITOR_TYPE_LANGUAGE_KEYS,
};
