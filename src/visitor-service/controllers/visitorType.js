const { QueryTypes, Op } = require("sequelize");
const {
  LANGUAGES,
  VISITOR_CATEGORIES,
  VISITOR_STATUSES,
  USER_TYPES,
} = require("../../config/constants");
const db = require("../../database");
const { AppError } = require("../../utils/errorHandler");
const { swap } = require("../../utils/utility");
const {
  VISITOR_TYPE_LANGUAGE_VARS,
  VISITOR_TYPE_LANGUAGE_KEYS,
} = require("../configs/constants");
const VisitorType = require("../models/VisitorType");
const Property = require("../../property-service/models/Property");

async function addVisitorType(data) {
  if (!Object.values(VISITOR_CATEGORIES).includes(data.category_en)) {
    throw new AppError("addVisitorType", "Unknown Category Type");
  }

  const visitorType = await VisitorType.create(data);

  VisitorType.findOrCreate({
    where: { category_en: data.category_en, company_en: { [Op.eq]: null } },
    defaults: {
      category_ar: data.category_ar,
      company_ar: null,
      company_en: null,
    },
  })
    .then()
    .catch();

  return visitorType;
}

async function addVisitorCompany(data) {
  const findVisitorTypeParams = {
    id: data.category_id,
    propertyId: data.propertyId,
  };

  const visitorType = await VisitorType.findOne({
    where: findVisitorTypeParams,
  });

  if (!visitorType) {
    throw new AppError("addVisitorCompany", "Invalid category", "custom", 404);
  }

  const findCompanyParams = {
    company_en: data.company_en,
    propertyId: data.propertyId,
    category_en: visitorType.category_en,
  };
  const company = await VisitorType.findOne({ where: findCompanyParams });

  if (company) {
    throw new AppError(
      "addVisitorCompany",
      "Company already exists",
      "custom",
      409
    );
  }

  const addVisitorCompanyParams = {
    category_en: visitorType.category_en,
    category_ar: visitorType.category_ar,
    company_en: data.company_en,
    company_ar: `${data.company_en}.ar`,
    image: data.image,
    propertyId: data.propertyId,
    isVisible: true,
    priority: 9,
  };

  await VisitorType.create(addVisitorCompanyParams);

  return null;
}

async function getAllVisitorCompanies(data) {
  const findVisitorCompanies = {
    where: {
      propertyId: data.propertyId,
      company_en: { [Op.ne]: null },
    },
    attributes: ["id", "category_en", "company_en", "isVisible", "image"],
    limit: data.limit,
    offset: data.offset,
  };

  if (data.search) {
    findVisitorCompanies.where[Op.or] = [
      { company_en: { [Op.iLike]: `%${data.search}%` } },
      { category_en: { [Op.iLike]: `%${data.search}%` } },
    ];
  }

  const visitorCompanies = await VisitorType.findAndCountAll(
    findVisitorCompanies
  );

  return visitorCompanies;
}

async function updateVisitorCompany(data) {
  const findVisitorTypeParams = {
    id: data.category_id,
    propertyId: data.propertyId,
  };

  const visitorType = await VisitorType.findOne({
    where: findVisitorTypeParams,
  });

  if (!visitorType) {
    throw new AppError(
      "updateVisitorCompany",
      "Invalid company",
      "custom",
      404
    );
  }

  if (data.company_en) {
    visitorType.company_en = data.company_en;
    visitorType.company_ar = `${data.company_en}.ar`;
  }

  if (data.image) {
    visitorType.image = data.image;
  }

  if (data.updated_category_id) {
    const newCategory = await VisitorType.findOne({
      where: {
        id: data.updated_category_id,
        propertyId: data.propertyId,
        company_en: { [Op.eq]: null },
      },
    });
    if (!newCategory) {
      throw new AppError(
        "updateVisitorCompany",
        "Invalid category",
        "custom",
        404
      );
    }
    visitorType.category_en = newCategory.category_en;
    visitorType.category_ar = newCategory.category_ar;
  }

  await visitorType.save();

  return null;
}

