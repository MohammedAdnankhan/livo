const Administrator = require("../../admin-service/models/Admin");
const {
  PPM_TYPES,
  PPM_PRIORITIES,
  PPM_FREQUENCIES,
  PPM_FREQUENCY_TYPES,
} = require("../../config/constants");
const { AppError } = require("../../utils/errorHandler");
const {
  isValidDateTime,
  getDateTimeObject,
  validateCron,
} = require("../../utils/utility");
const PreventativeMaintenance = require("../models/PreventativeMaintenance");
const moment = require("moment-timezone");
const logger = require("../../utils/logger");
const PreventativeSchedule = require("../models/PreventativeSchedule");
const Asset = require("../../asset-service/models/Asset");
const Flat = require("../../flat-service/models/Flat");
const Building = require("../../building-service/models/Building");
const db = require("../../database");
const { Op } = require("sequelize");
const { getAsset } = require("../../asset-service/controllers/asset");
const { getBuilding } = require("../../building-service/controllers/building");
const { getFlat } = require("../../flat-service/controllers/flat");

const createPreventativeMaintenance = async (data) => {
  const reference = "createPreventativeMaintenance";
  if (!data.name || !data.type || !data.typeId || !data.priority) {
    throw new AppError(reference, "Required fields are empty", "custom", 412);
  }

  if (!data.frequencyType) {
    throw new AppError(reference, "Frequency Type is required", "custom", 412);
  }

  if (!Object.values(PPM_FREQUENCY_TYPES).includes(data.frequencyType)) {
    throw new AppError(
      reference,
      `Frequency type can only be ${Object.values(PPM_FREQUENCY_TYPES).join(
        ", "
      )}`
    );
  }

  if (data.documents && !Array.isArray(data.documents)) {
    throw new AppError(
      reference,
      "Enter documents in valid format",
      "custom",
      412
    );
  }

  if (!Object.values(PPM_TYPES).includes(data.type)) {
    throw new AppError(
      reference,
      `Type can only be ${Object.values(PPM_TYPES).join(", ")}`,
      "custom",
      412
    );
  }

  if (!Object.values(PPM_PRIORITIES).includes(data.priority)) {
    throw new AppError(
      reference,
      `Priority can only be ${Object.values(PPM_PRIORITIES).join(", ")}`,
      "custom",
      412
    );
  }

  const [ppmFromName, ppmFromTypeAndId] = await Promise.all([
    getPreventativeMaintenance({ name: data.name }),
    getPreventativeMaintenance({ type: data.type, typeId: data.typeId }),
  ]);

  if (ppmFromName) {
    throw new AppError(reference, "Name already exists", "custom", 412);
  }

  if (ppmFromTypeAndId) {
    throw new AppError(
      reference,
      "Schedule exists for selected Asset/Property/Unit",
      "custom",
      412
    );
  }

  //validate typeId
  switch (data.type) {
    case PPM_TYPES.ASSET:
      if (!(await getAsset({ id: data.typeId }))) {
        throw new AppError(reference, "Asset not found", "custom", 404);
      }
      break;
    case PPM_TYPES.BUILDING:
      if (!(await getBuilding({ id: data.typeId }))) {
        throw new AppError(reference, "Building not found", "custom", 404);
      }
      break;
    case PPM_TYPES.FLAT:
      if (!(await getFlat({ id: data.typeId }))) {
        throw new AppError(reference, "Flat not found", "custom", 404);
      }
      break;

    default:
      throw new AppError(
        reference,
        "Selected type does not exist",
        "custom",
        412
      );
  }
  let schedule = [];

  if (data.frequencyType == PPM_FREQUENCY_TYPES.CUSTOM) {
    if (!data.schedules) {
      throw new AppError(
        reference,
        "Schedule is required in case of custom frequency type"
      );
    }
    if (!Array.isArray(data.schedules) || !data.schedules?.length) {
      throw new AppError(reference, "Invalid schedule format", "custom", 412);
    }
    let validFrom = new Date(data.schedules[0].runDate),
      validTill = new Date();
    data.schedules.map((scheduleObj) => {
      if (
        !scheduleObj.startTime ||
        !scheduleObj.endTime ||
        !scheduleObj.runDate
      ) {
        throw new AppError(
          reference,
          "Some of the required fields in schedule is missing",
          "custom",
          412
        );
      }
      if (getDateTimeObject(scheduleObj.runDate) < new Date()) {
        throw new AppError(
          reference,
          "Selected date cannot be less than current date",
          "custom",
          412
        );
      }

      schedule.push({
        startTime: new Date(
          `${moment(scheduleObj.runDate).format("YYYY-MM-DD")} ${moment(
            scheduleObj.startTime
          ).format("hh:mm:ss a")}`
        ),
        endTime: new Date(
          `${moment(scheduleObj.runDate).format("YYYY-MM-DD")} ${moment(
            scheduleObj.endTime
          ).format("hh:mm:ss a")}`
        ),
      });
      if (validFrom > new Date(scheduleObj.runDate)) {
        validFrom = new Date(scheduleObj.runDate);
      }
      if (validTill < new Date(scheduleObj.runDate)) {
        validTill = new Date(scheduleObj.runDate);
      }
    });
    data.validFrom = validFrom;
    data.validTill = validTill;
    delete data.cron;
    delete data.frequency;
  } else {
    //TODO: add as else if and throw error in else
    if (!data.cron) {
      throw new AppError(reference, "Pattern is required", "custom", 412);
    }
    if (!data.startTime || !data.endTime) {
      throw new AppError(reference, "Job timing is required", "custom", 412);
    }
    if (!data.validFrom || !data.validTill) {
      throw new AppError(reference, "Time frame is required", "custom", 412);
    }
    if (
      !data.frequency ||
      !Object.values(PPM_FREQUENCIES).includes(data.frequency)
    ) {
      throw new AppError(
        reference,
        `Frequency can only be ${Object.values(PPM_FREQUENCIES).join(", ")}`,
        "custom",
        412
      );
    }

    validateCron(data.cron, data.frequency, reference);
    data.validFrom = getDateTimeObject(data.validFrom);
    data.validTill = getDateTimeObject(data.validTill);

    schedule = calucateScheduleDataFromCron(
      { validFrom: data.validFrom, validTill: data.validTill },
      { startTime: data.startTime, endTime: data.endTime },
      data.cron,
      data.frequency,
      reference
    );

    if (!schedule.length) {
      throw new AppError(
        reference,
        "Cannot schedule any request with selected time frame",
        "custom",
        412
      );
    }
  }

  const ppm = await PreventativeMaintenance.create(data);
  await PreventativeSchedule.bulkCreate(
    schedule.map((timeSlot) => {
      return { ...timeSlot, preventativeMaintenanceId: ppm.id };
    })
  );
  return "PPM created successfully";
};

