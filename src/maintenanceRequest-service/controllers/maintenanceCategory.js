const { AppError } = require("../../utils/errorHandler");
const MaintenanceCategory = require("../models/MaintenanceCategory");
const { enableSearch } = require("../../utils/utility");
const db = require("../../database");
const { LANGUAGES } = require("../../config/constants");

//* Create category --admin
const createCategory = async (data) => {
  const reference = "createCategory";
  if (!data.name_en) {
    throw new AppError(reference, "Category name is required", "custom", 412);
  }

  if (!data.image) {
    throw new AppError(reference, "Category image is required", "custom", 412);
  }

  //check if category already exists
  if (
    await MaintenanceCategory.findOne({
      where: { name_en: data.name_en },
      paranoid: false,
    })
  ) {
    throw new AppError(reference, "Category already exists", "custom", 412);
  }

  await MaintenanceCategory.create(data);
  return "Category created successfully";
};

// //*Get categories --admin/user
const getCategoriesList = async (params, language = LANGUAGES.EN) => {
  enableSearch(params, "name", language);

  return await MaintenanceCategory.findAndCountAll({
    order: [[`name_${language}`, "ASC"]],
    where: params,
  });
};

//* Get categories --admin
const getCategories = async (
  params,
  { offset, limit },
  language = LANGUAGES.EN
) => {
  enableSearch(params, "name", language);

  return await MaintenanceCategory.findAndCountAll({
    where: params,
    order: [
      ["createdAt", "DESC"],
      [`name_${language}`, "ASC"],
    ],
    offset,
    limit,
  });
};

//*Get category by id

const getCategoryById = async (id) => {
  return await MaintenanceCategory.findByPk(id);
};

//*Update category by id
const updateCategory = async (data, params) => {
  const reference = "updateCategory";
  const category = await getCategory(params);

  if (!category) {
    throw new AppError(reference, "Category not found", "custom", 404);
  }

  data.name_en && (category.name_en = data.name_en);
  data.name_ar && (category.name_ar = data.name_ar);
  data.image && (category.image = data.image);

  await category.save();

  return "Category updated successfully";
};

//*Delete category by id
const deleteCategory = async (params) => {
  const reference = "deleteCategory";
  const category = await getCategory(params);
  if (!category) {
    throw new AppError(reference, "Category not found", "custom", 404);
  }
  await category.destroy();
  return "Category deleted successfully";
};

async function getCategory(params) {
  return await MaintenanceCategory.findOne({
    where: params,
  });
}

//* Toggle is visible feature
const toggleVisibility = async (params) => {
  const reference = "toggleVisibility";
  //check if category  exists
  const category = await getCategory(params);
  if (!category) {
    throw new AppError(reference, "Category not found", "custom", 404);
  }
  category.isVisible = !category.isVisible;
  await category.save();

  return `Category visible to ${
    category.isVisible ? "everyone" : "Admin only"
  }`;
};

//get categories from flat
const getCategoriesFromFlat = async (
  { search, flatId, isVisible },
  language = LANGUAGES.EN
) => {
  let query;

  if (search) {
    query = `SELECT c.id, c.name_${language} as name, c.image FROM maintenance_categories c 
   JOIN properties p ON "c"."propertyId" = "p"."id" AND (p."deletedAt" is null)
   JOIN buildings as b ON "p"."id" = "b"."propertyId" AND (b."deletedAt" is null)
   JOIN flats as f ON "f"."buildingId" = "b"."id" AND (f."deletedAt" is null)
   WHERE "f"."id" =:flatId and c."isVisible" is :isVisible and c.name_${language} ILIKE '%${search}%' and "c"."deletedAt" IS NULL`;
  } else {
    query = `SELECT c.id, c.name_${language} as name, c.image FROM maintenance_categories c 
   JOIN properties p ON "c"."propertyId" = "p"."id" AND (p."deletedAt" is null)
   JOIN buildings as b ON "p"."id" = "b"."propertyId" AND (b."deletedAt" is null)
   JOIN flats as f ON "f"."buildingId" = "b"."id" AND (f."deletedAt" is null)
   WHERE "f"."id" =:flatId and c."isVisible" is :isVisible and "c"."deletedAt" IS NULL`;
  }

  const categories = await db.sequelize.query(query, {
    raw: true,
    type: db.Sequelize.QueryTypes.SELECT,
    replacements: {
      flatId,
      isVisible,
    },
  });

  return categories;
};

//get category from flat
const getCategoryFromFlat = async (
  { flatId, categoryId },
  language = LANGUAGES.EN
) => {
  const query = `SELECT c.id, c.name_${language} as name, c.image, c."isVisible" FROM maintenance_categories c 
   JOIN properties p ON "c"."propertyId" = "p"."id" AND (p."deletedAt" is null)
   JOIN buildings as b ON "p"."id" = "b"."propertyId" AND (b."deletedAt" is null)
   JOIN flats as f ON "f"."buildingId" = "b"."id" AND (f."deletedAt" is null)
   WHERE "f"."id" =:flatId and c.id = :categoryId and "c"."deletedAt" IS NULL`;

  const category = await db.sequelize.query(query, {
    raw: true,
    type: db.Sequelize.QueryTypes.SELECT,
    replacements: {
      flatId,
      categoryId,
    },
  });

  return category?.[0];
};

async function createCategories(data) {
  return await MaintenanceCategory.bulkCreate(data);
}

module.exports = {
  createCategory,
  getCategories,
  getCategoryById,
  updateCategory,
  deleteCategory,
  toggleVisibility,
  getCategory,
  getCategoriesFromFlat,
  getCategoriesList,
  getCategoryFromFlat,
  createCategories,
};
