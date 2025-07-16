const { Op } = require("sequelize");
const moment = require("moment-timezone");
const {
  CHARGE_TYPES,
  LANGUAGES,
  PAYMENT_STATUSES,
} = require("../../config/constants");
const db = require("../../database");
const Flat = require("../../flat-service/models/Flat");
const { AppError } = require("../../utils/errorHandler");
const { getDateTimeObjectFromTimezone } = require("../../utils/utility");
const Charge = require("../models/Charge");
const Payment = require("../models/Payment");
const { getFlatsWithResident } = require("../../flat-service/controllers/flat");

function validateChargeDueDate(dueDate, timezone) {
  let date = getDateTimeObjectFromTimezone(dueDate, timezone);
  date = moment(date).tz(timezone).endOf("day").toDate();

  // "Due Date must be tomorrow or later"
  if (date <= moment().tz(timezone).endOf("day").toDate()) {
    throw new AppError(
      "validateChargeDueDate",
      "Due Date must be tomorrow or later"
    );
  }

  return date;
}

//get charge types
const getChargeTypes = async (language = LANGUAGES.EN) => {
  let chargeTypes = [];
  for (const key of Object.keys(CHARGE_TYPES)) {
    const type = CHARGE_TYPES[key][`charge_${language}`];
    chargeTypes.push({ key, type });
  }
  return chargeTypes;
};

//create new charge
const createNewCharge = async (data, timezone) => {
  if (!Object.keys(CHARGE_TYPES).includes(data.chargeType)) {
    throw new AppError("createNewCharge", "Please enter valid type");
  }
  data.chargeTypeId =
    data.chargeType == "MAINTENANCE" ? data.chargeTypeId : null;

  if (data.dueDate) {
    data.dueDate = validateChargeDueDate(data.dueDate, timezone);
  }

  const newCharge = await Charge.create(data);

  // eventEmitter.emit("flat_level_notification", {
  //   actionType: ACTION_TYPES.NEW_PAYMENT.key,
  //   sourceType: SOURCE_TYPES.CHARGE,
  //   sourceId: newCharge.id,
  //   generatedBy: null,
  //   flatId: newCharge.flatId,
  // });

  return newCharge;
};

const createChargesByBuilding = async (data, timezone) => {
  if (!Object.keys(CHARGE_TYPES).includes(data.chargeType)) {
    throw new AppError("createNewCharge", "Please enter valid type");
  }
  if (data.dueDate) {
    data.dueDate = validateChargeDueDate(data.dueDate, timezone);
  }

  const flats = await getFlatsWithResident({
    buildingId: data.buildingId,
  });

  const charges = flats.map((f) => ({
    flatId: f.id,
    amount: data.amount,
    currency: data.currency,
    chargeType: data.chargeType,
    description: data.description || null,
    dueDate: data.dueDate,
  }));

  await Charge.bulkCreate(charges);

  return charges;
};

//get charge lists
const getChargeLists = async (
  params = {},
  query,
  { limit, offset },
  language = LANGUAGES.EN
) => {
  const { status, chargeType } = query;

  if (status === "paid") {
    query = `
      select *
      from charges c
      left join (
        select Distinct ON("chargeId") "payStatus", "chargeId", id as "paymentId"
        from payments
        order by "chargeId", "createdAt" DESC
      ) as p on p."chargeId" = c.id
      where "flatId" = :flatId
      ${chargeType ? `and c."chargeType" = '${chargeType}'` : ``}
      and (p."payStatus" = '${
        PAYMENT_STATUSES.COMPLETED.key
      }' or p."payStatus" = '${PAYMENT_STATUSES.PENDING.key}')
      order by c."createdAt" DESC
      limit :limit offset :offset
    `;
  } else if (status === "unpaid") {
    query = `
      select *
      from charges c
      left join (
        select Distinct on("chargeId") "payStatus", "chargeId", id as "paymentId"
        from payments
        order by "chargeId", "createdAt" DESC
      ) as p on p."chargeId" = c.id
      where "flatId" = :flatId
      ${chargeType ? `and c."chargeType" = '${chargeType}'` : ``}
      and (p."payStatus" = '${
        PAYMENT_STATUSES.FAILED.key
      }' or p."payStatus" is null)
      order by c."createdAt" DESC
      limit :limit offset :offset
    `;
  } else {
    query = `
      select *
      from charges c
      left join (
        select Distinct ON("chargeId") "payStatus", "chargeId", id as "paymentId"
        from payments
        order by "chargeId", "createdAt" DESC
      ) as p on p."chargeId" = c.id
      where "flatId" = :flatId
      ${chargeType ? `and c."chargeType" = '${chargeType}'` : ``}
      order by c."createdAt" DESC
      limit :limit offset :offset
    `;
  }

  const charges = await db.sequelize.query(query, {
    raw: true,
    type: db.Sequelize.QueryTypes.SELECT,
    replacements: {
      flatId: params.flatId,
      limit,
      offset,
    },
  });

  for (let charge of charges) {
    charge.chargeType = CHARGE_TYPES[charge.chargeType][`charge_${language}`];
  }

  return charges;
};

