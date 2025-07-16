const Notice = require("../models/Notice");
const {
  isValidDateTime,
  getDateTimeObjectFromTimezone,
} = require("../../utils/utility");
const { AppError } = require("../../utils/errorHandler");
const ReadNotice = require("../models/ReadNotice");
const Building = require("../../building-service/models/Building");
const { Op } = require("sequelize");
const {
  NOTICE_CATEGORIES,
  TIMEZONES,
  NOTICE_TARGET,
  NOTICE_STATUSES,
} = require("../../config/constants");
const NoticeBuilding = require("../models/NoticeBuilding");
const Administrator = require("../../admin-service/models/Admin");
const db = require("../../database");

const getNotices = async (params = {}, { limit, offset }, timezone) => {
  const query = `
  select n.*,
  a.id as "admin.id", a.name as "admin.name", a.email as "admin.email", a."mobileNumber" as "admin.mobileNumber",
  case when rn.id is null then false else true end as "isRead"
  from notices n
  join notice_buildings nb on (nb."noticeId" = n.id and nb."deletedAt" is null)
  join buildings b on (b.id = nb."buildingId" and b."deletedAt" is null)
  join flats f on (f."buildingId" = b.id and f."deletedAt" is null and f.id = :flatId)
  left join administrators a on (a.id = n."postedBy" and a."deletedAt" is null)
  left join read_notices rn on (rn."noticeId" = n.id and rn."residentId" = :userId and rn."deletedAt" is null)
  where n."deletedAt" is null and :now between n."validFrom" and n."validTill" and :noticeTarget = ANY(n."targetUser")
  order by "isRead" ASC, n."createdAt" desc limit :limit offset :offset`;
  const notices = await db.sequelize.query(query, {
    type: db.Sequelize.QueryTypes.SELECT,
    raw: true,
    nest: true,
    replacements: {
      flatId: params.flatId,
      now: new Date(),
      userId: params.userId,
      limit,
      offset,
      noticeTarget: NOTICE_TARGET.RESIDENT,
    },
  });
  return notices;
};