async function getPreventativeMaintenances(params, { limit, offset }) {
  params[Op.and] = [];
  if (params.search) {
    params[Op.and].push({
      [Op.or]: [
        { name: { [Op.iLike]: `%${params.search}%` } },
        db.sequelize.literal(
          `cast("PreventativeMaintenance"."pmId" as VARCHAR) ilike ` +
            `'%${params.search}%'`
        ),
        db.sequelize.literal(
          `cast("PreventativeMaintenance"."validFrom" as VARCHAR) ilike ` +
            `'%${params.search}%'`
        ),
        db.sequelize.literal(
          `cast("PreventativeMaintenance"."validTill" as VARCHAR) ilike ` +
            `'%${params.search}%'`
        ),
        { description: { [Op.iLike]: `%${params.search}%` } },
        { "$asset.name$": { [Op.iLike]: `%${params.search}%` } },
        { "$flat.name_en$": { [Op.iLike]: `%${params.search}%` } },
        { "$building.name_en$": { [Op.iLike]: `%${params.search}%` } },
        { "$createdBy.name$": { [Op.iLike]: `%${params.search}%` } },
      ],
    });
  }
  delete params.search;
  if (params.buildingId) {
    params[Op.and].push({
      [Op.or]: [
        { "$asset->flat.buildingId$": params.buildingId },
        { "$building.id$": params.buildingId },
        { "$asset->building.id$": params.buildingId },
        { "$flat.buildingId$": params.buildingId },
      ],
    });
    delete params.buildingId;
  }
  return await PreventativeMaintenance.findAndCountAll({
    where: params,
    distinct: true,
    order: [["createdAt", "DESC"]],
    limit,
    offset,
    include: [
      {
        model: Administrator,
        as: "createdBy",
        attributes: ["id", "name", "profilePicture"],
      },
      {
        model: Asset,
        as: "asset",
        attributes: ["id", "name"],
        include: [
          {
            model: Flat,
            as: "flat",
            attributes: [],
          },
          { model: Building, as: "building", attributes: [] },
        ],
      },
      {
        model: Flat,
        as: "flat",
        attributes: ["id", "name_en", "name_ar"],
        required: false,
      },
      {
        model: Building,
        as: "building",
        attributes: ["id", "name_en", "name_ar"],
        required: false,
      },
      {
        model: PreventativeSchedule,
        as: "preventativeSchedule",
        attributes: ["startTime", "endTime"],
        limit: 1,
      },
    ],
    attributes: {
      include: [
        [
          db.sequelize.literal(
            `CASE WHEN "PreventativeMaintenance".cron is NULL THEN '${PPM_FREQUENCY_TYPES.CUSTOM}' ELSE '${PPM_FREQUENCY_TYPES.PATTERN}' END`
          ),
          "frequencyType",
        ],
      ],
      exclude: ["propertyId"],
    },
  });
}