//get specific charge details
const getChargeDetail = async (params, language = LANGUAGES.EN) => {
  const details = await Charge.findOne({ where: params });
  if (!details) {
    throw new AppError("", "Charge details not found");
  }
  details.chargeType = CHARGE_TYPES[details.chargeType][`charge_${language}`];

  return details;
};

const getChargePaymentDetails = async ({ chargeId, flatId }) => {
  let charge = await Charge.findOne({
    where: {
      id: chargeId,
      flatId,
    },
    include: [
      {
        model: Payment,
        as: "payments",
        order: [["createdAt", "DESC"]],
        limit: 1,
      },
    ],
  });
  charge = JSON.parse(JSON.stringify(charge));

  if (!charge) {
    throw new AppError("getChargePaymentDetails", "Charge not found");
  }

  const overdueCharge = 0;
  charge.finalAmount = charge.amount + overdueCharge;

  if (charge.payments.length == 0) {
    return charge;
  }
  if (charge.payments[0].payStatus == PAYMENT_STATUSES.COMPLETED.key) {
    throw new AppError("getChargePaymentDetails", "Payment Already Completed");
  }
  if (charge.payments[0].payStatus == PAYMENT_STATUSES.PENDING.key) {
    throw new AppError(
      "getChargePaymentDetails",
      "Payment In Progress, Please try after some time"
    );
  }
  return charge;
};

async function getTotalAmount(params, { startDate, endDate }) {
  return await Charge.findOne({
    where: {
      updatedAt: {
        [Op.gt]: startDate,
        [Op.lt]: endDate,
      },
    },
    attributes: [
      [db.sequelize.fn("sum", db.sequelize.col("amount")), "totalAmount"],
    ],
    raw: true,
    include: {
      model: Flat,
      attributes: [],
      as: "flat",
      required: true,
      where: params,
    },
  });
}

async function getTotalCollectedAmount(params, { startDate, endDate }) {
  let query;
  if (params.buildingId) {
    query = `
      select sum(c.amount) as "totalCollected" from charges c
      inner join flats f on f.id = c."flatId" and (f."deletedAt" is null and f."buildingId" = :buildingId)
      inner join payments p on p."chargeId" = c.id and (p."deletedAt" is null and p."payStatus" = '${PAYMENT_STATUSES.COMPLETED.key}')
      where (c."deletedAt" is null and (c."updatedAt" > :startDate and c."updatedAt" < :endDate))`;
  } else {
    query = `
      select sum(c.amount) as "totalCollected" from charges c
      inner join flats f on c."flatId" = f.id and (f."deletedAt" is null and cast(f."buildingId" as text) = any (Array [:buildingId]))
      inner join payments p on c.id = p."chargeId" and (p."deletedAt" is null and p."payStatus" = '${PAYMENT_STATUSES.COMPLETED.key}')
      where (c."deletedAt" is null and (c."updatedAt" > :startDate and c."updatedAt" < :endDate))`;
  }
  const totalCollected = await db.sequelize.query(query, {
    type: db.Sequelize.QueryTypes.SELECT,
    raw: true,
    replacements: {
      buildingId: params.buildingId ? params.buildingId : params,
      startDate,
      endDate,
    },
  });
  if (!totalCollected[0].totalCollected) {
    totalCollected[0].totalCollected = 0;
  }
  return totalCollected;
}