async function toggleVisitorCompany(data) {
  const findVisitorTypeParams = {
    id: data.category_id,
    propertyId: data.propertyId,
  };

  const visitorType = await VisitorType.findOne({
    where: findVisitorTypeParams,
  });

  if (!visitorType) {
    throw new AppError("addVisitorCompany", "Invalid company", "custom", 404);
  }

  visitorType.isVisible = !visitorType.isVisible;

  await visitorType.save();

  return `Company visible to ${
    visitorType.isVisible ? "everyone" : "Admin only"
  }`;
}

async function addVisitorTypeNew(data) {
  const properties = await Property.findAll({});
  const visitorType = await VisitorType.findAll({
    category_en: data.category_en,
    company_en: data?.company_en,
  });
  if (visitorType) {
    throw new AppError(
      "addVisitorTypeNew",
      "category already exists",
      "custom",
      409
    );
  }
  properties.map(async (property) => {
    data["propertyId"] = property.id;
    await VisitorType.create(data);
    VisitorType.findOrCreate({
      where: {
        category_en: data.category_en,
        company_en: { [Op.eq]: null },
        propertyId: property.id,
      },
      defaults: {
        category_ar: data.category_ar,
        company_ar: null,
        company_en: null,
        propertyId: property.id,
      },
    })
      .then()
      .catch();
  });

  return null;
}

// async function createVisitorType(data) {
//   const reference = `createVisitorType`;
//   const visitorType = await VisitorType.findOne({
//     where: {
//       category_en: data.category_en,
//       company_en: data.company_en ? data.company_en : null,
//       propertyId: data.propertyId,
//     },
//   });
//   if (visitorType) {
//     throw new AppError(reference, "Visitor type already exists", "custom", 412);
//   }
//   data.category_ar = `${data.category_en}.ar`;
//   if (data.company_en) {
//     data.company_ar = `${data.company_en}.ar`;
//   }
//   await VisitorType.create(data);

//   return null;
// }

async function updateVisitorTypeVisibility(visitorTypeId, propertyId) {
  const reference = `updateVisitorTypeVisibility`;
  const visitorType = await VisitorType.findOne({
    where: {
      id: visitorTypeId,
      propertyId,
    },
  });
  if (!visitorType) {
    throw new AppError(reference, "Visitor type not found", "custom", 412);
  }

  visitorType.isVisible = !visitorType.isVisible;
  await visitorType.save();

  return `Category visible to ${
    visitorType.isVisible ? "everyone" : "Admin only"
  }`;
}

async function getVisitorCompanies(params = {}, language = LANGUAGES.EN) {
  const category = await VisitorType.findOne({
    where: { id: params.categoryId },
  });

  if (!category) {
    throw new AppError("getVisitorCompanies", "Invalid Category Id");
  }

  const newParams = {
    company_en: {
      [Op.ne]: null,
    },
    propertyId: null,
    category_en: category.category_en,
  };
  return getVisitorTypes(newParams, language);
}

async function getVisitorCompaniesNew(
  params = {},
  language = LANGUAGES.EN,
  role
) {
  const param = { id: params.categoryId, propertyId: params.propertyId };
  param["isVisible"] = true;
  if (params.role && params.role === USER_TYPES.ADMIN) {
    delete param["isVisible"];
  }
  const category = await VisitorType.findOne({
    where: param,
  });

  if (!category) {
    throw new AppError("getVisitorCompanies", "Invalid Category Id");
  }

  const newParams = {
    company_en: {
      [Op.ne]: null,
    },
    category_en: category.category_en,
    propertyId: category.propertyId,
    isVisible: true,
  };
  if (params.role && params.role === USER_TYPES.ADMIN) {
    delete newParams["isVisible"];
  }
  return getVisitorTypes(newParams, language);
}