async function getPreventativeMaintenance(params) {
  return await PreventativeMaintenance.findOne({
    where: params,
  });
}

async function getPreventativeMaintenaceDetail(params) {
  const ppm = await PreventativeMaintenance.findOne({
    where: params,
    include: [
      {
        model: Administrator,
        as: "createdBy",
        attributes: ["id", "name", "profilePicture"],
      },
      {
        model: Asset,
        as: "asset",
        attributes: [
          "id",
          "name",
          [
            db.sequelize.literal(
              `CASE WHEN "asset"."flatId" IS NULL THEN false ELSE true END`
            ),
            "isForFlat",
          ],
        ],
        required: false,
        include: [
          {
            model: Flat,
            as: "flat",
            required: false,
            attributes: ["id", "name_en", "name_ar", "buildingId"],
            include: {
              model: Building,
              as: "building",
              required: true,
              attributes: ["id", "name_en", "name_ar"],
              where: {
                propertyId: params.propertyId,
              },
            },
          },
          {
            model: Building,
            as: "building",
            required: false,
            attributes: ["id", "name_en", "name_ar"],
            where: {
              propertyId: params.propertyId,
            },
          },
        ],
      },
      // {
      //   model: Flat,
      //   as: "flat",
      //   attributes: ["id", "name_en", "name_ar"],
      //   required: false,
      // },
      // {
      //   model: Building,
      //   as: "building",
      //   attributes: ["id", "name_en", "name_ar"],
      //   required: false,
      // },
      {
        model: PreventativeSchedule,
        as: "preventativeSchedule",
        attributes: ["scheduleId", "startTime", "endTime"],
        order: [["startTime", "ASC"]],
      },
    ],
    attributes: {
      include: [
        [
          db.sequelize.literal(
            `CASE WHEN "PreventativeMaintenance".cron is NULL THEN '${PPM_FREQUENCY_TYPES.CUSTOM}' ELSE '${PPM_FREQUENCY_TYPES.PATTERN}' END`
          ),
          "frequencyType",
        ],
      ],
      exclude: ["propertyId"],
    },
  });
  if (!ppm) {
    throw new AppError(reference, "PPM not found", "custom", 412);
  }
  return ppm;
}