const createNotice = async (data, timezone = TIMEZONES.UAE) => {
  const reference = "createNotice";
  if (!data.title || !data.category || !data.buildings) {
    throw new AppError(
      reference,
      "Title, buildings and category are required",
      "custom",
      412
    );
  }
  if (!Array.isArray(data.buildings) || !data.buildings.length) {
    throw new AppError(reference, "Invalid buildings", "custom", 412);
  }
  if (!Object.values(NOTICE_CATEGORIES).includes(data.category)) {
    throw new AppError(
      reference,
      `Category can only be ${Object.values(NOTICE_CATEGORIES).join(", ")}`,
      "custom",
      412
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

  if (
    data.validTill &&
    isValidDateTime(data.validTill) &&
    isValidDateTime(data.validTill) < new Date()
  ) {
    throw new AppError(
      reference,
      "Expiry time cannot be less than current time",
      "custom",
      412
    );
  }
  if (
    data.actionDeadline &&
    isValidDateTime(data.actionDeadline) &&
    isValidDateTime(data.actionDeadline) < new Date()
  ) {
    throw new AppError(
      reference,
      "Deadline cannot be less than current time",
      "custom",
      412
    );
  }

  data.validFrom &&
    (data.validFrom = getDateTimeObjectFromTimezone(data.validFrom, timezone));
  data.validTill &&
    (data.validTill = getDateTimeObjectFromTimezone(data.validTill, timezone));
  data.actionDeadline &&
    (data.actionDeadline = getDateTimeObjectFromTimezone(
      data.actionDeadline,
      timezone
    ));

  if (data.targetUser && !Array.isArray(data.targetUser)) {
    throw new AppError(reference, `Invalid target user`, "custom", 412);
  } //TODO: add target user validation

  const notice = await Notice.create(data);
  if (notice) {
    const noticeBuildings = data.buildings.map((building) => {
      //TODO: validate if admin has selected building access
      return {
        buildingId: building,
        noticeId: notice.id,
      };
    });
    await NoticeBuilding.bulkCreate(noticeBuildings);
  }
  return null;
};

const findNotice = async (id) => {
  const checkNotice = await Notice.findOne({
    where: { id },
    include: [
      {
        model: Administrator,
        as: "admin",
        attributes: ["id", "name"],
      },
      {
        model: NoticeBuilding,
        as: "noticeBuildings",
        required: false,
        attributes: ["id", "buildingId"],
        include: {
          model: Building,
          as: "building",
          required: true,
          attributes: ["name_en", "name_ar"],
        },
      },
    ],
  });
  if (!checkNotice) {
    throw new AppError("findNotice", "Could not find notice");
  }
  return checkNotice;
};

const addReadNotice = async (userId, noticeId) => {
  const findNotice = await Notice.findByPk(noticeId);
  if (!findNotice) {
    throw new AppError("addReadNotice", "Notice not found");
  }
  let requestBody = {};
  requestBody.residentId = userId;
  requestBody.noticeId = noticeId;
  const newReadNotice = await ReadNotice.findOrCreate({ where: requestBody });
  return newReadNotice[0];
};

async function getPropertyNotices(params, { limit, offset }) {
  const reference = `getPropertyNotices`;
  const noticeParams = {};
  if (params.title) {
    noticeParams.title = {
      [Op.iLike]: `%${params.title}%`,
    };
  } else if (params.description) {
    noticeParams.description = {
      [Op.iLike]: `%${params.description}%`,
    };
  }
  if (
    params.status &&
    !Object.values(NOTICE_STATUSES).includes(params.status)
  ) {
    throw new AppError(
      reference,
      `Notice status can only be ${Object.values(NOTICE_STATUSES).join(", ")}`,
      "custom",
      412
    );
  }
  if (params.status && params.status === NOTICE_STATUSES.ACTIVE) {
    noticeParams.validFrom = {
      [Op.lte]: new Date(),
    };
    noticeParams.validTill = {
      [Op.gte]: new Date(),
    };
  }

  if (params.status && params.status === NOTICE_STATUSES.IN_ACTIVE) {
    noticeParams.validTill = {
      [Op.lt]: new Date(),
    };
  }

  if (params.status && params.status === NOTICE_STATUSES.FUTURE) {
    noticeParams.validFrom = {
      [Op.gt]: new Date(),
    };
  }
  if (params.noticeType) {
    noticeParams.category = {
      [Op.eq]: params.noticeType,
    };
  }
  if (params.noticeFor) {
    noticeParams.targetUser = {
      [Op.contains]: [params.noticeFor],
    };
  }
  if (params.validFrom) {
    noticeParams.validFrom = {
      [Op.gte]: params.validFrom,
    };
  }
  if (params.validTill) {
    noticeParams.validTill = {
      [Op.lte]: params.validTill,
    };
  }

  delete params.title;
  delete params.description;

  const count = await Notice.count({
    distinct: true,
    where: noticeParams,
    order: [["createdAt", "DESC"]],
    offset,
    limit,
    include: [
      {
        model: NoticeBuilding,
        as: "noticeBuildings",
        required: true,
        attributes: ["id", "buildingId"],
        include: [
          {
            model: Building,
            as: "building",
            where: {
              propertyId: params.propertyId,
            },
            attributes: ["name_en", "name_ar"],
          },
        ],
      },
    ],
  });

  const rows = await Notice.findAll({
    distinct: true,
    where: noticeParams,
    order: [["createdAt", "DESC"]],
    offset,
    limit,
    include: [
      {
        model: NoticeBuilding,
        as: "noticeBuildings",
        attributes: ["id", "buildingId"],

        include: [
          {
            model: Building,
            as: "building",
            where: {
              propertyId: params.propertyId,
            },
            attributes: ["name_en", "name_ar"],
          },
        ],
      },
    ],
  });
  return { count, rows };
}

async function getBuildingNotices(params, { limit, offset }) {
  const reference = `getPropertyNotices`;
  const noticeParams = {};
  if (params.title) {
    noticeParams.title = {
      [Op.iLike]: `%${params.title}%`,
    };
    delete params.title;
  } else if (params.description) {
    noticeParams.description = {
      [Op.iLike]: `%${params.description}%`,
    };
    delete params.description;
  }
  if (
    params.status &&
    !Object.values(NOTICE_STATUSES).includes(params.status)
  ) {
    throw new AppError(
      reference,
      `Notice status can only be ${Object.values(NOTICE_STATUSES).join(", ")}`,
      "custom",
      412
    );
  }
  if (params.status && params.status === NOTICE_STATUSES.ACTIVE) {
    noticeParams.validFrom = {
      [Op.lte]: new Date(),
    };
    noticeParams.validTill = {
      [Op.gte]: new Date(),
    };
  }

  if (params.status && params.status === NOTICE_STATUSES.IN_ACTIVE) {
    noticeParams.validTill = {
      [Op.lt]: new Date(),
    };
  }

  if (params.status && params.status === NOTICE_STATUSES.FUTURE) {
    noticeParams.validFrom = {
      [Op.gt]: new Date(),
    };
  }

  return await Notice.findAndCountAll({
    distinct: true,
    where: noticeParams,
    order: [["createdAt", "DESC"]],
    offset,
    limit,
    include: {
      model: NoticeBuilding,
      as: "noticeBuildings",
      where: {
        buildingId: params.buildingId,
      },
      attributes: ["id", "buildingId"],
      include: {
        model: Building,
        as: "building",
        attributes: ["name_en", "name_ar"],
      },
    },
  });
}

async function updateNotice(data, timezone = TIMEZONES.UAE) {
  const reference = "updateNotice";
  const notice = await findNotice(data.id);
  if (!notice) {
    throw new AppError("updateNotice", "Notice not found", "custom", 404);
  }
  if (data.buildings && !Array.isArray(data.buildings)) {
    throw new AppError(
      "updateNotice",
      "Enter buildings in valid format",
      "custom",
      412
    );
  }

  if (
    data.validTill &&
    isValidDateTime(data.validTill) &&
    isValidDateTime(data.validTill) < new Date()
  ) {
    throw new AppError(
      reference,
      "Expiry time cannot be less than current time",
      "custom",
      412
    );
  }
  if (
    data.actionDeadline &&
    isValidDateTime(data.actionDeadline) &&
    isValidDateTime(data.actionDeadline) < new Date()
  ) {
    throw new AppError(
      reference,
      "Deadline cannot be less than current time",
      "custom",
      412
    );
  }

  data.validFrom &&
    (data.validFrom = getDateTimeObjectFromTimezone(data.validFrom, timezone));
  data.validTill &&
    (data.validTill = getDateTimeObjectFromTimezone(data.validTill, timezone));
  data.actionDeadline &&
    (data.actionDeadline = getDateTimeObjectFromTimezone(
      data.actionDeadline,
      timezone
    ));
  const noticeId = data.id;
  delete data.id;
  for (const key in data) {
    notice[key] = data[key];
  }

  if (data.buildings) {
    const buildingsToKeep = [];
    await Promise.all(
      data.buildings.map(async (buildingId) => {
        const [noticeBuilding, created] = await NoticeBuilding.findOrCreate({
          where: {
            noticeId,
            buildingId,
          },
          paranoid: false,
        });
        if (!created && noticeBuilding.deletedAt) {
          await noticeBuilding.restore();
        }
        buildingsToKeep.push(noticeBuilding.buildingId);
      })
    );
    await NoticeBuilding.destroy({
      where: {
        noticeId,
        buildingId: {
          [Op.notIn]: buildingsToKeep,
        },
      },
    });
  }
  await notice.save();
  return null;
}

async function deleteNotice(params) {
  const notice = await findNotice(params.id);
  await notice.destroy();
}

module.exports = {
  getNotices,
  createNotice,
  findNotice,
  addReadNotice,
  getPropertyNotices,
  getBuildingNotices,
  updateNotice,
  deleteNotice,
};