async function getVisitorTypes(params = {}, language = LANGUAGES.EN) {
  const visitorTypes = await VisitorType.scope("languageHelper").findAll({
    where: params,
    attributes: {
      include: Object.entries(VISITOR_TYPE_LANGUAGE_VARS[language]),
      exclude: ["priority"],
    },
    order: [
      ["priority", "ASC"],
      ["createdAt", "DESC"],
    ],
  });

  return visitorTypes;
}

function getVisitorCategories(language = LANGUAGES.EN) {
  return db.sequelize.query(
    `
    select category_${language} as category, id, image from visitor_types where company_en is null and "propertyId" is null and "deletedAt" is null;
  `,
    {
      raw: true,
      type: QueryTypes.SELECT,
    }
  );
}

async function getVisitorCategoriesNew(
  language = LANGUAGES.EN,
  propertyId,
  role
) {
  return db.sequelize.query(
    `
    select category_${language} as category, id, image ${
      role && role === USER_TYPES.ADMIN ? `, "isVisible"` : ""
    } from visitor_types where company_en is null and "deletedAt" is null ${
      role && role === USER_TYPES.ADMIN ? "" : 'AND "isVisible" IS TRUE'
    }
${propertyId ? `AND "propertyId" = '${propertyId}'` : ""}
  `,
    {
      raw: true,
      type: QueryTypes.SELECT,
    }
  );
}

async function getAllVisitorCategories(
  language = LANGUAGES.EN,
  propertyId,
  query,
  { offset, limit }
) {
  return db.sequelize.query(
    `
    select category_${language} as category, id, image,"createdAt","company_en","isVisible" from visitor_types where "deletedAt" is null and "propertyId" = '${propertyId}'
    ${
      query.search
        ? `AND (category_${language} ilike '%${query.search}%' OR company_${language} ilike '%${query.search}%')`
        : ""
    }
     order by "createdAt" DESC
    limit ${limit}
    offset ${offset}
  `,
    {
      raw: true,
      type: QueryTypes.SELECT,
    }
  );
}

function getNonGuestCategories(language = LANGUAGES.EN) {
  return db.sequelize.query(
    `
    select category_${language} as category, category_en, id, image from visitor_types where company_en is null and "propertyId" is null and "deletedAt" is null and category_en not in ('${VISITOR_CATEGORIES.GUEST}', '${VISITOR_CATEGORIES.DAILY_HELP}') order by category_en;
  `,
    {
      raw: true,
      type: QueryTypes.SELECT,
    }
  );
}

function getNonGuestCategoriesNew(language = LANGUAGES.EN, propertyId, role) {
  return db.sequelize.query(
    `
    select category_${language} as category, category_en, id, image from visitor_types where company_en is null and "deletedAt" is null and category_en not in 
    ('${VISITOR_CATEGORIES.GUEST}', '${VISITOR_CATEGORIES.DAILY_HELP}')
    ${role && role === USER_TYPES.ADMIN ? "" : 'AND "isVisible" IS TRUE'}
    ${propertyId ? `AND "propertyId" = '${propertyId}'` : ""}
    order by category_en;
  `,
    {
      raw: true,
      type: QueryTypes.SELECT,
    }
  );
}

function sortVisitorCategories(categories) {
  const customOrder = {
    Guest: 0,
    Delivery: 1,
    "Home Services": 2,
    "Daily Help": 3,
    Cab: 4,
    Others: 5,
  };

  let i = 0;
  while (i < categories.length) {
    if (
      customOrder.hasOwnProperty(categories[i]["category_en"]) &&
      customOrder[categories[i]["category_en"]] < categories.length &&
      customOrder[categories[i]["category_en"]] != i
    ) {
      swap(categories, customOrder[categories[i]["category_en"]], i);
    } else {
      i++;
    }
  }
}

async function getVisitorType(params = {}, language = LANGUAGES.EN) {
  const visitorType = await VisitorType.findOne({
    where: params,
    attributes: {
      include: Object.entries(VISITOR_TYPE_LANGUAGE_VARS[language]),
    },
  });

  return visitorType;
}