async function updatePreventativeMaintenance(params, data) {
  const reference = "updatePreventativeMaintenance";
  const ppm = await getPreventativeMaintenance(params);
  if (!ppm) {
    throw new AppError(reference, "PPM not found", "custom", 404);
  }
  if (data.documents) {
    if (!Array.isArray(data.documents)) {
      throw new AppError(
        reference,
        "Enter documents in valid format",
        "custom",
        412
      );
    }
    ppm.documents = data.documents;
  }
  if (data.name) {
    if (
      await getPreventativeMaintenance({
        name: data.name,
        id: { [Op.ne]: ppm.id },
      })
    ) {
      throw new AppError(
        reference,
        "Mentioned name already exists",
        "custom",
        412
      );
    }
    ppm.name = data.name;
  }
  if (data.priority && !Object.values(PPM_PRIORITIES).includes(data.priority)) {
    throw new AppError(
      reference,
      `Priority can only be ${Object.values(PPM_PRIORITIES).join(", ")}`,
      "custom",
      412
    );
  }
  data.priority && (ppm.priority = data.priority);

  data.description && (ppm.description = data.description);

  data.category && (ppm.category = data.category);

  if (data.frequencyType) {
    if (!Object.values(PPM_FREQUENCY_TYPES).includes(data.frequencyType)) {
      throw new AppError(reference, "Invalid frequency type", "custom", 412);
    }
    let schedule = [];
    if (data.frequencyType == PPM_FREQUENCY_TYPES.CUSTOM) {
      if (!data.schedules) {
        throw new AppError(
          reference,
          "Schedule is required in case of custom frequency type"
        );
      }
      if (!Array.isArray(data.schedules) || !data.schedules?.length) {
        throw new AppError(reference, "Invalid schedule format", "custom", 412);
      }
      let validFrom = new Date(data.schedules[0].runDate),
        validTill = new Date();
      data.schedules.map((scheduleObj) => {
        if (
          !scheduleObj.startTime ||
          !scheduleObj.endTime ||
          !scheduleObj.runDate
        ) {
          throw new AppError(
            reference,
            "Some of the required fields in schedule is missing",
            "custom",
            412
          );
        }
        if (getDateTimeObject(scheduleObj.runDate) < new Date()) {
          throw new AppError(
            reference,
            "Selected date cannot be less than current date",
            "custom",
            412
          );
        }

        schedule.push({
          startTime: new Date(
            `${moment(scheduleObj.runDate).format("YYYY-MM-DD")} ${moment(
              scheduleObj.startTime
            ).format("hh:mm:ss a")}`
          ),
          endTime: new Date(
            `${moment(scheduleObj.runDate).format("YYYY-MM-DD")} ${moment(
              scheduleObj.endTime
            ).format("hh:mm:ss a")}`
          ),
        });
        if (validFrom > new Date(scheduleObj.runDate)) {
          validFrom = new Date(scheduleObj.runDate);
        }
        if (validTill < new Date(scheduleObj.runDate)) {
          validTill = new Date(scheduleObj.runDate);
        }
      });
      ppm.validFrom = validFrom;
      ppm.validTill = validTill;
      ppm.cron = null;
      ppm.frequency = null;
    } else {
      if (!data.cron) {
        throw new AppError(reference, "Pattern is required", "custom", 412);
      }
      if (!data.startTime || !data.endTime) {
        throw new AppError(reference, "Job timing is required", "custom", 412);
      }
      if (!data.validFrom || !data.validTill) {
        throw new AppError(reference, "Time frame is required", "custom", 412);
      }
      if (
        !data.frequency ||
        !Object.values(PPM_FREQUENCIES).includes(data.frequency)
      ) {
        throw new AppError(
          reference,
          `Frequency can only be ${Object.values(PPM_FREQUENCIES).join(", ")}`,
          "custom",
          412
        );
      }

      validateCron(data.cron, data.frequency, reference);
      data.validFrom = getDateTimeObject(data.validFrom);
      data.validTill = getDateTimeObject(data.validTill);

      schedule = calucateScheduleDataFromCron(
        { validFrom: data.validFrom, validTill: data.validTill },
        { startTime: data.startTime, endTime: data.endTime },
        data.cron,
        data.frequency,
        reference
      );

      if (!schedule.length) {
        throw new AppError(
          reference,
          "Cannot schedule any request with selected time frame",
          "custom",
          412
        );
      }
      ppm.validFrom = data.validFrom;
      ppm.validTill = data.validTill;
      ppm.cron = data.cron;
      ppm.frequency = data.frequency;
    }
    await Promise.all([
      PreventativeSchedule.destroy({
        where: { preventativeMaintenanceId: ppm.id },
      }),
      PreventativeSchedule.bulkCreate(
        schedule.map((timeSlot) => {
          return { ...timeSlot, preventativeMaintenanceId: ppm.id };
        })
      ),
    ]);
  }
  await ppm.save();
  return "PPM updated successfully";
}

async function getPpmCategories(params) {
  const categories = await PreventativeMaintenance.findAll({
    where: params,
    attributes: [
      [db.Sequelize.fn("DISTINCT", db.Sequelize.col("category")), "category"],
    ],
  });
  return categories
    .map((category) => category.category)
    .filter((category) => category);
}

