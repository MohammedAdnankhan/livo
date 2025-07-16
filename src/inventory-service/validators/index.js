const Joi = require("joi");
const {
  INVENTORY_TYPES,
  INVENTORY_STATUSES,
  UNIT_TYPES,
} = require("../../config/constants");

module.exports.addInventorySchema = Joi.object({
  name_en: Joi.string().required(),
  totalQuantity: Joi.number().when("inventoryType", {
    is: Joi.valid(INVENTORY_TYPES.INVENTORY),
    then: Joi.required().messages({
      "any.required": 'Quantity is required for Inventory type"',
    }),
    otherwise: Joi.optional(),
  }),
  buildings: Joi.array()
    .items(Joi.string().uuid({ version: "uuidv1" }))
    .min(1),
  isForAllBuildings: Joi.boolean(),
  inventoryType: Joi.string()
    .valid(...Object.values(INVENTORY_TYPES))
    .required(),
  description: Joi.string().optional(),
  rate: Joi.number().required(),
  currency: Joi.string().required(),
  status: Joi.string()
    .valid(...Object.values(INVENTORY_STATUSES))
    .optional(),
  unit: Joi.string()
    .valid(...Object.values(UNIT_TYPES))
    .required(),
  images: Joi.array().items(Joi.string()),
}).xor("buildings", "isForAllBuildings");

module.exports.getInventoriesSchema = Joi.object({
  inventoryType: Joi.string().valid(...Object.values(INVENTORY_TYPES)),
  buildingId: Joi.string().uuid({ version: "uuidv1" }),
  search: Joi.string(),
  status: Joi.string().valid(...Object.values(INVENTORY_STATUSES)),
});

module.exports.getInventoriesDropdownSchema = Joi.object({
  buildingId: Joi.string().uuid({ version: "uuidv1" }),
});