async function getCompaniesForDailyHelp(language = LANGUAGES.EN, propertyId) {
  const query = {
    category_en: { [Op.iLike]: `daily%` },
    company_en: {
      [Op.ne]: null,
    },
    propertyId,
    isVisible: true,
  };
  const find = await VisitorType.findAll({
    where: query,
    attributes: {
      include: Object.entries(VISITOR_TYPE_LANGUAGE_VARS[language]),
    },
    raw: true,
  });
  return find;
}

async function getCompaniesForDailyHelpNew(
  language = LANGUAGES.EN,
  propertyId,
  role
) {
  const query = {
    category_en: { [Op.iLike]: `daily%` },
    company_en: {
      [Op.ne]: null,
    },
    propertyId,
    isVisible: true,
  };
  if (role && role === USER_TYPES.ADMIN) {
    delete query["isVisible"];
  }
  const find = await VisitorType.findAll({
    where: query,
    attributes: {
      include: Object.entries(VISITOR_TYPE_LANGUAGE_VARS[language]),
    },
    raw: true,
  });
  return find;
}

async function getVisitorTrafficByCategory({
  buildingIds,
  startDate,
  endDate,
}) {
  const query = `
  select count(vvs.*), vt.category_en as category
  from visitor_visiting_statuses vvs 
  join visitor_visitings vv on vv.id = vvs."visitingId"
  join visitor_types vt on vt.id = vv."visitorTypeId"
  join flats f on (f.id = vv."flatId" and f."buildingId" in (:buildingIds))
  where vvs.status = :status and vvs."createdAt" >= :startDate and vvs."createdAt" <= :endDate
  group by category;`;

  let data = await db.sequelize.query(query, {
    type: db.Sequelize.QueryTypes.SELECT,
    replacements: {
      buildingIds,
      status: VISITOR_STATUSES.CHECKIN,
      startDate,
      endDate,
    },
  });
  if (data.length === 0) {
    const query = `
  select  vt.category_en as category, 0 as count
  from visitor_visiting_statuses vvs 
  join visitor_visitings vv on vv.id = vvs."visitingId"
  join visitor_types vt on vt.id = vv."visitorTypeId"
  join flats f on (f.id = vv."flatId" and f."buildingId" in (:buildingIds))
  group by category;`;

    data = await db.sequelize.query(query, {
      type: db.Sequelize.QueryTypes.SELECT,
      replacements: {
        buildingIds,
      },
    });
  }
  return data;
}

function sortDailyHelpTypes(types) {
  const customOrder = {
    Cleaner: 0,
    Cook: 1,
    Driver: 2,
    Nanny: 3,
    Gardener: 4,
    "Gym Instructor": 5,
    Others: 6,
  };

  let i = 0;
  while (i < types.length) {
    if (
      customOrder.hasOwnProperty(types[i]["company_en"]) &&
      customOrder[types[i]["company_en"]] < types.length &&
      customOrder[types[i]["company_en"]] != i
    ) {
      swap(types, customOrder[types[i]["company_en"]], i);
    } else {
      i++;
    }
  }

  for (const type of types) {
    for (const val of VISITOR_TYPE_LANGUAGE_KEYS) delete type[val];
  }
}

module.exports = {
  addVisitorType,
  getVisitorTypes,
  getVisitorCategories,
  getVisitorCompanies,
  getVisitorType,
  getCompaniesForDailyHelp,
  sortVisitorCategories,
  sortDailyHelpTypes,
  getNonGuestCategories,
  getVisitorTrafficByCategory,
  updateVisitorTypeVisibility,
  getVisitorCategoriesNew,
  getAllVisitorCategories,
  getNonGuestCategoriesNew,
  getVisitorCompaniesNew,
  addVisitorTypeNew,
  getCompaniesForDailyHelpNew,
  addVisitorCompany,
  getAllVisitorCompanies,
  updateVisitorCompany,
  toggleVisitorCompany,
};