function calucateScheduleDataFromCron(
  { validFrom, validTill },
  { startTime, endTime },
  cron,
  frequency,
  reference = "calucateScheduleFromCron"
) {
  if (validFrom >= validTill) {
    throw new AppError(
      reference,
      "Valid From cannot be greater than Valid Till",
      "custom",
      412
    );
  }
  if (startTime >= endTime) {
    throw new AppError(
      reference,
      "Start time cannot be greater than End time",
      "custom",
      412
    );
  }

  validFromMomentObj = moment(validFrom);
  validTillMomentObj = moment(validTill);
  const schedule = [];
  switch (frequency) {
    case PPM_FREQUENCIES.DAILY:
      while (validFromMomentObj <= validTillMomentObj) {
        if (
          new Date() <
          new Date(
            `${validFromMomentObj.format("YYYY-MM-DD")} ${moment(
              startTime
            ).format("hh:mm:ss a")}`
          )
        ) {
          schedule.push({
            startTime: new Date(
              `${validFromMomentObj.format("YYYY-MM-DD")} ${moment(
                startTime
              ).format("hh:mm:ss a")}`
            ),
            endTime: new Date(
              `${validFromMomentObj.format("YYYY-MM-DD")} ${moment(
                endTime
              ).format("hh:mm:ss a")}`
            ),
          });
        }
        validFromMomentObj.add(1, "d");
      }
      break;
    case PPM_FREQUENCIES.MONTHLY:
      const date = +cron[3]; //extract day of month
      const monthJump = +cron[4].split("/")[1]; //extract month frequency

      while (validFromMomentObj <= validTillMomentObj) {
        if (
          new Date() <
          new Date(
            `${validFromMomentObj.set({ date }).format("YYYY-MM-DD")} ${moment(
              startTime
            ).format("hh:mm:ss a")}`
          )
        ) {
          schedule.push({
            startTime: new Date(
              `${validFromMomentObj
                .set({ date })
                .format("YYYY-MM-DD")} ${moment(startTime).format(
                "hh:mm:ss a"
              )}`
            ),
            endTime: new Date(
              `${validFromMomentObj
                .set({ date })
                .format("YYYY-MM-DD")} ${moment(endTime).format("hh:mm:ss a")}`
            ),
          });
        }
        validFromMomentObj.add(Number(monthJump), "month");
      }
      break;
    case PPM_FREQUENCIES.YEARLY:
      const day = +cron[3];
      const month = +cron[4] - 1; //convert to 0 index for moment conversion
      while (validFromMomentObj <= validTillMomentObj) {
        if (
          new Date() <
          new Date(
            `${validFromMomentObj
              .set({ date: day, month })
              .format("YYYY-MM-DD")} ${moment(startTime).format("hh:mm:ss a")}`
          )
        ) {
          schedule.push({
            startTime: new Date(
              `${validFromMomentObj
                .set({ date: day, month })
                .format("YYYY-MM-DD")} ${moment(startTime).format(
                "hh:mm:ss a"
              )}`
            ),
            endTime: new Date(
              `${validFromMomentObj
                .set({ date: day, month })
                .format("YYYY-MM-DD")} ${moment(endTime).format("hh:mm:ss a")}`
            ),
          });
        }
        validFromMomentObj.add(1, "year");
      }
      break;
    case PPM_FREQUENCIES.WEEKLY:
      const weekDays = cron[5].split(",");
      while (validFromMomentObj <= validTillMomentObj) {
        weekDays.map((day) => {
          if (new Date() < new Date(`${validFromMomentObj.day(+day - 1)}`)) {
            schedule.push({
              startTime: new Date(
                `${validFromMomentObj
                  .day(+day - 1)
                  .format("YYYY-MM-DD")} ${moment(startTime).format(
                  "hh:mm:ss a"
                )}`
              ),
              endTime: new Date(
                `${validFromMomentObj
                  .day(+day - 1)
                  .format("YYYY-MM-DD")} ${moment(endTime).format(
                  "hh:mm:ss a"
                )}`
              ),
            });
          }
        });
        validFromMomentObj.add(7, "d");
      }
      break;
    default:
      logger.error(`No case matched for PPM frequency`);
      throw new AppError(
        reference,
        "No case matched for PPM frequency",
        "custom",
        412
      );
  }
  return schedule;
}

module.exports = {
  createPreventativeMaintenance,
  getPreventativeMaintenance,
  getPreventativeMaintenances,
  getPreventativeMaintenaceDetail,
  getPpmCategories,
  updatePreventativeMaintenance,
};