const getChargeListsByBuilding = async (
  params = {},
  query,
  { limit, offset },
  language = LANGUAGES.EN
) => {
  const { status, chargeType } = query;

  if (status === "paid") {
    query = `
      select c.*, p.*, f.name_en as flatName_en, f.name_ar as flatName_ar,
      b.name_en as "buildingName_en", b.name_ar as "buildingName_ar"
      from charges c
      left join (
        select Distinct ON("chargeId") "payStatus", "chargeId", id as "paymentId"
        from payments
        order by "chargeId", "createdAt" DESC
      ) as p on p."chargeId" = c.id
      join flats f on f."id" = c."flatId"
      join buildings b on b.id = f."buildingId"
      where f."buildingId" = :buildingId
      ${chargeType ? `and c."chargeType" = '${chargeType}'` : ``}
      and (p."payStatus" = '${
        PAYMENT_STATUSES.COMPLETED.key
      }' or p."payStatus" = '${PAYMENT_STATUSES.PENDING.key}')
      order by c."createdAt" DESC
      limit :limit offset :offset
    `;
  } else if (status === "unpaid") {
    query = `
      select c.*, p.*, f.name_en as flatName_en, f.name_ar as flatName_ar,
      b.name_en as "buildingName_en", b.name_ar as "buildingName_ar"
      from charges c
      left join (
        select Distinct on("chargeId") "payStatus", "chargeId", id as "paymentId"
        from payments
        order by "chargeId", "createdAt" DESC
      ) as p on p."chargeId" = c.id
      join flats f on f."id" = c."flatId"
      join buildings b on b.id = f."buildingId"
      where f."buildingId" = :buildingId
      ${chargeType ? `and c."chargeType" = '${chargeType}'` : ``}
      and (p."payStatus" = '${
        PAYMENT_STATUSES.FAILED.key
      }' or p."payStatus" is null)
      order by c."createdAt" DESC
      limit :limit offset :offset
    `;
  } else {
    query = `
      select c.*, p.*, f.name_en as flatName_en, f.name_ar as flatName_ar,
      b.name_en as "buildingName_en", b.name_ar as "buildingName_ar"
      from charges c
      left join (
        select Distinct ON("chargeId") "payStatus", "chargeId", id as "paymentId"
        from payments
        order by "chargeId", "createdAt" DESC
      ) as p on p."chargeId" = c.id
      join flats f on f."id" = c."flatId"
      join buildings b on b.id = f."buildingId"
      where f."buildingId" = :buildingId
      ${chargeType ? `and c."chargeType" = '${chargeType}'` : ``}
      order by c."createdAt" DESC
      limit :limit offset :offset
    `;
  }

  const charges = await db.sequelize.query(query, {
    raw: true,
    type: db.Sequelize.QueryTypes.SELECT,
    replacements: {
      buildingId: params.buildingId,
      limit,
      offset,
    },
  });

  for (let charge of charges) {
    charge.chargeType = CHARGE_TYPES[charge.chargeType][`charge_${language}`];
  }

  return charges;
};
const getChargeListsByProperty = async (
  params = {},
  query,
  { limit, offset },
  language = LANGUAGES.EN
) => {
  const { status, chargeType } = query;

  if (status === "paid") {
    query = `
      select c.*, p.*, f.name_en as flatName_en, f.name_ar as flatName_ar,
      b.name_en as "buildingName_en", b.name_ar as "buildingName_ar"
      from charges c
      left join (
        select Distinct ON("chargeId") "payStatus", "chargeId", id as "paymentId"
        from payments
        order by "chargeId", "createdAt" DESC
      ) as p on p."chargeId" = c.id
      join flats f on f."id" = c."flatId"
      join buildings b on b.id = f."buildingId"
      where b."propertyId" = :propertyId
      ${chargeType ? `and c."chargeType" = '${chargeType}'` : ``}
      and (p."payStatus" = '${
        PAYMENT_STATUSES.COMPLETED.key
      }' or p."payStatus" = '${PAYMENT_STATUSES.PENDING.key}')
      order by c."createdAt" DESC
      limit :limit offset :offset
    `;
  } else if (status === "unpaid") {
    query = `
      select c.*, p.*, f.name_en as flatName_en, f.name_ar as flatName_ar,
      b.name_en as "buildingName_en", b.name_ar as "buildingName_ar"
      from charges c
      left join (
        select Distinct on("chargeId") "payStatus", "chargeId", id as "paymentId"
        from payments
        order by "chargeId", "createdAt" DESC
      ) as p on p."chargeId" = c.id
      join flats f on f."id" = c."flatId"
      join buildings b on b.id = f."buildingId"
      where b."propertyId" = :propertyId
      ${chargeType ? `and c."chargeType" = '${chargeType}'` : ``}
      and (p."payStatus" = '${
        PAYMENT_STATUSES.FAILED.key
      }' or p."payStatus" is null)
      order by c."createdAt" DESC
      limit :limit offset :offset
    `;
  } else {
    query = `
      select c.*, p.*, f.name_en as flatName_en, f.name_ar as flatName_ar,
      b.name_en as "buildingName_en", b.name_ar as "buildingName_ar"
      from charges c
      left join (
        select Distinct ON("chargeId") "payStatus", "chargeId", id as "paymentId"
        from payments
        order by "chargeId", "createdAt" DESC
      ) as p on p."chargeId" = c.id
      join flats f on f."id" = c."flatId"
      join buildings b on b.id = f."buildingId"
      where b."propertyId" = :propertyId
      ${chargeType ? `and c."chargeType" = '${chargeType}'` : ``}
      order by c."createdAt" DESC
      limit :limit offset :offset
    `;
  }

  const charges = await db.sequelize.query(query, {
    raw: true,
    type: db.Sequelize.QueryTypes.SELECT,
    replacements: {
      propertyId: params.propertyId,
      limit,
      offset,
    },
  });

  for (let charge of charges) {
    charge.chargeType = CHARGE_TYPES[charge.chargeType][`charge_${language}`];
  }

  return charges;
};

module.exports = {
  createNewCharge,
  getChargeLists,
  getChargeTypes,
  getChargeDetail,
  getChargePaymentDetails,
  getTotalAmount,
  getTotalCollectedAmount,
  getChargeListsByBuilding,
  createChargesByBuilding,
  getChargeListsByProperty,
};
