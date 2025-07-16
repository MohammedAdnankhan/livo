const moment = require("moment-timezone");
const { Op } = require("sequelize");
const {
  LANGUAGES,
  COMMON_DATE_FORMAT,
  ACTION_TYPES,
  SOURCE_TYPES,
  VISITOR_CATEGORIES,
  VISITOR_STATUSES,
  TIMEZONES,
  PROPERTY_INTERESTED_IN,
  VIEWING_SOURCES,
  PURCHASE_PURPOSES,
  WALK_IN_SOURCES,
  PROPERTY_TYPE,
  POSSESSION_TIMELINE,
  INDICATIVE_BUDGET,
  PRODUCTS,
  VISITING_STATUSES,
} = require("../../config/constants");
const nationalities = require("../data/nationality.json");
const db = require("../../database");
const {
  getFlatAddress,
  getFlatWithBuilding,
} = require("../../flat-service/controllers/flat");
const { getUser } = require("../../user-service/controllers/user");
const User = require("../../user-service/models/User");
const { AppError } = require("../../utils/errorHandler");
const eventEmitter = require("../../utils/eventEmitter");
const logger = require("../../utils/logger");
const {
  getDateTimeObjectFromTimezone,
  generateVisitoCode,
  enableDateSearch,
} = require("../../utils/utility");
const {
  VISITOR_TYPE_LANGUAGE_VARS,
  VISITOR_TYPE_LANGUAGE_KEYS,
} = require("../../visitor-service/configs/constants");
const {
  getVisitorType,
} = require("../../visitor-service/controllers/visitorType");
const Visitor = require("../../visitor-service/models/Visitor");
const VisitorType = require("../../visitor-service/models/VisitorType");
const PreapprovedVisiting = require("../models/PreapprovedVisiting");
const VisitorVisiting = require("../models/VisitorVisiting");
const VisitorVisitingStatus = require("../models/VisitorVisitingStatus");
const visitorController = require("./../../visitor-service/controllers/visitor");
const visitingStatusController = require("./visitingStatus");
const {
  getPropertyFeature,
  getPropertyFromFlat,
} = require("../../property-service/controllers/property");
const Building = require("../../building-service/models/Building");

const Flat = require("../../flat-service/models/Flat");

async function createPreApprovedGuest(data, timezone, language = LANGUAGES.EN) {
  let inTime, outTime;

  inTime = getDateTimeObjectFromTimezone(data.inTime, timezone);
  outTime = data.approvalDuration
    ? moment(inTime).add(data.approvalDuration, "hours").toDate()
    : getDateTimeObjectFromTimezone(data.outTime, timezone);

  if (!data.approvalDuration) {
    outTime = moment(outTime).tz(timezone).endOf("day").toDate();
  }

  validatePreapprovedDates({ inTime, outTime }, timezone);

  const t = await db.sequelize.transaction();
  try {
    if (!data.name)
      throw new AppError("createPreApprovedGuest", "Vistor name is required");

    // 1. create visitor if not exist
    const visitor = await visitorController.addOrUpdate(data, t);

    // 2. Create entry in visitor_visitings table
    const visitingData = {
      visitorsCount: data.visitorsCount,
      visitorId: visitor.id,
      flatId: data.flatId,
      visitorTypeId: data.visitorTypeId,
      residentId: data.userId,
      name: data.name,
      metaData: data.metaData,
    };
    const visiting = await VisitorVisiting.create(visitingData, {
      transaction: t,
    });

    // 3. create entry in preapproved_visitors table
    const preapprovedVisitingData = {
      inTime,
      outTime,
      isFrequent: data.isFrequent,
    };

    preapprovedVisitingData.visitorCode = generateVisitoCode();

    const preapprovedVisiting = await PreapprovedVisiting.create(
      preapprovedVisitingData,
      { transaction: t }
    );

    // 4. update the preapprovedId in visitor_visitings table
    visiting.preapprovedId = preapprovedVisiting.id;
    await visiting.save({ transaction: t });

    await t.commit();

    // eventEmitter.emit(
    //   "schedule_notification",
    //   {
    //     actionType: ACTION_TYPES.ABOUT_TO_ARRIVE.key,
    //     sourceType: SOURCE_TYPES.VISITING,
    //     sourceId: visiting.id,
    //     generatedBy: null,
    //     generatedFor: visiting.residentId,
    //   },
    //   moment().add(30, "seconds").toDate()
    //   // moment(inTime).subtract(2, "minutes").toDate()
    // );

    return await getPreapprovedVisitingShareInfo(
      {
        id: visiting.id,
      },
      timezone,
      language
    );
  } catch (error) {
    console.log(error);
    await t.rollback();
    throw error;
  }
}

async function createPreApprovedGuestNew(
  data,
  timezone,
  language = LANGUAGES.EN
) {
  const reference = "createPreApprovedGuestNew";
  let inTime, outTime;
  const visitorCategory = await VisitorType.findOne({
    where: {
      id: data.visitorTypeId,
      propertyId: data.propertyId,
      isVisible: true,
    },
  });

  if (!visitorCategory) {
    throw new AppError(reference, "Invalid visitor type");
  }
  inTime = getDateTimeObjectFromTimezone(data.inTime, timezone);
  outTime = data.approvalDuration
    ? moment(inTime).add(data.approvalDuration, "hours").toDate()
    : getDateTimeObjectFromTimezone(data.outTime, timezone);

  if (!data.approvalDuration) {
    outTime = moment(outTime).tz(timezone).endOf("day").toDate();
  }

  validatePreapprovedDates({ inTime, outTime }, timezone);

  const t = await db.sequelize.transaction();
  try {
    if (!data.name) throw new AppError(reference, "Visitor name is required");

    // 1. create visitor if not exist
    const visitor = await visitorController.addOrUpdate(data, t);

    // 2. Create entry in visitor_visitings table
    const visitingData = {
      visitorsCount: data.visitorsCount,
      visitorId: visitor.id,
      flatId: data.flatId,
      visitorTypeId: data.visitorTypeId,
      residentId: data.userId,
      name: data.name,
      metaData: data.metaData,
    };
    const visiting = await VisitorVisiting.create(visitingData, {
      transaction: t,
    });

    // 3. create entry in preapproved_visitors table
    const preapprovedVisitingData = {
      inTime,
      outTime,
      isFrequent: data.isFrequent,
    };

    preapprovedVisitingData.visitorCode = generateVisitoCode();

    const preapprovedVisiting = await PreapprovedVisiting.create(
      preapprovedVisitingData,
      { transaction: t }
    );

    // 4. update the preapprovedId in visitor_visitings table
    visiting.preapprovedId = preapprovedVisiting.id;
    await visiting.save({ transaction: t });

    await t.commit();

    // eventEmitter.emit(
    //   "schedule_notification",
    //   {
    //     actionType: ACTION_TYPES.ABOUT_TO_ARRIVE.key,
    //     sourceType: SOURCE_TYPES.VISITING,
    //     sourceId: visiting.id,
    //     generatedBy: null,
    //     generatedFor: visiting.residentId,
    //   },
    //   moment().add(30, "seconds").toDate()
    //   // moment(inTime).subtract(2, "minutes").toDate()
    // );

    return await getPreapprovedVisitingShareInfo(
      {
        id: visiting.id,
      },
      timezone,
      language
    );
  } catch (error) {
    console.log(error);
    await t.rollback();
    throw error;
  }
}

async function createNonGuestPreapprovedVisitings(
  { dataArr, flatId, userId },
  timezone,
  language = LANGUAGES.EN
) {
  const responseArr = [];
  for (const data of dataArr) {
    const t = await db.sequelize.transaction();
    try {
      const inTime = getDateTimeObjectFromTimezone(data.inTime, timezone);
      const outTime = moment(inTime)
        .add(data.approvalDuration, "hours")
        .toDate();

      validatePreapprovedDates({ inTime, outTime }, timezone);

      const visitorTypeDetails = JSON.parse(
        JSON.stringify(
          await getVisitorType({ id: data.visitorTypeId }, language)
        )
      );

      if (
        visitorTypeDetails.category_en === VISITOR_CATEGORIES.GUEST ||
        visitorTypeDetails.category_en === VISITOR_CATEGORIES.DAILY_HELP
      )
        throw new AppError(
          "createNonGuestPreapprovedVisitings",
          "Incorrect Category Id"
        );

      const visitingData = {
        visitorsCount: data.visitorsCount,
        flatId: flatId,
        visitorTypeId: data.visitorTypeId,
        residentId: userId,
        name: data.name,
        leavePackage: data.leavePackage,
        metaData: data.metaData,
      };
      const visiting = await VisitorVisiting.create(visitingData, {
        transaction: t,
      });

      // 3. create entry in preapproved_visitors table
      const preapprovedVisitingData = {
        inTime,
        outTime,
        isFrequent: data.isFrequent || false,
      };

      const preapprovedVisiting = await PreapprovedVisiting.create(
        preapprovedVisitingData,
        { transaction: t }
      );

      // 4. update the preapprovedId in visitor_visitings table
      visiting.preapprovedId = preapprovedVisiting.id;
      await visiting.save({ transaction: t });

      responseArr.push({
        sucess: true,
        company: visiting.name || visitorTypeDetails[`company_${language}`],
        category: visitorTypeDetails[`category_${language}`],
        image: visitorTypeDetails.image,
        expectedBy: moment(inTime).tz(timezone).format(COMMON_DATE_FORMAT),
      });

      await t.commit();

      // eventEmitter.emit(
      //   "schedule_notification",
      //   {
      //     actionType: ACTION_TYPES.ABOUT_TO_ARRIVE.key,
      //     sourceType: SOURCE_TYPES.VISITING,
      //     sourceId: visiting.id,
      //     generatedBy: null,
      //     generatedFor: visiting.residentId,
      //   },
      //   moment().add(30, "seconds").toDate()
      //   // moment(inTime).subtract(2, "minutes").toDate()
      // );
    } catch (error) {
      logger.warn(error.message);
      await t.rollback();
      responseArr.push({
        success: false,
        message: error.message,
      });
    }
  }

  return responseArr;
}

async function createNonGuestPreapprovedVisitingsNew(
  { dataArr, flatId, userId },
  propertyId,
  timezone,
  language = LANGUAGES.EN
) {
  const reference = `createNonGuestPreapprovedVisitingsNew`;
  const responseArr = [];
  for (const data of dataArr) {
    const t = await db.sequelize.transaction();
    try {
      const inTime = getDateTimeObjectFromTimezone(data.inTime, timezone);
      const outTime = moment(inTime)
        .add(data.approvalDuration, "hours")
        .toDate();

      validatePreapprovedDates({ inTime, outTime }, timezone);
      const visitorTypeDetails = JSON.parse(
        JSON.stringify(
          await getVisitorType(
            { id: data.visitorTypeId, propertyId, isVisible: true },
            language
          )
        )
      );

      if (
        !visitorTypeDetails ||
        visitorTypeDetails.category_en === VISITOR_CATEGORIES.GUEST ||
        visitorTypeDetails.category_en === VISITOR_CATEGORIES.DAILY_HELP
      )
        throw new AppError(reference, "Incorrect Category Id");
      const visitingData = {
        visitorsCount: data.visitorsCount,
        flatId: flatId,
        visitorTypeId: data.visitorTypeId,
        residentId: userId,
        name: data.name,
        leavePackage: data.leavePackage,
        metaData: data.metaData,
      };
      const visiting = await VisitorVisiting.create(visitingData, {
        transaction: t,
      });

      // 3. create entry in preapproved_visitors table
      const preapprovedVisitingData = {
        inTime,
        outTime,
        isFrequent: data.isFrequent || false,
      };

      const preapprovedVisiting = await PreapprovedVisiting.create(
        preapprovedVisitingData,
        { transaction: t }
      );

      // 4. update the preapprovedId in visitor_visitings table
      visiting.preapprovedId = preapprovedVisiting.id;
      await visiting.save({ transaction: t });

      responseArr.push({
        sucess: true,
        company: visiting.name || visitorTypeDetails[`company_${language}`],
        category: visitorTypeDetails[`category_${language}`],
        image: visitorTypeDetails.image,
        expectedBy: moment(inTime).tz(timezone).format(COMMON_DATE_FORMAT),
      });

      await t.commit();

      // eventEmitter.emit(
      //   "schedule_notification",
      //   {
      //     actionType: ACTION_TYPES.ABOUT_TO_ARRIVE.key,
      //     sourceType: SOURCE_TYPES.VISITING,
      //     sourceId: visiting.id,
      //     generatedBy: null,
      //     generatedFor: visiting.residentId,
      //   },
      //   moment().add(30, "seconds").toDate()
      //   // moment(inTime).subtract(2, "minutes").toDate()
      // );
    } catch (error) {
      logger.warn(error.message);
      await t.rollback();
      responseArr.push({
        success: false,
        message: error.message,
      });
    }
  }

  return responseArr;
}

async function getVisitings(
  params = {},
  attributes = [],
  { limit, offset },
  timezone,
  language = LANGUAGES.EN
) {
  const preapprovedParams = {};
  let isPreapprovedRequired = false;
  const visitorTypeParams = {};
  let orderBy = [];

  if (params.upcoming || params.tabName == "Upcoming") {
    preapprovedParams["outTime"] = {
      [Op.gte]: new Date(),
    };

    params[Op.and] = [
      db.Sequelize.literal(
        `"preapprovedDetails"."isFrequent" = true or (select count(*) from visitor_visiting_statuses as vvs where vvs."visitingId"="VisitorVisiting".id) = 0`
      ),
    ];

    isPreapprovedRequired = true;

    delete params.upcoming;
  }

  if (params.isPreapproved) {
    isPreapprovedRequired = true;
    delete params.isPreapproved;
  }

  if (params.category) {
    visitorTypeParams[`category_${language}`] = params.category;
    delete params.category;
  } else {
    delete params.category;
  }

  if (params.tabName == "Others") {
    visitorTypeParams[`category_${language}`] = {
      [Op.ne]: "Guest",
    };
  }

  if (params.tabName == "Guest") {
    visitorTypeParams[`category_${language}`] = "Guest";
  }

  if (params.isFrequent || params.tabName == "Frequent Visitors") {
    preapprovedParams["isFrequent"] = true;
    delete params.isFrequent;
  }

  if (params.preapprovedDate) {
    preapprovedParams.date = params.preapprovedDate;
    enableDateSearch(preapprovedParams, "outTime", timezone);
    isPreapprovedRequired = true;

    delete params.preapprovedDate;
  }

  if (params.createdAt) {
    params.date = params.createdAt;
    enableDateSearch(params, "createdAt", timezone);
  }

  delete params.tabName;

  orderBy = [
    [
      db.sequelize.literal(
        `case when (
          select "createdAt" from visitor_visiting_statuses vvs where vvs."visitingId"="VisitorVisiting".id order by "createdAt" desc limit 1
        ) is not null then (
          select "createdAt" from visitor_visiting_statuses vvs where vvs."visitingId"="VisitorVisiting".id order by "createdAt" desc limit 1
        ) else "VisitorVisiting"."createdAt" end desc`
      ),
    ],
  ];

  if (params.orderBy == "inTime") {
    orderBy = [
      [
        db.Sequelize.literal(
          `case when "preapprovedDetails"."inTime" is not null then "preapprovedDetails"."inTime" else "VisitorVisiting"."createdAt" end`
        ),
      ],
    ];
    delete params.orderBy;
  }

  let visitings = await VisitorVisiting.findAll({
    where: params,
    attributes: attributes.length ? attributes : null,
    // attributes: {
    //   include: [
    //     [
    //       db.Sequelize.literal(
    //         `(select count(*) from visitor_visiting_statuses as vvs where vvs."visitingId"="VisitorVisiting".id)`
    //       ),
    //       "totalStatus",
    //     ],
    //   ],
    // },
    include: [
      {
        model: PreapprovedVisiting,
        as: "preapprovedDetails",
        where: preapprovedParams,
        required: isPreapprovedRequired,
      },
      {
        model: Visitor,
        as: "visitor",
        required: false,
      },
      {
        model: VisitorType,
        as: "visitorType",
        where: visitorTypeParams,
        attributes: {
          exclude: VISITOR_TYPE_LANGUAGE_KEYS,
          include: Object.entries(VISITOR_TYPE_LANGUAGE_VARS[language]),
        },
      },
      {
        model: User,
        as: "resident",
      },
      {
        model: VisitorVisitingStatus,
        as: "visitingStatuses",
        required: false,
        order: [["createdAt", "DESC"]],
        limit: 2,
      },
    ],
    order: orderBy,
    offset,
    limit,
  });

  /*
    Upcoming( for the preapproved Visitors who hasn't arrived yet/ approval time is greater than the current time)

    Visited(for all the visitors who have in-time & out-time)

    Expired( for all those visitors who haven't arrived and the approval timing is less then the current time

    Cancelled( for the requests that were generated by the guard and rejected by the resident)

    Denied (for the preapproved visitors rejected by guard)
  */

  visitings = JSON.parse(JSON.stringify(visitings));

  for (const visiting of visitings) {
    if (!visiting.visitingStatuses.length) {
      if (visiting.preapprovedDetails) {
        if (
          moment(visiting.preapprovedDetails.outTime).toDate() >
          moment().toDate()
        ) {
          visiting.cardStatus = "Upcoming";
        } else {
          visiting.cardStatus = "Expired";
        }
      }
    } else {
      const visitingStatus = visiting.visitingStatuses[0];

      if (visitingStatus.status === VISITOR_STATUSES.CHECKOUT) {
        visiting.cardStatus = "Visited";
      } else if (
        visitingStatus.guardId &&
        visitingStatus.status === VISITOR_STATUSES.DENIED
      ) {
        visiting.cardStatus = "Denied";
      } else if (
        !visitingStatus.guardId &&
        visitingStatus.status === VISITOR_STATUSES.DENIED
      ) {
        visiting.cardStatus = "Denied";
      } else if (visitingStatus.status === VISITOR_STATUSES.CHECKIN) {
        visiting.cardStatus = "Active";
        visiting.visitingStatuses = [visitingStatus];
      } else if (visitingStatus.status === VISITOR_STATUSES.PENDING) {
        visiting.cardStatus = "Pending";
      } else {
        visiting.cardStatus = "Approved";
      }
    }

    if (
      visiting.preapprovedDetails &&
      !visiting.preapprovedDetails.isFrequent
    ) {
      const durationInMilliSeconds =
        new Date(visiting.preapprovedDetails.outTime).getTime() -
        new Date(visiting.preapprovedDetails.inTime).getTime();
      visiting.preapprovedDetails.approvalDuration = Math.floor(
        durationInMilliSeconds / (60 * 60 * 1000)
      );
    }
  }

  return visitings;
}

async function getVisitingsLatest(
  params = {},
  attributes = [],
  { limit, offset },
  timezone,
  language = LANGUAGES.EN
) {
  const preapprovedParams = {};
  let isPreapprovedRequired = false;
  const visitorTypeParams = {};
  let orderBy = [];

  if (params.upcoming || params.tabName == "Upcoming") {
    preapprovedParams["outTime"] = {
      [Op.gte]: new Date(),
    };

    params[Op.and] = [
      db.Sequelize.literal(
        `"preapprovedDetails"."isFrequent" = true or (select count(*) from visitor_visiting_statuses as vvs where vvs."visitingId"="VisitorVisiting".id) = 0`
      ),
    ];

    isPreapprovedRequired = true;

    delete params.upcoming;
  }

  if (params.isPreapproved) {
    isPreapprovedRequired = true;
    delete params.isPreapproved;
  }

  if (params.category) {
    visitorTypeParams[`category_${language}`] = params.category;
    delete params.category;
  } else {
    delete params.category;
  }

  if (params.tabName == "Others") {
    visitorTypeParams[`category_${language}`] = {
      [Op.ne]: "Guest",
    };
  }

  if (params.tabName == "Guest") {
    visitorTypeParams[`category_${language}`] = "Guest";
  }

  if (params.isFrequent || params.tabName == "Frequent Visitors") {
    preapprovedParams["isFrequent"] = true;
    delete params.isFrequent;
  }

  if (params.preapprovedDate) {
    preapprovedParams.date = params.preapprovedDate;
    enableDateSearch(preapprovedParams, "outTime", timezone);
    isPreapprovedRequired = true;

    delete params.preapprovedDate;
  }

  if (params.createdAt) {
    params.date = params.createdAt;
    enableDateSearch(params, "createdAt", timezone);
  }

  delete params.tabName;

  orderBy = [
    [
      db.sequelize.literal(
        `case when (
          select "createdAt" from visitor_visiting_statuses vvs where vvs."visitingId"="VisitorVisiting".id order by "createdAt" desc limit 1
        ) is not null then (
          select "createdAt" from visitor_visiting_statuses vvs where vvs."visitingId"="VisitorVisiting".id order by "createdAt" desc limit 1
        ) else "VisitorVisiting"."createdAt" end desc`
      ),
    ],
  ];

  if (params.orderBy == "inTime") {
    orderBy = [
      [
        db.Sequelize.literal(
          `case when "preapprovedDetails"."inTime" is not null then "preapprovedDetails"."inTime" else "VisitorVisiting"."createdAt" end`
        ),
      ],
    ];
    delete params.orderBy;
  }

  let visitingCount = await VisitorVisiting.count({
    where: params,

    include: [
      {
        model: PreapprovedVisiting,
        as: "preapprovedDetails",
        where: preapprovedParams,
        required: isPreapprovedRequired,
      },
      {
        model: Visitor,
        as: "visitor",
        required: false,
      },
      {
        model: VisitorType,
        as: "visitorType",
        where: visitorTypeParams,
      },
      {
        model: User,
        as: "resident",
      },
      {
        model: VisitorVisitingStatus,
        as: "visitingStatuses",
        required: false,
        order: [["createdAt", "DESC"]],
        limit: 2,
      },
    ],
    order: orderBy,
  });

  let visitings = await VisitorVisiting.findAll({
    where: params,
    attributes: [
      "id",
      "name",
      "visitorsCount",
      "leavePackage",
      "metaData",
      "createdAt",
      "updatedAt",
      "deletedAt",
    ],
    // attributes: {
    //   include: [
    //     [
    //       db.Sequelize.literal(
    //         `(select count(*) from visitor_visiting_statuses as vvs where vvs."visitingId"="VisitorVisiting".id)`
    //       ),
    //       "totalStatus",
    //     ],
    //   ],
    // },
    include: [
      {
        model: PreapprovedVisiting,
        as: "preapprovedDetails",
        where: preapprovedParams,
        required: isPreapprovedRequired,
      },
      {
        model: Visitor,
        as: "visitor",
        attributes: [
          "id",
          "name",
          "countryCode",
          "mobileNumber",
          "documentId",
          "documentImage",
          "documentType",
          "documentCountry",
          "createdAt",
        ],
        required: false,
      },
      {
        model: VisitorType,
        as: "visitorType",
        where: visitorTypeParams,
        attributes: [
          "id",
          "image",
          "createdAt",
          "updatedAt",
          [db.Sequelize.literal('"category_en"'), "category"],
          [db.Sequelize.literal('"company_en"'), "company"],
        ],
      },
      {
        model: User,
        as: "resident",
        attributes: ["id", "name", "role"],
      },
      {
        model: VisitorVisitingStatus,
        as: "visitingStatuses",
        required: false,
        order: [["createdAt", "DESC"]],
        limit: 2,
      },
    ],
    order: orderBy,
    offset,
    limit,
  });

  /*
    Upcoming( for the preapproved Visitors who hasn't arrived yet/ approval time is greater than the current time)

    Visited(for all the visitors who have in-time & out-time)

    Expired( for all those visitors who haven't arrived and the approval timing is less then the current time

    Cancelled( for the requests that were generated by the guard and rejected by the resident)

    Denied (for the preapproved visitors rejected by guard)
  */

  visitings = JSON.parse(JSON.stringify(visitings));

  for (const visiting of visitings) {
    if (!visiting.visitingStatuses.length) {
      if (visiting.preapprovedDetails) {
        if (
          moment(visiting.preapprovedDetails.outTime).toDate() >
          moment().toDate()
        ) {
          visiting.cardStatus = "Upcoming";
        } else {
          visiting.cardStatus = "Expired";
        }
      }
    } else {
      const visitingStatus = visiting.visitingStatuses[0];

      if (visitingStatus.status === VISITOR_STATUSES.CHECKOUT) {
        visiting.cardStatus = "Visited";
      } else if (
        visitingStatus.guardId &&
        visitingStatus.status === VISITOR_STATUSES.DENIED
      ) {
        visiting.cardStatus = "Denied";
      } else if (
        !visitingStatus.guardId &&
        visitingStatus.status === VISITOR_STATUSES.DENIED
      ) {
        visiting.cardStatus = "Denied";
      } else if (visitingStatus.status === VISITOR_STATUSES.CHECKIN) {
        visiting.cardStatus = "Active";
        visiting.visitingStatuses = [visitingStatus];
      } else if (visitingStatus.status === VISITOR_STATUSES.PENDING) {
        visiting.cardStatus = "Pending";
      } else {
        visiting.cardStatus = "Approved";
      }
    }

    if (
      visiting.preapprovedDetails &&
      !visiting.preapprovedDetails.isFrequent
    ) {
      const durationInMilliSeconds =
        new Date(visiting.preapprovedDetails.outTime).getTime() -
        new Date(visiting.preapprovedDetails.inTime).getTime();
      visiting.preapprovedDetails.approvalDuration = Math.floor(
        durationInMilliSeconds / (60 * 60 * 1000)
      );
    }
  }
  if (visitings.length) {
    if (visitingCount >= 1000 && visitingCount < 1000000) {
      visitingCount = (visitingCount / 1000).toFixed(1) + "K";
    } else if (visitingCount >= 1000000) {
      visitingCount = (visitingCount / 1000000).toFixed(1) + "M";
    } else {
      visitingCount = visitingCount;
    }

    visitings[0].count = visitingCount.toString();
  }

  return visitings;
}

async function getVisitingsLatestNew(
  params = {},
  attributes = [],
  { limit, offset },
  timezone,
  language = LANGUAGES.EN
) {
  const preapprovedParams = {};
  let isPreapprovedRequired = false;
  const visitorTypeParams = {};
  let orderBy = [];

  const property = await getPropertyFromFlat(params.flatId);

  if (params.upcoming || params.tabName == "Upcoming") {
    preapprovedParams["outTime"] = {
      [Op.gte]: new Date(),
    };

    params[Op.and] = [
      db.Sequelize.literal(
        `"preapprovedDetails"."isFrequent" = true or (select count(*) from visitor_visiting_statuses as vvs where vvs."visitingId"="VisitorVisiting".id) = 0`
      ),
    ];

    isPreapprovedRequired = true;

    delete params.upcoming;
  }

  if (params.isPreapproved) {
    isPreapprovedRequired = true;
    delete params.isPreapproved;
  }

  if (params.categoryId) {
    visitorTypeParams["id"] = params.categoryId;
    visitorTypeParams["propertyId"] = property.id;
    delete params.categoryId;
  }

  // if (params.tabName == "Others") {
  //   visitorTypeParams[`category_${language}`] = {
  //     [Op.ne]: "Guest",
  //   };
  // }

  // if (params.tabName == "Guest") {
  //   visitorTypeParams[`category_${language}`] = "Guest";
  // }

  if (params.isFrequent || params.tabName == "Frequent Visitors") {
    preapprovedParams["isFrequent"] = true;
    delete params.isFrequent;
  }

  if (params.preapprovedDate) {
    preapprovedParams.date = params.preapprovedDate;
    enableDateSearch(preapprovedParams, "outTime", timezone);
    isPreapprovedRequired = true;

    delete params.preapprovedDate;
  }

  if (params.createdAt) {
    params.date = params.createdAt;
    enableDateSearch(params, "createdAt", timezone);
  }

  delete params.tabName;

  orderBy = [
    [
      db.sequelize.literal(
        `case when (
          select "createdAt" from visitor_visiting_statuses vvs where vvs."visitingId"="VisitorVisiting".id order by "createdAt" desc limit 1
        ) is not null then (
          select "createdAt" from visitor_visiting_statuses vvs where vvs."visitingId"="VisitorVisiting".id order by "createdAt" desc limit 1
        ) else "VisitorVisiting"."createdAt" end desc`
      ),
    ],
  ];

  if (params.orderBy == "inTime") {
    orderBy = [
      [
        db.Sequelize.literal(
          `case when "preapprovedDetails"."inTime" is not null then "preapprovedDetails"."inTime" else "VisitorVisiting"."createdAt" end`
        ),
      ],
    ];
    delete params.orderBy;
  }

  let visitingCount = await VisitorVisiting.count({
    where: params,

    include: [
      {
        model: PreapprovedVisiting,
        as: "preapprovedDetails",
        where: preapprovedParams,
        required: isPreapprovedRequired,
      },
      {
        model: Visitor,
        as: "visitor",
        required: false,
      },
      {
        model: VisitorType,
        as: "visitorType",
        where: visitorTypeParams,
      },
      {
        model: User,
        as: "resident",
      },
      {
        model: VisitorVisitingStatus,
        as: "visitingStatuses",
        required: false,
        order: [["createdAt", "DESC"]],
        limit: 2,
      },
    ],
    order: orderBy,
  });

  let visitings = await VisitorVisiting.findAll({
    where: params,
    attributes: [
      "id",
      "name",
      "visitorsCount",
      "leavePackage",
      "metaData",
      "createdAt",
      "updatedAt",
      "deletedAt",
    ],
    // attributes: {
    //   include: [
    //     [
    //       db.Sequelize.literal(
    //         `(select count(*) from visitor_visiting_statuses as vvs where vvs."visitingId"="VisitorVisiting".id)`
    //       ),
    //       "totalStatus",
    //     ],
    //   ],
    // },
    include: [
      {
        model: PreapprovedVisiting,
        as: "preapprovedDetails",
        where: preapprovedParams,
        required: isPreapprovedRequired,
      },
      {
        model: Visitor,
        as: "visitor",
        attributes: [
          "id",
          "name",
          "countryCode",
          "mobileNumber",
          "documentId",
          "documentImage",
          "documentType",
          "documentCountry",
          "createdAt",
        ],
        required: false,
      },
      {
        model: VisitorType,
        as: "visitorType",
        where: visitorTypeParams,
        attributes: [
          "id",
          "image",
          "createdAt",
          "updatedAt",
          [db.Sequelize.literal('"category_en"'), "category"],
          [db.Sequelize.literal('"company_en"'), "company"],
        ],
      },
      {
        model: User,
        as: "resident",
        attributes: ["id", "name", "role"],
      },
      {
        model: VisitorVisitingStatus,
        as: "visitingStatuses",
        required: false,
        order: [["createdAt", "DESC"]],
        limit: 2,
      },
    ],
    order: orderBy,
    offset,
    limit,
  });

  /*
    Upcoming( for the preapproved Visitors who hasn't arrived yet/ approval time is greater than the current time)

    Visited(for all the visitors who have in-time & out-time)

    Expired( for all those visitors who haven't arrived and the approval timing is less then the current time

    Cancelled( for the requests that were generated by the guard and rejected by the resident)

    Denied (for the preapproved visitors rejected by guard)
  */

  visitings = JSON.parse(JSON.stringify(visitings));

  for (const visiting of visitings) {
    if (!visiting.visitingStatuses.length) {
      if (visiting.preapprovedDetails) {
        if (
          moment(visiting.preapprovedDetails.outTime).toDate() >
          moment().toDate()
        ) {
          visiting.cardStatus = "Upcoming";
        } else {
          visiting.cardStatus = "Expired";
        }
      }
    } else {
      const visitingStatus = visiting.visitingStatuses[0];

      if (visitingStatus.status === VISITOR_STATUSES.CHECKOUT) {
        visiting.cardStatus = "Visited";
      } else if (
        visitingStatus.guardId &&
        visitingStatus.status === VISITOR_STATUSES.DENIED
      ) {
        visiting.cardStatus = "Denied";
      } else if (
        !visitingStatus.guardId &&
        visitingStatus.status === VISITOR_STATUSES.DENIED
      ) {
        visiting.cardStatus = "Denied";
      } else if (visitingStatus.status === VISITOR_STATUSES.CHECKIN) {
        visiting.cardStatus = "Active";
        visiting.visitingStatuses = [visitingStatus];
      } else if (visitingStatus.status === VISITOR_STATUSES.PENDING) {
        visiting.cardStatus = "Pending";
      } else {
        visiting.cardStatus = "Approved";
      }
    }

    if (
      visiting.preapprovedDetails &&
      !visiting.preapprovedDetails.isFrequent
    ) {
      const durationInMilliSeconds =
        new Date(visiting.preapprovedDetails.outTime).getTime() -
        new Date(visiting.preapprovedDetails.inTime).getTime();
      visiting.preapprovedDetails.approvalDuration = Math.floor(
        durationInMilliSeconds / (60 * 60 * 1000)
      );
    }
  }
  if (visitings.length) {
    if (visitingCount >= 1000 && visitingCount < 1000000) {
      visitingCount = (visitingCount / 1000).toFixed(1) + "K";
    } else if (visitingCount >= 1000000) {
      visitingCount = (visitingCount / 1000000).toFixed(1) + "M";
    } else {
      visitingCount = visitingCount;
    }

    visitings[0].count = visitingCount.toString();
  }

  return visitings;
}

//update pre approved visiting
async function updateNonGuestPreapprovedVisiting(
  params,
  data,
  timezone,
  language
) {
  const findVisiting = await VisitorVisiting.findOne({
    where: params,
  });
  if (!findVisiting) throw new AppError("", "No visitings found");

  const preApprovedVisiting = await PreapprovedVisiting.findOne({
    where: { id: findVisiting.preapprovedId },
  });
  if (!preApprovedVisiting)
    throw new AppError("", "No pre approved visiting found");

  try {
    if (data.visitorsCount) {
      findVisiting.visitorsCount = data.visitorsCount;
    }
    if (data.visitorTypeId) {
      findVisiting.visitorTypeId = data.visitorTypeId;
    }
    if (data.hasOwnProperty("leavePackage")) {
      findVisiting.leavePackage = data.leavePackage;
    }

    if (data.hasOwnProperty("metaData")) {
      findVisiting.metaData = data.metaData;
    }

    findVisiting.name = data.name;

    for (const key in data) {
      if (key == "inTime") {
        const inTime = getDateTimeObjectFromTimezone(data[key], timezone);
        preApprovedVisiting[key] = inTime;
      } else if (key == "outTime") {
        const outTime = getDateTimeObjectFromTimezone(data[key], timezone);
        preApprovedVisiting[key] = outTime;
      } else if (key == "approvalDuration") {
        const updatedInTime = data.inTime
          ? getDateTimeObjectFromTimezone(data.inTime, timezone)
          : preApprovedVisiting.inTime;
        preApprovedVisiting["outTime"] = moment(updatedInTime)
          .add(data.approvalDuration, "hours")
          .toDate();
      } else {
        preApprovedVisiting[key] = data[key];
      }
    }

    validatePreapprovedDates(preApprovedVisiting, timezone);

    const visitorTypeDetails = JSON.parse(
      JSON.stringify(
        await getVisitorType({ id: findVisiting.visitorTypeId }, language)
      )
    );

    if (
      visitorTypeDetails.category_en === VISITOR_CATEGORIES.GUEST ||
      visitorTypeDetails.category_en === VISITOR_CATEGORIES.DAILY_HELP
    )
      throw new AppError(
        "createNonGuestPreapprovedVisitings",
        "Incorrect Catgory Id"
      );

    await preApprovedVisiting.save();
    await findVisiting.save();

    return [
      {
        sucess: true,
        company: findVisiting.name || visitorTypeDetails[`company_${language}`],
        category: visitorTypeDetails[`category_${language}`],
        image: visitorTypeDetails.image,
        expectedBy: moment(preApprovedVisiting.inTime)
          .tz(timezone)
          .format(COMMON_DATE_FORMAT),
      },
    ];
  } catch (error) {
    throw error;
  }
}

async function updateNonGuestPreapprovedVisitingNew(
  params,
  data,
  propertyId,
  timezone,
  language
) {
  const reference = `updateNonGuestPreapprovedVisitingNew`;
  const findVisiting = await VisitorVisiting.findOne({
    where: params,
  });
  if (!findVisiting) throw new AppError("", "No visitings found");

  const preApprovedVisiting = await PreapprovedVisiting.findOne({
    where: { id: findVisiting.preapprovedId },
  });
  if (!preApprovedVisiting)
    throw new AppError("", "No pre approved visiting found");

  try {
    if (data.visitorsCount) {
      findVisiting.visitorsCount = data.visitorsCount;
    }
    if (data.visitorTypeId) {
      findVisiting.visitorTypeId = data.visitorTypeId;
    }
    if (data.hasOwnProperty("leavePackage")) {
      findVisiting.leavePackage = data.leavePackage;
    }

    if (data.hasOwnProperty("metaData")) {
      findVisiting.metaData = data.metaData;
    }

    findVisiting.name = data.name;

    for (const key in data) {
      if (key == "inTime") {
        const inTime = getDateTimeObjectFromTimezone(data[key], timezone);
        preApprovedVisiting[key] = inTime;
      } else if (key == "outTime") {
        const outTime = getDateTimeObjectFromTimezone(data[key], timezone);
        preApprovedVisiting[key] = outTime;
      } else if (key == "approvalDuration") {
        const updatedInTime = data.inTime
          ? getDateTimeObjectFromTimezone(data.inTime, timezone)
          : preApprovedVisiting.inTime;
        preApprovedVisiting["outTime"] = moment(updatedInTime)
          .add(data.approvalDuration, "hours")
          .toDate();
      } else {
        preApprovedVisiting[key] = data[key];
      }
    }

    validatePreapprovedDates(preApprovedVisiting, timezone);

    const visitorTypeDetails = JSON.parse(
      JSON.stringify(
        await getVisitorType(
          { id: findVisiting.visitorTypeId, propertyId, isVisible: true },
          language
        )
      )
    );
    if (
      !visitorTypeDetails ||
      visitorTypeDetails.category_en === VISITOR_CATEGORIES.GUEST ||
      visitorTypeDetails.category_en === VISITOR_CATEGORIES.DAILY_HELP
    )
      throw new AppError(reference, "Incorrect Category Id");

    await preApprovedVisiting.save();
    await findVisiting.save();

    return [
      {
        success: true,
        company: findVisiting.name || visitorTypeDetails[`company_${language}`],
        category: visitorTypeDetails[`category_${language}`],
        image: visitorTypeDetails.image,
        expectedBy: moment(preApprovedVisiting.inTime)
          .tz(timezone)
          .format(COMMON_DATE_FORMAT),
      },
    ];
  } catch (error) {
    throw error;
  }
}

async function deleteVisiting(params = {}) {
  const visiting = await VisitorVisiting.findOne({ where: params });

  if (!visiting) {
    throw new AppError("deleteVisiting", "Invalid visiting Id");
  }

  await visiting.destroy();

  // TODO: Also delete the respective Notifications from user_notifications table

  return "Record Deleted";
}

async function getPreapprovedVisitingShareInfo(
  params = {},
  timezone,
  language = LANGUAGES.EN
) {
  const visiting = await VisitorVisiting.findOne({
    where: params,
    include: [
      {
        model: PreapprovedVisiting,
        as: "preapprovedDetails",
        where: {
          visitorCode: {
            [Op.ne]: null,
          },
        },
      },
      {
        model: User,
        as: "resident",
      },
    ],
  });

  if (!visiting) {
    throw new AppError(
      "getPreapprovedVisitingShareInfo",
      "Invalid Visiting Id"
    );
  }

  const flatAddress = await getFlatAddress({ id: visiting.flatId }, language);

  const shareInfo = {
    code: visiting.preapprovedDetails.visitorCode,
    invitedTo: visiting.name,
    invitedBy: visiting.resident?.name,
    invitedAt: flatAddress,
    visitorsCount: visiting.visitorsCount,
    isFrequent: visiting.preapprovedDetails.isFrequent,
  };

  shareInfo.inDate = moment(visiting.preapprovedDetails.inTime)
    .tz(timezone)
    .format("DD MMMM, YYYY");
  shareInfo.inTime = moment(visiting.preapprovedDetails.inTime)
    .tz(timezone)
    .format("hh:mm a");
  shareInfo.approvalDuration = moment(visiting.preapprovedDetails.outTime).from(
    visiting.preapprovedDetails.inTime,
    true
  );
  shareInfo.outDate = moment(visiting.preapprovedDetails.outTime)
    .tz(timezone)
    .format("DD MMMM, YYYY");
  shareInfo.outTime = moment(visiting.preapprovedDetails.outTime)
    .tz(timezone)
    .format("hh:mm a");

  return shareInfo;
}

async function updatePreapprovedGuest(
  params,
  data,
  timezone,
  language = LANGUAGES.EN
) {
  const t = await db.sequelize.transaction();

  try {
    const visitingObj = await VisitorVisiting.findOne({
      where: params,
      transaction: t,
    });

    if (!visitingObj) {
      throw new AppError("updatePreapprovedGuest", "Invalid Visiting Id");
    }

    const preapprovedObj = await PreapprovedVisiting.findOne({
      where: {
        id: visitingObj.preapprovedId,
      },
      transaction: t,
    });

    const visitor = await visitorController.addOrUpdate(data, t);

    visitingObj.visitorId = visitor.id;

    if (data.visitorTypeId) {
      visitingObj.visitorTypeId = data.visitorTypeId;
    }

    if (data.hasOwnProperty("metaData")) {
      visitingObj.metaData = data.metaData;
    }

    for (const key of Object.keys(data)) {
      if (key == "name" || key == "visitorsCount") visitingObj[key] = data[key];
      else if (key == "isFrequent") {
        preapprovedObj[key] = data[key];
      } else if (key == "inTime" || key == "outTime") {
        preapprovedObj[key] = getDateTimeObjectFromTimezone(
          data[key],
          timezone
        );
      } else if (key == "approvalDuration") {
        const updatedInTime = data.inTime
          ? getDateTimeObjectFromTimezone(data.inTime, timezone)
          : preapprovedObj.inTime;
        preapprovedObj["outTime"] = moment(updatedInTime)
          .add(data.approvalDuration, "hours")
          .toDate();
      }
    }

    if (!data.approvalDuration) {
      preapprovedObj.outTime = moment(preapprovedObj.outTime)
        .tz(timezone)
        .endOf("day")
        .toDate();
    }

    validatePreapprovedDates(preapprovedObj, timezone);

    await visitingObj.save({ transaction: t });
    await preapprovedObj.save({ transaction: t });

    await t.commit();

    return await getPreapprovedVisitingShareInfo(
      { id: visitingObj.id },
      timezone,
      language
    );
  } catch (error) {
    // console.log(error);
    await t.rollback();
    throw error;
  }
}

function validatePreapprovedDates({ inTime, outTime }, timezone) {
  const currDate = moment(inTime).tz(timezone).hours()
    ? new Date()
    : moment().tz(timezone).startOf("day").toDate();

  const adjustedDate = new Date(currDate).setMinutes(currDate.getMinutes() - 5);

  if (inTime < adjustedDate || outTime < adjustedDate || inTime > outTime)
    throw new AppError(
      "validatePreapprovedDates",
      "Please enter valid timings"
    );
}

//get visitings by code - guard
async function getPreapprovedVisitingsByCode(
  params = {},
  timezone,
  language = LANGUAGES.EN
) {
  const reference = "getPreapprovedVisitingsByCode";
  const query = `
    select vv.id, f.floor, f.name_${language} as "flatName", b.id as "buildingId", b.name_${language} as "buildingName",
    vt.category_${language} as "category", vt."image" as "categoryImage", vv."visitorsCount", 
    v.id as "visitor.id", v."profilePicture" as "visitor.profilePicture", vv.name as "visitor.name", v."mobileNumber" as "visitor.mobileNumber", 
    v."documentId" as "visitor.documentId", v."documentType" as "visitor.documentType", v."documentImage" as "visitor.documentImage",
    u.id as "resident.id", u."profilePicture" as "resident.profilePicture", u.name as "resident.name", u."mobileNumber" as "resident.mobileNumber",
    vvs.status, pv."isFrequent", vv."metaData", b."name_${language}" as "buildingName"
    from visitor_visitings vv
    join preapproved_visitings pv on vv."preapprovedId"=pv.id
    left join (
      select Distinct ON("visitingId") "createdAt", "status", "visitingId"
      from visitor_visiting_statuses
      order by "visitingId", "createdAt" DESC
    ) vvs on vv.id = vvs."visitingId"
    left join users u on u.id = vv."residentId"
    join visitors v on v.id = vv."visitorId"
    join visitor_types vt on vt.id = vv."visitorTypeId"
    join flats f on f.id = vv."flatId"
    join buildings b on f."buildingId"=b.id
    join properties p on p.id = b."propertyId"
    where pv."visitorCode"=:visitorCode
    and pv."outTime" >= :now
    and p.id = :propertyId
    and (vvs.status is null or (vvs.status = '${VISITOR_STATUSES.CHECKOUT}' and pv."isFrequent" = true))
    and vv."deletedAt" is null
  `;

  const visitors = await db.sequelize.query(query, {
    raw: true,
    type: db.Sequelize.QueryTypes.SELECT,
    replacements: {
      propertyId: params.propertyId,
      visitorCode: params.visitorCode,
      now: new Date(),
    },
    nest: true,
  });

  if (!visitors.length) {
    throw new AppError(reference, "Enter valid code", "custom", 200); //TODO: update status code after new build is uploaded
  }

  return visitors;
}

async function createAnonymousGuest(data) {
  const t = await db.sequelize.transaction();

  let {
    visitorId,
    visitorTypeId,
    flatId,
    name,
    visitorsCount,
    guardId,
    metaData,
  } = data;

  try {
    // TODO: Guard Property Id to flat Id check is missing. flat should belong to guard property

    if (!name)
      throw new AppError("createPreApprovedGuest", "Vistor name is required");

    const user = await getUser({ flatId });

    if (!visitorId) {
      visitorId = (await visitorController.addOrUpdate(data, t)).id;
    }

    const visiting = await VisitorVisiting.create(
      {
        visitorTypeId,
        flatId,
        name,
        visitorsCount,
        visitorId,
        metaData,
      },
      { transaction: t }
    );

    await visitingStatusController.updateVisitingStatus(
      {
        status: user ? VISITOR_STATUSES.PENDING : VISITOR_STATUSES.CHECKIN,
        guardId,
        visitingId: visiting.id,
      },
      t
    );

    eventEmitter.emit("flat_level_notification", {
      flatId,
      actionType: ACTION_TYPES.ENTRY_REQUESTED.key,
      sourceType: SOURCE_TYPES.VISITING,
      sourceId: visiting.id,
      generatedBy: guardId,
    });

    await t.commit();

    return visiting;
  } catch (error) {
    await t.rollback();
    throw error;
  }
}

async function createAnonymousGuestNew(data) {
  const t = await db.sequelize.transaction();

  let {
    visitorId,
    visitorTypeId,
    flatId,
    name,
    visitorsCount,
    guardId,
    metaData,
  } = data;

  try {
    // TODO: Guard Property Id to flat Id check is missing. flat should belong to guard property

    if (!name)
      throw new AppError("createPreApprovedGuest", "Vistor name is required");

    const existingVisitorType = await VisitorType.findOne({
      where: {
        id: visitorTypeId,
        propertyId: data.propertyId,
        isVisible: true,
      },
    });

    if (!existingVisitorType) {
      throw new AppError(reference, "Invalid visitor type");
    }

    const user = await getUser({ flatId });

    if (!visitorId) {
      visitorId = (await visitorController.addOrUpdate(data, t)).id;
    }

    const visiting = await VisitorVisiting.create(
      {
        visitorTypeId,
        flatId,
        name,
        visitorsCount,
        visitorId,
        metaData,
      },
      { transaction: t }
    );

    await visitingStatusController.updateVisitingStatus(
      {
        status: user ? VISITOR_STATUSES.PENDING : VISITOR_STATUSES.CHECKIN,
        guardId,
        visitingId: visiting.id,
      },
      t
    );

    eventEmitter.emit("flat_level_notification", {
      flatId,
      actionType: ACTION_TYPES.ENTRY_REQUESTED.key,
      sourceType: SOURCE_TYPES.VISITING,
      sourceId: visiting.id,
      generatedBy: guardId,
    });

    await t.commit();

    return visiting;
  } catch (error) {
    await t.rollback();
    throw error;
  }
}

async function createAnonymousGuestMultiple(data) {
  const t = await db.sequelize.transaction();

  let {
    visitorId,
    visitorTypeId,
    flats,
    name,
    visitorsCount,
    guardId,
    metaData,
    brokerDetails,
    salesAdvisor,
  } = data;

  if (!flats || !Array.isArray(flats)) {
    throw new AppError("createPreApprovedGuest", "Enter flats in valid format");
  }
  if (!flats.length) {
    throw new AppError("createPreApprovedGuest", "No flats entered");
  }
  let notifications = [],
    response = [];

  if (!name)
    throw new AppError("createPreApprovedGuest", "Visitor name is required");

  const [{ isCrmPushRequired, crmDetails }, visitorType] = await Promise.all([
    getPropertyFeature(
      {
        propertyId: data.propertyId,
      },
      "featureDetails"
    ),
    getVisitorType({ id: visitorTypeId }),
  ]);

  try {
    // TODO: Guard Property Id to flat Id check is missing. flat should belong to guard property

    if (!visitorId) {
      visitorId = (await visitorController.addOrUpdate(data, t)).id;
    }

    await Promise.all(
      flats.map(async (flatId) => {
        const [user, visiting, flatDetails] = await Promise.all([
          getUser({ flatId }),
          VisitorVisiting.create(
            {
              visitorTypeId,
              flatId,
              name,
              visitorsCount,
              visitorId,
              metaData,
              brokerDetails: brokerDetails
                ? {
                    agentName: brokerDetails.agentName
                      ? brokerDetails.agentName
                      : null,
                    agentId: brokerDetails.agentId
                      ? brokerDetails.agentId
                      : null,
                    agentCompany: brokerDetails.agentCompany
                      ? brokerDetails.agentCompany
                      : null,
                    agentMobileNumber: brokerDetails.agentMobileNumber
                      ? brokerDetails.agentMobileNumber
                      : null,
                    agentCountryCode: brokerDetails.agentCountryCode
                      ? brokerDetails.agentCountryCode
                      : null,
                  }
                : null,
              salesAdvisor: salesAdvisor ? salesAdvisor : null,
            },
            { transaction: t }
          ),
          getFlatWithBuilding({ id: flatId }),
        ]);

        await visitingStatusController.updateVisitingStatus(
          {
            status: user ? VISITOR_STATUSES.PENDING : VISITOR_STATUSES.CHECKIN,
            guardId,
            visitingId: visiting.id,
          },
          t
        );
        response.push(visiting);
        notifications.push({ flatId, sourceId: visiting.id });
        if (isCrmPushRequired && visitorType.category_en == "Viewing") {
          eventEmitter.emit("create_crm_entry", {
            visitor: data,
            crmDetails,
            project: flatDetails.get({ plain: true }),
          });
        }
      })
    );

    await t.commit();

    for (let notification of notifications) {
      eventEmitter.emit("flat_level_notification", {
        ...notification,
        actionType: ACTION_TYPES.ENTRY_REQUESTED.key,
        sourceType: SOURCE_TYPES.VISITING,
        generatedBy: guardId,
      });
    }

    return response;
  } catch (error) {
    await t.rollback();
    throw error;
  }
}

async function createAnonymousGuestMultipleNew(data) {
  const reference = `createAnonymousGuestMultipleNew`;
  const t = await db.sequelize.transaction();

  let {
    visitorId,
    visitorTypeId,
    flats,
    name,
    visitorsCount,
    guardId,
    metaData,
    brokerDetails,
    salesAdvisor,
  } = data;

  if (!flats || !Array.isArray(flats)) {
    throw new AppError(reference, "Enter flats in valid format");
  }
  if (!flats.length) {
    throw new AppError(reference, "No flats entered");
  }

  const existingVisitorType = await VisitorType.findOne({
    where: { id: visitorTypeId, propertyId: data.propertyId, isVisible: true },
  });

  if (!existingVisitorType) {
    throw new AppError(reference, "Invalid visitor type");
  }

  let notifications = [],
    response = [];

  try {
    // TODO: Guard Property Id to flat Id check is missing. flat should belong to guard property

    if (!name) throw new AppError(reference, "Visitor name is required");

    if (!visitorId) {
      visitorId = (await visitorController.addOrUpdate(data, t)).id;
    }

    const [{ isCrmPushRequired, crmDetails }, visitorType] = await Promise.all([
      getPropertyFeature(
        {
          propertyId: data.propertyId,
        },
        "featureDetails"
      ),
      getVisitorType({ id: visitorTypeId }),
    ]);

    await Promise.all(
      flats.map(async (flatId) => {
        const [user, visiting, flatDetails] = await Promise.all([
          getUser({ flatId }),
          VisitorVisiting.create(
            {
              visitorTypeId,
              flatId,
              name,
              visitorsCount,
              visitorId,
              metaData,
              brokerDetails: brokerDetails
                ? {
                    agentName: brokerDetails.agentName
                      ? brokerDetails.agentName
                      : null,
                    agentId: brokerDetails.agentId
                      ? brokerDetails.agentId
                      : null,
                    agentCompany: brokerDetails.agentCompany
                      ? brokerDetails.agentCompany
                      : null,
                    agentMobileNumber: brokerDetails.agentMobileNumber
                      ? brokerDetails.agentMobileNumber
                      : null,
                    agentCountryCode: brokerDetails.agentCountryCode
                      ? brokerDetails.agentCountryCode
                      : null,
                  }
                : null,
              salesAdvisor: salesAdvisor ? salesAdvisor : null,
            },
            { transaction: t }
          ),
          getFlatWithBuilding({ id: flatId }),
        ]);

        // const user = await getUser({ flatId });
        // const visiting = await VisitorVisiting.create(
        //   {
        //     visitorTypeId,
        //     flatId,
        //     name,
        //     visitorsCount,
        //     visitorId,
        //     metaData,
        //   },
        //   { transaction: t }
        // );

        await visitingStatusController.updateVisitingStatus(
          {
            status: user ? VISITOR_STATUSES.PENDING : VISITOR_STATUSES.CHECKIN,
            guardId,
            visitingId: visiting.id,
          },
          t
        );
        response.push(visiting);
        notifications.push({ flatId, sourceId: visiting.id });
        if (isCrmPushRequired && visitorType.category_en == "Viewing") {
          eventEmitter.emit("create_crm_entry", {
            visitor: data,
            crmDetails,
            project: flatDetails.get({ plain: true }),
          });
        }
      })
    );

    // for (let flatId of flats) {
    //   const user = await getUser({ flatId });
    //   const visiting = await VisitorVisiting.create(
    //     {
    //       visitorTypeId,
    //       flatId,
    //       name,
    //       visitorsCount,
    //       visitorId,
    //       metaData,
    //     },
    //     { transaction: t }
    //   );

    //   await visitingStatusController.updateVisitingStatus(
    //     {
    //       status: user ? VISITOR_STATUSES.PENDING : VISITOR_STATUSES.CHECKIN,
    //       guardId,
    //       visitingId: visiting.id,
    //     },
    //     t
    //   );
    //   response.push(visiting);
    //   notifications.push({ flatId, sourceId: visiting.id });
    // }

    await t.commit();

    for (let notification of notifications) {
      eventEmitter.emit("flat_level_notification", {
        ...notification,
        actionType: ACTION_TYPES.ENTRY_REQUESTED.key,
        sourceType: SOURCE_TYPES.VISITING,
        generatedBy: guardId,
      });
    }

    return response;
  } catch (error) {
    await t.rollback();
    throw error;
  }
}

async function createAnonymousNonGuest(data) {
  const t = await db.sequelize.transaction();

  const { visitorTypeId, guardId, flatId, visitorsCount, metaData } = data;

  try {
    // TODO: Guard Building Id to flat Id check is missing. flat Id should belong to guard building Id

    const visiting = await VisitorVisiting.create(
      {
        visitorTypeId,
        flatId,
        visitorsCount,
        metaData,
      },
      { transaction: t }
    );

    await visitingStatusController.updateVisitingStatus(
      {
        status: VISITOR_STATUSES.PENDING,
        guardId,
        visitingId: visiting.id,
      },
      t
    );

    eventEmitter.emit("flat_level_notification", {
      flatId,
      actionType: ACTION_TYPES.ENTRY_REQUESTED.key,
      sourceType: SOURCE_TYPES.VISITING,
      sourceId: visiting.id,
      generatedBy: guardId,
    });

    await t.commit();

    return visiting;
  } catch (error) {
    await t.rollback();
    throw error;
  }
}

async function getBuildingVisitingsByLastStatuses(
  params,
  { limit, offset },
  language = LANGUAGES.EN
) {
  const query = `
    select vvs.status, vv.id, f.floor, f.name_${language} as "flatName", vt.category_${language} as category, vt.company_${language} as company, vvs."createdAt",
    case when v."profilePicture" is not null then v."profilePicture" else vt.image end as image,
    case when vv.name is not null then vv.name when vt.company_${language} is not null then vt.company_${language} else vt.category_${language} end as name,
    v."documentImage", v."documentId", v."documentType", v."documentCountry", v."mobileNumber", v."documentExpiry", v."documentExpireMonth", v."documentIssueState", v."documentIssueDate", v."passportNumber", v."additionalDetails",
    vv."metaData", vvs."createdAt" as "lastStatusTime",
    b.id as "buildingId", b."name_${language}" as "buildingName",
    COUNT (*) OVER () as count
    from (
      select DISTINCT ON(vvs."visitingId") vvs.status, vvs."visitingId", vvs."createdAt"
      from visitor_visiting_statuses vvs
      order by vvs."visitingId", vvs."createdAt" DESC
    ) as vvs
    join visitor_visitings vv on vv.id = vvs."visitingId"
    join flats f on vv."flatId"=f.id
    join buildings b on b.id = f."buildingId"
    join visitor_types vt on vt.id = vv."visitorTypeId"
    left join visitors v on v.id = vv."visitorId"
    left join preapproved_visitings pv on pv.id=vv."preapprovedId"
    where b."propertyId" = :propertyId
    and cast(vvs.status as text) = ANY (Array [:statuses])
    and vv."deletedAt" is null ${
      params.search
        ? `and (
      vv.name ilike '%${params.search}%'
      or vt.category_${language} ilike '%${params.search}%'
      or vt.company_${language} ilike '%${params.search}%'
      or f.name_${language} ilike '%${params.search}%'
      or f.floor ilike '%${params.search}%'
    )`
        : ""
    }
    order by vvs."createdAt" DESC
    limit :limit offset :offset
  `;
  const buildingVisitings = await db.sequelize.query(query, {
    raw: true,
    type: db.Sequelize.QueryTypes.SELECT,
    replacements: {
      propertyId: params.propertyId,
      statuses: [params.status],
      nameRegex: params.name ? `%${params.name}%` : "%",
      limit,
      offset,
    },
  });

  for (const visiting of buildingVisitings) {
    visiting.creationTime = moment(visiting.createdAt).from(moment());
    if (visiting.status == VISITOR_STATUSES.CHECKOUT) {
      visiting.checkinTime = (
        await visitingStatusController.getVisitorVisitingsStatus({
          visitingId: visiting.id,
          status: VISITOR_STATUSES.CHECKIN,
        })
      )[0].createdAt;
    }
  }

  return buildingVisitings;
}

async function getVisitingsHistory(
  params,
  { limit, offset },
  language = LANGUAGES.EN,
  timezone = TIMEZONES.INDIA
) {
  let startDate, endDate;
  if (params.startDate && params.endDate) {
    const startDateObj = getDateTimeObjectFromTimezone(
      params.startDate,
      timezone
    );
    startDate = moment(startDateObj).tz(timezone).startOf("day").format();
    const endDateObj = getDateTimeObjectFromTimezone(params.endDate, timezone);
    endDate = moment(endDateObj).tz(timezone).endOf("day").format();
  }
  //TODO: startDate and endDate validation
  const query = `
    select vvs.status, vv.id, f.floor, f.name_${language} as "flatName", vt.category_${language} as category, vvs."createdAt",
    case when v."profilePicture" is not null then v."profilePicture" else vt.image end as image,
    case when vv.name is not null then vv.name when vt.company_${language} is not null then vt.company_${language} else vt.category_${language} end as name,
    v."documentImage", v."documentId", v."documentType", v."documentCountry", v."mobileNumber", v."documentExpiry", v."documentExpireMonth", v."documentIssueState", v."documentIssueDate", v."passportNumber", v."additionalDetails",
    vv."metaData", vvs."createdAt" as "lastStatusTime",
    b.id as "buildingId", b."name_${language}" as "buildingName",
    COUNT(*) OVER () as "count"
    from (
      select DISTINCT ON(vvs."visitingId") vvs.status, vvs."visitingId", vvs."createdAt"
      from visitor_visiting_statuses vvs
      ${
        startDate && endDate
          ? `where vvs."createdAt" > :startDate and vvs."createdAt" < :endDate`
          : ""
      }
      order by vvs."visitingId", vvs."createdAt" DESC
    ) as vvs
    join visitor_visitings vv on vv.id = vvs."visitingId"
    join flats f on vv."flatId"=f.id
    join buildings b on b.id = f."buildingId"
    join visitor_types vt on vt.id = vv."visitorTypeId"
    left join visitors v on v.id = vv."visitorId"
    left join preapproved_visitings pv on pv.id=vv."preapprovedId"
    where b."propertyId" = :propertyId ${
      params.search
        ? `and (
      vv.name ilike '%${params.search}%'
      or vt.category_${language} ilike '%${params.search}%'
      or vt.company_${language} ilike '%${params.search}%'
      or f.name_${language} ilike '%${params.search}%'
      or f.floor ilike '%${params.search}%'
    )`
        : ""
    }
    ${
      params.category
        ? `and cast(vt.category_${language} as text) = ANY (Array [:category])`
        : ""
    }
    and vvs.status = :status
    and vv."deletedAt" is null
    order by vvs."createdAt" DESC
    limit :limit offset :offset
  `;
  const buildingVisitings = await db.sequelize.query(query, {
    raw: true,
    type: db.Sequelize.QueryTypes.SELECT,
    replacements: {
      propertyId: params.propertyId,
      status: VISITOR_STATUSES.CHECKOUT,
      category: [params.category],
      startDate,
      endDate,
      limit,
      offset,
    },
  });
  for (const visiting of buildingVisitings) {
    visiting.creationTime = moment(visiting.createdAt).from(moment());
    if (visiting.status == VISITOR_STATUSES.CHECKOUT) {
      visiting.checkinTime = (
        await visitingStatusController.getVisitorVisitingsStatus({
          visitingId: visiting.id,
          status: VISITOR_STATUSES.CHECKIN,
        })
      )[0]?.createdAt;
    }
  }

  return buildingVisitings;
}

//get visiting requests - guard
async function getRequestedVisitorsInABuilding(
  { propertyId, search = null },
  { limit, offset },
  language = LANGUAGES.EN
) {
  const query = `
    select vvs.status, vv.id, f.floor, f.name_${language} as "flatName", vt.category_${language} as category, vt.company_${language} as company, vvs."createdAt",
    case when v."profilePicture" is not null then v."profilePicture" else vt.image end as image,
    case when vv.name is not null then vv.name when vt.company_${language} is not null then vt.company_${language} else vt.category_${language} end as name,
    vv."metaData", b.id as "buildingId", b."name_${language}" as "buildingName",
    COUNT (*) OVER () as count
    from (
      select DISTINCT ON(vvs."visitingId") vvs.status, vvs."visitingId", vvs."createdAt"
      from visitor_visiting_statuses vvs
      order by vvs."visitingId", vvs."createdAt" DESC
    ) as vvs
    join visitor_visitings vv on vv.id = vvs."visitingId"
    join flats f on vv."flatId"=f.id
    join buildings b on b.id = f."buildingId"
    join visitor_types vt on vt.id = vv."visitorTypeId"
    left join visitors v on v.id = vv."visitorId"
    where b."propertyId" = :propertyId
    and cast(vvs.status as text) = ANY (Array [:statuses])
    and vv."deletedAt" is null ${
      search
        ? `and (
      vv.name ilike '%${search}%'
      or vt.category_${language} ilike '%${search}%'
      or vt.company_${language} ilike '%${search}%'
      or f.name_${language} ilike '%${search}%'
      or f.floor ilike '%${search}%'
    )`
        : ""
    }
    order by vvs."createdAt" DESC
    limit :limit offset :offset
  `;
  const buildingVisitings = await db.sequelize.query(query, {
    raw: true,
    type: db.Sequelize.QueryTypes.SELECT,
    replacements: {
      propertyId: propertyId,
      statuses: [
        VISITOR_STATUSES.PENDING,
        VISITOR_STATUSES.APPROVED,
        VISITOR_STATUSES.DENIED,
      ],
      limit,
      offset,
    },
  });

  for (const visiting of buildingVisitings) {
    visiting.creationTime = moment(visiting.createdAt).from(moment());
  }

  return buildingVisitings;
}

async function getVisitingLogs(params, { limit, offset }, timezone) {
  const {
    buildingId,
    checkInDate,
    checkOutDate,
    status,
    category_en,
    flatIds,
    companyId,
    search,
  } = params;

  const query = `
    select vt.category_en, vt.category_ar, vt.company_en, vt.company_ar, vv.name, f.name_en as "flatName_en", f.name_ar as "flatName_ar", 
    v."mobileNumber", v."profilePicture", v."documentId", v."documentImage", v."documentType", v."documentCountry", v."documentExpiry", v."documentIssueState", v."documentIssueDate", v."passportNumber", v."additionalDetails",
    vvs2."createdAt" as "outTime", vvs1."createdAt" as "inTime", vv.id,
    vv."metaData"->>'description' as description, vv."visitorsCount", f."floor", b.id as "buildingId", b.name_en as "buildingName_en", b.name_ar as "buildingName_ar",
    case when vv."preapprovedId" is not null then 'Resident' else 'Guard' end as "approvedBy",
    COUNT(*) OVER () as "totalCount"
    from (
      select Distinct ON("visitingId") "createdAt", "visitingId" from visitor_visiting_statuses 
      where status = '${VISITOR_STATUSES.CHECKIN}'
      order by "visitingId", "createdAt" DESC
    ) as vvs1
    left join (
       select Distinct ON("visitingId") "createdAt", "visitingId" from visitor_visiting_statuses 
       where status = '${VISITOR_STATUSES.CHECKOUT}'
       order by "visitingId", "createdAt" DESC
    ) as vvs2 on vvs1."visitingId" = vvs2."visitingId" and vvs1."createdAt" < vvs2."createdAt"
    join visitor_visitings vv on vv.id = vvs1."visitingId"
    join flats f on ( f.id = vv."flatId" and f."deletedAt" is null)
    join buildings b on (b.id = f."buildingId" and b."deletedAt" is null)
    join visitor_types vt on (vt.id = vv."visitorTypeId")
    join visitors v on (v.id = vv."visitorId" and v."deletedAt" is null)
    where f."buildingId" = :buildingId ${
      search
        ? `and (vv.name ilike '%${search}%' 
      or vt.category_en ilike '%${search}%'
      or v."mobileNumber" ilike '%${search}%'
      or vt.company_en ilike '%${search}%'
      or b.name_en ilike '%${search}%'
      or b.name_en ilike '%${search}%'
      or f.name_en ilike '%${search}%'
      or cast(vvs1."createdAt" as text) ilike '%${search}%'
      )`
        : ""
    }
    ${checkInDate ? `and vvs1."createdAt" >= :checkInDate` : ""}
    ${checkOutDate ? `and vvs1."createdAt" <= :checkOutDate` : ""}
    ${flatIds ? `and f.id in (:flatIds)` : ""}
    ${category_en ? `and vt.category_en ilike :category_en` : ""}
    ${companyId ? `and vt.id = :companyId` : ""}
      ${
        status
          ? status === VISITING_STATUSES.ACTIVE
            ? `and vvs2."createdAt" is null`
            : `and vvs2."createdAt" is not null`
          : ""
      }
    and vv."deletedAt" is null
    order by vvs1."createdAt" desc
    limit :limit offset :offset
  `;

  const visitingLogs = await db.sequelize.query(query, {
    raw: true,
    type: db.Sequelize.QueryTypes.SELECT,
    replacements: {
      buildingId,
      checkInDate: checkInDate
        ? getDateTimeObjectFromTimezone(checkInDate, timezone)
        : null,
      checkOutDate: checkOutDate
        ? getDateTimeObjectFromTimezone(checkOutDate, timezone)
        : null,
      flatIds,
      companyId,
      category_en: `%${category_en}%`,
      limit,
      offset,
    },
  });

  const totalCount = visitingLogs.length ? +visitingLogs[0].totalCount : 0;

  for (const visitingLog of visitingLogs) {
    if (visitingLog.outTime) {
      visitingLog.duration = moment(visitingLog.outTime).from(
        visitingLog.inTime,
        true
      );
    }
    delete visitingLog.totalCount;
  }

  return { count: totalCount, rows: visitingLogs };
}

async function getVisitingLogsNew(params, { limit, offset }, timezone) {
  const {
    buildingId,
    checkInDate,
    checkOutDate,
    status,
    categoryId,
    propertyId,
    flatIds,
    companyId,
    search,
    categoryName,
  } = params;

  const query = `
    select vt.category_en, vt.category_ar, case when vt.company_en is not null then vt.company_en else vv."metaData"->>'companyName' end as company_en, vt.company_ar, vv.name, f.name_en as "flatName_en", f.name_ar as "flatName_ar", 
    v."mobileNumber", v."profilePicture", v."documentId", v."documentImage", v."documentType", v."documentCountry", v."documentExpiry", v."documentIssueState", v."documentIssueDate", v."passportNumber", v."additionalDetails",
    vvs2."createdAt" as "outTime", vvs1."createdAt" as "inTime", vv.id,
    vv."metaData"->>'description' as description, vv."visitorsCount", f."floor", b.id as "buildingId", b.name_en as "buildingName_en", b.name_ar as "buildingName_ar",
    case when vv."preapprovedId" is not null then 'Resident' else 'Guard' end as "approvedBy",
    COUNT(*) OVER () as "totalCount"
    from (
      select Distinct ON("visitingId") "createdAt", "visitingId" from visitor_visiting_statuses 
      where status = '${VISITOR_STATUSES.CHECKIN}'
      order by "visitingId", "createdAt" DESC
    ) as vvs1
    left join (
       select Distinct ON("visitingId") "createdAt", "visitingId" from visitor_visiting_statuses 
       where status = '${VISITOR_STATUSES.CHECKOUT}'
       order by "visitingId", "createdAt" DESC
    ) as vvs2 on vvs1."visitingId" = vvs2."visitingId" and vvs1."createdAt" < vvs2."createdAt"
    join visitor_visitings vv on vv.id = vvs1."visitingId"
    join flats f on ( f.id = vv."flatId" and f."deletedAt" is null)
    join buildings b on (b.id = f."buildingId" and b."deletedAt" is null)
    join visitor_types vt on (vt.id = vv."visitorTypeId")
    join visitors v on (v.id = vv."visitorId" and v."deletedAt" is null)
    where f."buildingId" = :buildingId ${
      search
        ? `and (vv.name ilike '%${search}%' 
      or vt.category_en ilike '%${search}%'
      or v."mobileNumber" ilike '%${search}%'
      or vt.company_en ilike '%${search}%'
      or b.name_en ilike '%${search}%'
      or b.name_en ilike '%${search}%'
      or f.name_en ilike '%${search}%'
      or cast(vvs1."createdAt" as text) ilike '%${search}%'
      )`
        : ""
    }
    ${checkInDate ? `and vvs1."createdAt" >= :checkInDate` : ""}
    ${checkOutDate ? `and vvs1."createdAt" <= :checkOutDate` : ""}
    ${flatIds ? `and f.id in (:flatIds)` : ""}
    ${categoryId ? `and vt.id = :categoryId` : ""}
    ${categoryName ? `and vt.category_en = :categoryName` : ""}
    ${companyId ? `and vt.id = :companyId` : ""}
      ${
        status
          ? status === VISITING_STATUSES.ACTIVE
            ? `and vvs2."createdAt" is null`
            : `and vvs2."createdAt" is not null`
          : ""
      }
    and vv."deletedAt" is null
    order by vvs1."createdAt" desc
    limit :limit offset :offset
  `;

  const visitingLogs = await db.sequelize.query(query, {
    raw: true,
    type: db.Sequelize.QueryTypes.SELECT,
    replacements: {
      buildingId,
      checkInDate,
      checkOutDate,
      flatIds,
      companyId,
      categoryId,
      categoryName,
      propertyId,
      limit,
      offset,
    },
  });

  const totalCount = visitingLogs.length ? +visitingLogs[0].totalCount : 0;

  for (const visitingLog of visitingLogs) {
    if (visitingLog.outTime) {
      visitingLog.duration = moment(visitingLog.outTime).from(
        visitingLog.inTime,
        true
      );
    }
    delete visitingLog.totalCount;
  }

  return { count: totalCount, rows: visitingLogs };
}

async function getVisitingLogsOfProperty(params, { limit, offset }, timezone) {
  const {
    propertyId,
    checkInDate,
    checkOutDate,
    status,
    category_en,
    flatIds,
    companyId,
    search,
  } = params;

  const query = `
    select vt.category_en, vt.category_ar, vt.company_en, vt.company_ar, vv.name, f.name_en as "flatName_en", f.name_ar as "flatName_ar", 
    v."mobileNumber", v."profilePicture", v."documentId", v."documentImage", v."documentType", v."documentCountry", v."documentExpiry", v."documentIssueState", v."documentIssueDate", v."passportNumber", v."additionalDetails",
    vvs2."createdAt" as "outTime", vvs1."createdAt" as "inTime", vv.id,
    vv."metaData"->>'description' as description, vv."visitorsCount", f."floor", b.id as "buildingId", b.name_en as "buildingName_en", b.name_ar as "buildingName_ar",
    case when vv."preapprovedId" is not null then 'Resident' else 'Guard' end as "approvedBy",
    COUNT(*) OVER () as "totalCount"
    from (
      select Distinct ON("visitingId") "createdAt", "visitingId" from visitor_visiting_statuses 
      where status = '${VISITOR_STATUSES.CHECKIN}'
      order by "visitingId", "createdAt" DESC
    ) as vvs1
    left join (
       select Distinct ON("visitingId") "createdAt", "visitingId" from visitor_visiting_statuses 
       where status = '${VISITOR_STATUSES.CHECKOUT}'
       order by "visitingId", "createdAt" DESC
    ) as vvs2 on vvs1."visitingId" = vvs2."visitingId" and vvs1."createdAt" < vvs2."createdAt"
    join visitor_visitings vv on vv.id = vvs1."visitingId"
    join flats f on ( f.id = vv."flatId" and f."deletedAt" is null)
    join buildings b on (b.id = f."buildingId" and b."deletedAt" is null)
    join visitor_types vt on (vt.id = vv."visitorTypeId")
    join visitors v on (v.id = vv."visitorId" and v."deletedAt" is null)
    where b."propertyId" = :propertyId ${
      search
        ? `and (vv.name ilike '%${search}%' 
      or vt.category_en ilike '%${search}%'
      or v."mobileNumber" ilike '%${search}%'
      or vt.company_en ilike '%${search}%'
      or b.name_en ilike '%${search}%'
      or b.name_en ilike '%${search}%'
      or f.name_en ilike '%${search}%'
      or cast(vvs1."createdAt" as text) ilike '%${search}%'
      )`
        : ""
    }
    ${checkInDate ? `and vvs1."createdAt" >= :checkInDate` : ""}
    ${checkOutDate ? `and vvs1."createdAt" <= :checkOutDate` : ""}
    ${category_en ? `and vt.category_en ilike :category_en` : ""}
      ${
        status
          ? status === VISITING_STATUSES.ACTIVE
            ? `and vvs2."createdAt" is null`
            : `and vvs2."createdAt" is not null`
          : ""
      }
    ${flatIds ? `and f.id in (:flatIds)` : ""}
    ${companyId ? `and vt.id = :companyId` : ""}
    and vv."deletedAt" is null
    order by vvs1."createdAt" desc
    limit :limit offset :offset
  `;

  const visitingLogs = await db.sequelize.query(query, {
    raw: true,
    type: db.Sequelize.QueryTypes.SELECT,
    replacements: {
      propertyId,
      checkInDate: checkInDate
        ? getDateTimeObjectFromTimezone(checkInDate, timezone)
        : null,
      checkOutDate: checkOutDate
        ? getDateTimeObjectFromTimezone(checkOutDate, timezone)
        : null,
      flatIds,
      companyId,
      category_en: `%${category_en}%`,
      limit,
      offset,
    },
  });

  const totalCount = visitingLogs.length ? +visitingLogs[0].totalCount : 0;

  for (const visitingLog of visitingLogs) {
    if (visitingLog.outTime) {
      visitingLog.duration = moment(visitingLog.outTime).from(
        visitingLog.inTime,
        true
      );
    }
    delete visitingLog.totalCount;
  }

  return { count: totalCount, rows: visitingLogs };
}

async function getVisitingLogsOfPropertyNew(
  params,
  { limit, offset },
  timezone
) {
  const {
    propertyId,
    checkInDate,
    checkOutDate,
    status,
    categoryId,
    flatIds,
    companyId,
    search,
    categoryName,
  } = params;
  const query = `
    select vt.category_en, vt.category_ar, case when vt.company_en is not null then vt.company_en else vv."metaData"->>'companyName' end as company_en, vt.company_ar, vv.name, f.name_en as "flatName_en", f.name_ar as "flatName_ar", 
    v."mobileNumber", v."profilePicture", v."documentId", v."documentImage", v."documentType", v."documentCountry", v."documentExpiry", v."documentIssueState", v."documentIssueDate", v."passportNumber", v."additionalDetails",
    vvs2."createdAt" as "outTime", vvs1."createdAt" as "inTime", vv.id,
    vv."metaData"->>'description' as description, vv."visitorsCount", f."floor", b.id as "buildingId", b.name_en as "buildingName_en", b.name_ar as "buildingName_ar",
    case when vv."preapprovedId" is not null then 'Resident' else 'Guard' end as "approvedBy",
    COUNT(*) OVER () as "totalCount"
    from (
      select Distinct ON("visitingId") "createdAt", "visitingId" from visitor_visiting_statuses 
      where status = '${VISITOR_STATUSES.CHECKIN}'
      order by "visitingId", "createdAt" DESC
    ) as vvs1
    left join (
       select Distinct ON("visitingId") "createdAt", "visitingId" from visitor_visiting_statuses 
       where status = '${VISITOR_STATUSES.CHECKOUT}'
       order by "visitingId", "createdAt" DESC
    ) as vvs2 on vvs1."visitingId" = vvs2."visitingId" and vvs1."createdAt" < vvs2."createdAt"
    join visitor_visitings vv on vv.id = vvs1."visitingId"
    join flats f on ( f.id = vv."flatId" and f."deletedAt" is null)
    join buildings b on (b.id = f."buildingId" and b."deletedAt" is null)
    join visitor_types vt on (vt.id = vv."visitorTypeId")
    join visitors v on (v.id = vv."visitorId" and v."deletedAt" is null)
    where b."propertyId" = :propertyId ${
      search
        ? `and (vv.name ilike '%${search}%' 
      or vt.category_en ilike '%${search}%'
      or v."mobileNumber" ilike '%${search}%'
      or vt.company_en ilike '%${search}%'
      or b.name_en ilike '%${search}%'
      or b.name_en ilike '%${search}%'
      or f.name_en ilike '%${search}%'
      or cast(vvs1."createdAt" as text) ilike '%${search}%'
      )`
        : ""
    }
    ${checkInDate ? `and vvs1."createdAt" >= :checkInDate` : ""}
    ${checkOutDate ? `and vvs1."createdAt" <= :checkOutDate` : ""}
     ${categoryId ? `and vt.id = :categoryId ` : ""}
    ${categoryName ? `and vt.category_en = :categoryName` : ""}
      ${
        status
          ? status === VISITING_STATUSES.ACTIVE
            ? `and vvs2."createdAt" is null`
            : `and vvs2."createdAt" is not null`
          : ""
      }
    ${flatIds ? `and f.id in (:flatIds)` : ""}
    ${companyId ? `and vt.id = :companyId` : ""}
    and vv."deletedAt" is null
    order by vvs1."createdAt" desc
    limit :limit offset :offset
  `;

  const visitingLogs = await db.sequelize.query(query, {
    raw: true,
    type: db.Sequelize.QueryTypes.SELECT,
    replacements: {
      propertyId,
      checkInDate,
      checkOutDate,
      flatIds,
      companyId,
      categoryId,
      categoryName,
      limit,
      offset,
    },
  });

  const totalCount = visitingLogs.length ? +visitingLogs[0].totalCount : 0;

  for (const visitingLog of visitingLogs) {
    if (visitingLog.outTime) {
      visitingLog.duration = moment(visitingLog.outTime).from(
        visitingLog.inTime,
        true
      );
    }
    delete visitingLog.totalCount;
  }

  return { count: totalCount, rows: visitingLogs };
}

async function getPreapprovedVisitingsByFlat(
  params,
  { limit, offset },
  language = LANGUAGES.EN
) {
  const query = `
    select vv.id, f.floor, f.name_${language} as "flatName", b.id as "buildingId", b.name_${language} as "buildingName",
    vt.category_${language} as "category", vt."image" as "categoryImage", vv."visitorsCount", vt.company_${language} as company,
    case when vv.name is not null then vv.name else vt.company_${language} end as name,
    v.id as "visitor.id", v."profilePicture" as "visitor.profilePicture", vv.name as "visitor.name", v."mobileNumber" as "visitor.mobileNumber", 
    v."documentId" as "visitor.documentId", v."documentType" as "visitor.documentType", v."documentImage" as "visitor.documentImage",
    u.id as "resident.id", u."profilePicture" as "resident.profilePicture", u.name as "resident.name", u."mobileNumber" as "resident.mobileNumber",
    vvs.status, vv."metaData", pv."isFrequent"
    from visitor_visitings vv
    left join (
      select Distinct ON("visitingId") status, "createdAt", "visitingId"
      from visitor_visiting_statuses
      order by "visitingId", "createdAt" DESC
    ) as vvs on vvs."visitingId" = vv.id
    join visitor_types vt on vt.id = vv."visitorTypeId"
    join preapproved_visitings pv on pv.id = vv."preapprovedId"
    left join visitors v on v.id = vv."visitorId"
    join flats f on f.id = vv."flatId"
    join buildings b on f."buildingId"=b.id
    join users u on u.id = vv."residentId"
    where vv."flatId" = :flatId
    and vv."residentId" is not null
    and pv."inTime" <= :inTime and pv."outTime" >= :outTime
    and (vvs.status is null or vvs.status != '${VISITOR_STATUSES.CHECKIN}')
    and (pv."isFrequent" = true or vvs.status is null)
    and vv."deletedAt" is null
    order by vv."createdAt" DESC
    limit :limit offset :offset
  `;
  const buildingVisitings = await db.sequelize.query(query, {
    raw: true,
    type: db.Sequelize.QueryTypes.SELECT,
    replacements: {
      flatId: params.flatId,
      inTime: moment().add(10, "minutes").toDate(),
      outTime: new Date(),
      limit,
      offset,
    },
    nest: true,
  });

  return buildingVisitings;
}

//get active visitings - guard
async function getVisitingDetailWithLastStatusAndResident(params, language) {
  const query = `
    select vv.id, vv.name, vvs.status, vt.category_${language} as category, vt.company_${language} as company, v."mobileNumber", vvs."guardId",
    case when vv.name is not null then vv.name when vt.company_${language} is not null then vt.company_${language} else vt.category_${language} end as name,
    case when v."profilePicture" is not null then v."profilePicture" else vt.image end as image,
    v."profilePicture", vt.image as "categoryImage",
    v."documentImage", v."documentId", v."documentType", v."documentCountry", v."mobileNumber", v."documentExpiry", v."documentExpireMonth", v."documentIssueState", v."documentIssueDate", v."passportNumber", v."additionalDetails",
    u.name as "resident.name", u."profilePicture" as "resident.profilePicture", u."mobileNumber" as "resident.mobileNumber", f.floor, f.name_${language} as "flatName",
    vv."metaData", vv."visitorsCount", vv."brokerDetails", vv."salesAdvisor", b.id as "buildingId", b."name_${language}" as "buildingName"
    from visitor_visitings vv
    left join visitors v on (v.id = vv."visitorId" and v."deletedAt" is NULL)
    left join (
      select Distinct ON("visitingId") status, "createdAt", "visitingId", "guardId"
      from visitor_visiting_statuses
      where "deletedAt" is null
      order by "visitingId", "createdAt" DESC
    ) as vvs on vvs."visitingId" = vv.id
    join visitor_types vt on (vt.id = vv."visitorTypeId" and vt."deletedAt" is NULL)
    join flats f on (f.id = vv."flatId" and f."deletedAt" is NULL)
    join buildings b on (f."buildingId"=b.id and b."deletedAt" is null)
    left join users u on( u."flatId" = f.id and u."familyMemberId" is null and u."deletedAt" is null)
    where vv.id = :visitingId
    and b."propertyId" = :propertyId and vv."deletedAt" is null
  `; //TODO: remove image key once prod build published
  const visiting = await db.sequelize.query(query, {
    raw: true,
    type: db.Sequelize.QueryTypes.SELECT,
    replacements: {
      visitingId: params.visitingId,
      propertyId: params.propertyId,
    },
    nest: true,
  });

  return visiting;
}

async function addOrUpdateVisitorInVisiting(params, data) {
  const visiting = await visitingStatusController.validateGuardIdForVisiting({
    visitingId: params.visitingId,
    guardBuildingId: params.guardBuildingId,
  });

  delete data.id;
  const visitor = await visitorController.addOrUpdate(data);

  visiting.visitorId = visitor.id;
  data.name && (visiting.name = data.name);

  if (data.hasOwnProperty("metaData")) {
    visiting.metaData = data.metaData;
  }

  await visiting.save();

  return visiting;
}

async function getVisitingDetails({ visitingId }) {
  const query = `
  select vv.id, vv.name, vt.category_en, vt.category_ar, case when vt.company_en is not null then vt.company_en else vv."metaData"->>'companyName' end as company_en,case when vt.company_en is  null then 'Others' else 'Normal' end as company_type, vt.company_ar, v."mobileNumber", v."documentId", v."documentImage", v."documentType",
  v."documentCountry", v."documentExpiry", v."documentIssueState", v."documentIssueDate", v."passportNumber", v."profilePicture",
  v."additionalDetails", vv."metaData"->>'description' as description, vv."metaData"->>'companyName' as "customCompanyName", v."additionalDetails"->>'vehicleNumber' as "vehicleNumber", vv."brokerDetails", vv."salesAdvisor", vvs1."createdAt" as "inTime", vvs2."createdAt" as "outTime", vv."visitorsCount", f.floor, 
  f.name_en as "flatName_en", f.name_ar as "flatName_ar", b.name_en as "buildingName_en", b.name_ar as "buildingName_ar",
  case when vv."preapprovedId" is not null then 'Resident' else 'Guard' end as "approvedBy"
  from (
    select Distinct ON("visitingId") "createdAt", "visitingId" from visitor_visiting_statuses 
    where status = '${VISITOR_STATUSES.CHECKIN}' order by "visitingId", "createdAt" DESC
  ) as vvs1
  left join (
    select Distinct ON("visitingId") "createdAt", "visitingId" from visitor_visiting_statuses 
    where status = '${VISITOR_STATUSES.CHECKOUT}' order by "visitingId", "createdAt" DESC
  ) as vvs2 on vvs1."visitingId" = vvs2."visitingId" and vvs1."createdAt" < vvs2."createdAt"
  join visitor_visitings vv on vv.id = vvs1."visitingId"
  join flats f on f.id = vv."flatId"
  join buildings b on b.id = f."buildingId"
  join visitor_types vt on vt.id = vv."visitorTypeId"
  join visitors v on v.id = vv."visitorId"
  where vv.id = :visitingId
  `;
  const visiting = await db.sequelize.query(query, {
    raw: true,
    type: db.Sequelize.QueryTypes.SELECT,
    replacements: {
      visitingId,
    },
  });
  if (!visiting || !visiting.length) {
    throw new AppError(
      "getVisitingDetails",
      "Visiting not found",
      "custom",
      404
    );
  }
  return visiting[0];
}

async function getDailyVisitorTraffic({ buildingIds, startDate, endDate }) {
  const query = `
  select count(vvs.*), vvs."createdAt"::DATE as "date"
  from visitor_visiting_statuses vvs 
  join visitor_visitings vv on vv.id = vvs."visitingId"
  join flats f on (f.id = vv."flatId" and f."buildingId" in (:buildingIds))
  where vvs.status = :status and vvs."createdAt" >= :startDate and vvs."createdAt" <= :endDate
  group by date order by date asc`;

  const traffic = await db.sequelize.query(query, {
    type: db.Sequelize.QueryTypes.SELECT,
    replacements: {
      buildingIds,
      status: VISITOR_STATUSES.CHECKIN,
      startDate,
      endDate,
    },
  });
  return traffic;
}

async function getVisitingsByLastStatusesForGuard(
  params,
  { limit, offset },
  language = LANGUAGES.EN
) {
  const query = `
    select vvs.status, vv.id, f.floor, f.name_${language} as "flatName", vt.category_${language} as category, vt.company_${language} as company, vvs."createdAt",
    case when v."profilePicture" is not null then v."profilePicture" else vt.image end as image,
    case when vv.name is not null then vv.name when vt.company_${language} is not null then vt.company_${language} else vt.category_${language} end as name,
    v."documentImage", v."documentId", v."documentType", v."documentCountry", v."mobileNumber", v."documentExpiry", v."documentExpireMonth", v."documentIssueState", v."documentIssueDate", v."passportNumber", v."additionalDetails",
    vv."metaData", vvs."createdAt" as "lastStatusTime",
    b.id as "buildingId", b."name_${language}" as "buildingName",
    COUNT (*) OVER () as count
    from (
      select DISTINCT ON(vvs."visitingId") vvs.status, vvs."visitingId", vvs."createdAt"
      from visitor_visiting_statuses vvs
      order by vvs."visitingId", vvs."createdAt" DESC
    ) as vvs
    join visitor_visitings vv on vv.id = vvs."visitingId"
    join flats f on vv."flatId"=f.id
    join buildings b on b.id = f."buildingId"
    join guard_buildings gb on (gb."buildingId" = f."buildingId" and gb."guardId" = :guardId and gb."deletedAt" is null)
    join visitor_types vt on vt.id = vv."visitorTypeId"
    left join visitors v on v.id = vv."visitorId"
    left join preapproved_visitings pv on pv.id=vv."preapprovedId"
    where cast(vvs.status as text) = ANY (Array [:statuses])
    and vv."deletedAt" is null ${
      params.buildingId ? `and gb."buildingId" = '${params.buildingId}'` : ""
    } ${
    params.search
      ? `and (
      vv.name ilike '%${params.search}%'
      or vt.category_${language} ilike '%${params.search}%'
      or vt.company_${language} ilike '%${params.search}%'
      or v."documentId" ilike '%${params.search}%'
      or v."documentType" ilike '%${params.search}%'
      or v."documentCountry" ilike '%${params.search}%'
      or v."mobileNumber" ilike '%${params.search}%'
      or v."documentIssueState" ilike '%${params.search}%'
      or v."passportNumber" ilike '%${params.search}%'
      or v."additionalDetails"->>'nameOnDocument' ilike '%${params.search}%'
      or v."additionalDetails"->>'numberOnDocument' ilike '%${params.search}%'
      or v."additionalDetails"->>'vehicleNumber' ilike '%${params.search}%'
      or v."additionalDetails"->>'occupation' ilike '%${params.search}%'
      or v."additionalDetails"->>'cardNumber' ilike '%${params.search}%'
      or v."additionalDetails"->>'email' ilike '%${params.search}%'
      or v."additionalDetails"->>'age' ilike '%${params.search}%'
      or v."additionalDetails"->>'gender' ilike '%${params.search}%'
      or f.name_${language} ilike '%${params.search}%'
      or f.floor ilike '%${params.search}%'
      or b.name_${language} ilike '%${params.search}%'
      or vv."metaData"->>'description' ilike '%${params.search}%'
    )`
      : ""
  }
    order by vvs."createdAt" DESC
    limit :limit offset :offset
  `;
  const buildingVisitings = await db.sequelize.query(query, {
    raw: true,
    type: db.Sequelize.QueryTypes.SELECT,
    replacements: {
      statuses: [params.status],
      nameRegex: params.name ? `%${params.name}%` : "%",
      guardId: params.guardId,
      limit,
      offset,
    },
  });

  for (const visiting of buildingVisitings) {
    visiting.creationTime = moment(visiting.createdAt).from(moment());
    if (visiting.status == VISITOR_STATUSES.CHECKOUT) {
      visiting.checkinTime = (
        await visitingStatusController.getVisitorVisitingsStatus({
          visitingId: visiting.id,
          status: VISITOR_STATUSES.CHECKIN,
        })
      )[0].createdAt;
    }
  }

  return buildingVisitings;
}

async function getVisitingsHistoryForGuard(
  params,
  { limit, offset },
  language = LANGUAGES.EN,
  timezone = TIMEZONES.INDIA
) {
  let startDate, endDate;
  if (params.startDate && params.endDate) {
    const startDateObj = getDateTimeObjectFromTimezone(
      params.startDate,
      timezone
    );
    startDate = moment(startDateObj).tz(timezone).startOf("day").format();
    const endDateObj = getDateTimeObjectFromTimezone(params.endDate, timezone);
    endDate = moment(endDateObj).tz(timezone).endOf("day").format();
  }
  //TODO: startDate and endDate validation
  const query = `
    select vvs.status, vv.id, f.floor, f.name_${language} as "flatName", vt.category_${language} as category, vvs."createdAt",
    case when v."profilePicture" is not null then v."profilePicture" else vt.image end as image,
    case when vv.name is not null then vv.name when vt.company_${language} is not null then vt.company_${language} else vt.category_${language} end as name,
    v."documentImage", v."documentId", v."documentType", v."documentCountry", v."mobileNumber", v."documentExpiry", v."documentExpireMonth", v."documentIssueState", v."documentIssueDate", v."passportNumber", v."additionalDetails",
    vv."metaData", vvs."createdAt" as "lastStatusTime",
    b.id as "buildingId", b."name_${language}" as "buildingName",
    COUNT(*) OVER () as "count"
    from (
      select DISTINCT ON(vvs."visitingId") vvs.status, vvs."visitingId", vvs."createdAt"
      from visitor_visiting_statuses vvs
      ${
        startDate && endDate
          ? `where vvs."createdAt" > :startDate and vvs."createdAt" < :endDate`
          : ""
      }
      order by vvs."visitingId", vvs."createdAt" DESC
    ) as vvs
    join visitor_visitings vv on vv.id = vvs."visitingId"
    join flats f on vv."flatId"=f.id
    join buildings b on b.id = f."buildingId"
    join guard_buildings gb on (gb."buildingId" = f."buildingId" and gb."deletedAt" is null and gb."guardId" = :guardId)
    join visitor_types vt on vt.id = vv."visitorTypeId"
    left join visitors v on v.id = vv."visitorId"
    left join preapproved_visitings pv on pv.id=vv."preapprovedId"
    where vvs.status = :status ${
      params.buildingId ? `and gb."buildingId" = '${params.buildingId}'` : ""
    } ${
    params.search
      ? `and (
      vv.name ilike '%${params.search}%'
      or vt.category_${language} ilike '%${params.search}%'
      or vt.company_${language} ilike '%${params.search}%'
      or v."documentId" ilike '%${params.search}%'
      or v."documentType" ilike '%${params.search}%'
      or v."documentCountry" ilike '%${params.search}%'
      or v."mobileNumber" ilike '%${params.search}%'
      or v."documentIssueState" ilike '%${params.search}%'
      or v."passportNumber" ilike '%${params.search}%'
      or v."additionalDetails"->>'nameOnDocument' ilike '%${params.search}%'
      or v."additionalDetails"->>'numberOnDocument' ilike '%${params.search}%'
      or v."additionalDetails"->>'vehicleNumber' ilike '%${params.search}%'
      or v."additionalDetails"->>'occupation' ilike '%${params.search}%'
      or v."additionalDetails"->>'cardNumber' ilike '%${params.search}%'
      or v."additionalDetails"->>'email' ilike '%${params.search}%'
      or v."additionalDetails"->>'age' ilike '%${params.search}%'
      or v."additionalDetails"->>'gender' ilike '%${params.search}%'
      or f.name_${language} ilike '%${params.search}%'
      or f.floor ilike '%${params.search}%'
      or b.name_${language} ilike '%${params.search}%'
      or vv."metaData"->>'description' ilike '%${params.search}%'
    )`
      : ""
  }
    ${
      params.category
        ? `and cast(vt.category_${language} as text) = ANY (Array [:category])`
        : ""
    }
    ${params.flatId ? `and f.id = '${params.flatId}'` : ""}
    and vv."deletedAt" is null
    order by vvs."createdAt" DESC
    limit :limit offset :offset
  `;
  const buildingVisitings = await db.sequelize.query(query, {
    raw: true,
    type: db.Sequelize.QueryTypes.SELECT,
    replacements: {
      status: VISITOR_STATUSES.CHECKOUT,
      category: [params.category],
      guardId: params.guardId,
      startDate,
      endDate,
      limit,
      offset,
    },
  });
  for (const visiting of buildingVisitings) {
    visiting.creationTime = moment(visiting.createdAt).from(moment());
    if (visiting.status == VISITOR_STATUSES.CHECKOUT) {
      visiting.checkinTime = (
        await visitingStatusController.getVisitorVisitingsStatus({
          visitingId: visiting.id,
          status: VISITOR_STATUSES.CHECKIN,
        })
      )[0]?.createdAt;
    }
  }

  return buildingVisitings;
}

async function getRequestedVisitorsForGuard(
  { guardId, search = null, buildingId = null },
  { limit, offset },
  language = LANGUAGES.EN
) {
  const query = `
    select vvs.status, vv.id, f.floor, f.name_${language} as "flatName", vt.category_${language} as category, vt.company_${language} as company, vvs."createdAt",
    case when v."profilePicture" is not null then v."profilePicture" else vt.image end as image,
    case when vv.name is not null then vv.name when vt.company_${language} is not null then vt.company_${language} else vt.category_${language} end as name,
    v."documentImage", v."documentId", v."documentType", v."documentCountry", v."mobileNumber", v."documentExpiry", v."documentExpireMonth", v."documentIssueState", v."documentIssueDate", v."passportNumber", v."additionalDetails",
    vv."metaData", b.id as "buildingId", b."name_${language}" as "buildingName",
    COUNT (*) OVER () as count
    from (
      select DISTINCT ON(vvs."visitingId") vvs.status, vvs."visitingId", vvs."createdAt"
      from visitor_visiting_statuses vvs
      order by vvs."visitingId", vvs."createdAt" DESC
    ) as vvs
    join visitor_visitings vv on vv.id = vvs."visitingId"
    join flats f on vv."flatId"=f.id
    join buildings b on b.id = f."buildingId"
    join guard_buildings gb on (gb."buildingId" = f."buildingId" and gb."deletedAt" is null and gb."guardId" = :guardId)
    join visitor_types vt on vt.id = vv."visitorTypeId"
    left join visitors v on v.id = vv."visitorId"
    where cast(vvs.status as text) = ANY (Array [:statuses])
    and vvs."createdAt" between :startDate and :endDate
    and vv."deletedAt" is null ${
      buildingId ? `and gb."buildingId" = '${buildingId}'` : ""
    } ${
    search
      ? `and (
      vv.name ilike '%${search}%'
      or vt.category_${language} ilike '%${search}%'
      or v."documentId" ilike '%${search}%'
      or v."documentType" ilike '%${search}%'
      or v."documentCountry" ilike '%${search}%'
      or v."mobileNumber" ilike '%${search}%'
      or v."documentIssueState" ilike '%${search}%'
      or v."passportNumber" ilike '%${search}%'
      or v."additionalDetails"->>'nameOnDocument' ilike '%${search}%'
      or v."additionalDetails"->>'numberOnDocument' ilike '%${search}%'
      or v."additionalDetails"->>'vehicleNumber' ilike '%${search}%'
      or v."additionalDetails"->>'occupation' ilike '%${search}%'
      or v."additionalDetails"->>'cardNumber' ilike '%${search}%'
      or v."additionalDetails"->>'email' ilike '%${search}%'
      or v."additionalDetails"->>'age' ilike '%${search}%'
      or v."additionalDetails"->>'gender' ilike '%${search}%'
      or vt.company_${language} ilike '%${search}%'
      or f.name_${language} ilike '%${search}%'
      or f.floor ilike '%${search}%'
      or b.name_${language} ilike '%${search}%'
      or vv."metaData"->>'description' ilike '%${search}%'
    )`
      : ""
  }
    order by vvs."createdAt" DESC
    limit :limit offset :offset
  `;
  const buildingVisitings = await db.sequelize.query(query, {
    raw: true,
    type: db.Sequelize.QueryTypes.SELECT,
    replacements: {
      guardId,
      statuses: [
        VISITOR_STATUSES.PENDING,
        VISITOR_STATUSES.APPROVED,
        VISITOR_STATUSES.DENIED,
      ],
      startDate: moment().subtract(12, "hours").toDate(),
      endDate: new Date(),
      limit,
      offset,
    },
  });

  for (const visiting of buildingVisitings) {
    visiting.creationTime = moment(visiting.createdAt).from(moment());
  }

  return buildingVisitings;
}

async function getVisitingStatisticsForGuard({
  guardId,
  buildingId,
  startDate = moment().startOf("day").toDate(),
  endDate = moment().endOf("day").toDate(),
}) {
  const reference = "getVisitingStatisticsForGuard";
  if (!buildingId) {
    throw new AppError(reference, "Building Id is required", "custom", 412);
  }

  const [checkins, checkouts, actives, requested] = await Promise.all([
    getVisitingsCountFromStatusForGuard({
      guardId,
      buildingId,
      status: VISITOR_STATUSES.CHECKIN,
      startDate,
      endDate,
    }),
    getVisitingsCountFromStatusForGuard({
      guardId,
      buildingId,
      status: VISITOR_STATUSES.CHECKOUT,
      startDate,
      endDate,
    }),
    getActiveVisitingsForGuard({
      guardId,
      buildingId,
      status: VISITOR_STATUSES.CHECKIN,
      startDate,
      endDate,
    }),
    getRequestedVisitorsCountForGuard({
      guardId,
      buildingId,
      startDate,
      endDate,
    }),
  ]);
  return {
    checkins,
    checkouts,
    actives,
    requested,
  };
}

async function getVisitingsCountFromStatusForGuard({
  guardId,
  buildingId,
  status,
  startDate,
  endDate,
}) {
  const query = `
  select count(vvs.*) from visitor_visiting_statuses vvs 
  join visitor_visitings vv on vv."id" = vvs."visitingId" 
  join flats f on (f.id = vv."flatId" and f."deletedAt" is null)
  join guard_buildings gb on (gb."buildingId" = f."buildingId" and gb."guardId" = :guardId and gb."deletedAt" is null)
  where vvs.status = :status and gb."buildingId" = :buildingId and vvs."createdAt" >= :startDate and vvs."createdAt" <= :endDate`;
  return (
    await db.sequelize.query(query, {
      raw: true,
      type: db.Sequelize.QueryTypes.SELECT,
      replacements: {
        guardId,
        status,
        buildingId,
        startDate,
        endDate,
      },
    })
  )[0]?.count;
}

async function getActiveVisitingsForGuard({
  guardId,
  buildingId,
  status,
  startDate,
  endDate,
}) {
  const query = `
  select count(*) from (
    select distinct on("visitingId") * from visitor_visiting_statuses 
    order by "visitingId", "createdAt" desc
  ) vvs
  join visitor_visitings vv on (vv.id = vvs."visitingId" and vv."deletedAt" is null)
  join flats f on (f.id = vv."flatId" and f."deletedAt" is null)
  join guard_buildings gb on (gb."buildingId" = f."buildingId" and gb."guardId" = :guardId and gb."deletedAt" is null)
  where vvs.status = :status and gb."buildingId" = :buildingId and vvs."createdAt" between :startDate and :endDate`;
  return (
    await db.sequelize.query(query, {
      raw: true,
      type: db.Sequelize.QueryTypes.SELECT,
      replacements: {
        guardId,
        status,
        buildingId,
        startDate,
        endDate,
      },
    })
  )[0]?.count;
}

async function getRequestedVisitorsCountForGuard({
  guardId,
  buildingId,
  startDate,
  endDate,
}) {
  const query = `
    select count(*)
    from (
      select DISTINCT ON(vvs."visitingId") vvs.status, vvs."visitingId", vvs."createdAt"
      from visitor_visiting_statuses vvs
      order by vvs."visitingId", vvs."createdAt" DESC
    ) as vvs
    join visitor_visitings vv on vv.id = vvs."visitingId"
    join flats f on vv."flatId"=f.id
    join buildings b on b.id = f."buildingId"
    join guard_buildings gb on (gb."buildingId" = f."buildingId" and gb."deletedAt" is null and gb."guardId" = :guardId and gb."buildingId" = :buildingId)
    join visitor_types vt on vt.id = vv."visitorTypeId"
    left join visitors v on v.id = vv."visitorId"
    where cast(vvs.status as text) = ANY (Array [:statuses])
    and vv."deletedAt" is null and vvs."createdAt" between :startDate and :endDate
  `;
  const buildingVisitings = await db.sequelize.query(query, {
    raw: true,
    type: db.Sequelize.QueryTypes.SELECT,
    replacements: {
      guardId,
      buildingId,
      statuses: [
        VISITOR_STATUSES.PENDING,
        VISITOR_STATUSES.APPROVED,
        VISITOR_STATUSES.DENIED,
      ],
      startDate,
      endDate,
    },
  });

  return buildingVisitings[0]?.count;
}

async function getRequestedVisitorsTotalCountForGuard(guardId) {
  const query = `
    select COUNT (*)
    from (
      select DISTINCT ON(vvs."visitingId") vvs.status, vvs."visitingId", vvs."createdAt"
      from visitor_visiting_statuses vvs
      order by vvs."visitingId", vvs."createdAt" DESC
    ) as vvs
    join visitor_visitings vv on vv.id = vvs."visitingId"
    join flats f on vv."flatId"=f.id
    join buildings b on b.id = f."buildingId"
    join guard_buildings gb on (gb."buildingId" = f."buildingId" and gb."deletedAt" is null and gb."guardId" = :guardId)
    join visitor_types vt on vt.id = vv."visitorTypeId"
    left join visitors v on v.id = vv."visitorId"
    where cast(vvs.status as text) = ANY (Array [:statuses])
    and vv."deletedAt" is null
  `;
  const buildingVisitings = await db.sequelize.query(query, {
    raw: true,
    type: db.Sequelize.QueryTypes.SELECT,
    replacements: {
      guardId,
      statuses: [
        VISITOR_STATUSES.PENDING,
        VISITOR_STATUSES.APPROVED,
        VISITOR_STATUSES.DENIED,
      ],
    },
  });
  return buildingVisitings[0]?.count;
}

function getPropertyInterestedIn() {
  return Object.values(PROPERTY_INTERESTED_IN);
}

function getViewingSources() {
  return VIEWING_SOURCES;
}

function getPurchasePurposes() {
  return Object.values(PURCHASE_PURPOSES);
}

function getWalkInSources() {
  return Object.values(WALK_IN_SOURCES);
}

function getPropertyTypes() {
  return Object.values(PROPERTY_TYPE);
}

function getNationalities() {
  return Object.values(nationalities.nationality);
}

function getProducts() {
  return Object.values(PRODUCTS);
}

function getPossessionTimeline() {
  return Object.values(POSSESSION_TIMELINE);
}

function getIndicativeBudgets() {
  return Object.values(INDICATIVE_BUDGET);
}

const getVisitingWithPropertyForExport = async (
  {
    propertyId,
    checkInDate,
    checkOutDate,
    status,
    category_en,
    flatIds,
    companyId,
    search,
    buildingId,
  },
  timezone
) => {
  const visitingInfo = [];
  const getVisitingExportsQuery = `
  SELECT
    vv."name" AS "name",
    vv."visitorsCount" AS "visitorsCount",
    vt."category_en" AS "category",
    v."documentCountry" AS "documentCountry",
    vv."metaData"->>'description' AS "description",
    f."floor" AS "floor",
    v."mobileNumber" AS "visitorNumber",
    vt."company_en" AS "visitorCompanyName",
    v."additionalDetails"->>'email' AS "email",
    v."additionalDetails"->>'gender' AS "gender",
    v."additionalDetails"->>'dateOfBirth' AS "dateOfBirth",
    v."additionalDetails"->>'vehicleNumber' AS "vehicleNumber",
    v."additionalDetails"->>'nameOnDocument' AS "nameOnDocument",
    v."additionalDetails"->>'numberOnDocument' AS "numberOnDocument",
    CASE
      WHEN vv."preapprovedId" IS NOT NULL THEN 'Resident'
      ELSE 'Guard'
    END AS "approvedBy",
    v."documentImage" AS "documentImage",
    v."documentId" AS "documentId",
    v."documentIssueState" AS "documentIssueState",
    v."documentIssueDate" AS "documentIssueDate",
    v."passportNumber" AS "passportNumber",
    b."name_en" AS "building",
    vvs1."createdAt" AS "checkIn",
    vvs2."createdAt"  AS "checkOut"
    from (
      select Distinct ON("visitingId") "createdAt", "visitingId" from visitor_visiting_statuses 
      where status = '${VISITOR_STATUSES.CHECKIN}'
      order by "visitingId", "createdAt" DESC
    ) as vvs1
    left join (
       select Distinct ON("visitingId") "createdAt", "visitingId" from visitor_visiting_statuses 
       where status = '${VISITOR_STATUSES.CHECKOUT}'
       order by "visitingId", "createdAt" DESC
    ) as vvs2 on vvs1."visitingId" = vvs2."visitingId" and vvs1."createdAt" < vvs2."createdAt"

    join visitor_visitings vv on (vv.id = vvs1."visitingId" AND  vv."deletedAt" is null  ${
      companyId ? `and vv."visitorTypeId" = '${companyId}'` : ""
    })
   left join "preapproved_visitings" AS "preapprovedDetails" ON vv."preapprovedId" = "preapprovedDetails"."id" AND ("preapprovedDetails"."deletedAt" IS NULL) 
    join flats f on ( f.id = vv."flatId" and f."deletedAt" is null)
    join buildings b on (b.id = f."buildingId" and b."deletedAt" is null)
   join visitor_types vt on (vt.id = vv."visitorTypeId")
    join visitors v on (v.id = vv."visitorId" and v."deletedAt" is null)
    where b."propertyId" = :propertyId ${
      search
        ? `and (vv.name ilike '%${search}%' 
      or vt.category_en ilike '%${search}%'
      or v."mobileNumber" ilike '%${search}%'
      or vt.company_en ilike '%${search}%'
      or b.name_en ilike '%${search}%'
      or b.name_en ilike '%${search}%'
      or f.name_en ilike '%${search}%'
      or cast(vvs1."createdAt" as text) ilike '%${search}%'
      )`
        : ""
    }
    ${checkInDate ? `and vvs1."createdAt" >= :checkInDate` : ""}
    ${checkOutDate ? `and vvs1."createdAt" <= :checkOutDate` : ""}
    ${category_en ? `and vt.category_en ilike :category_en` : ""}
      ${
        status
          ? status === VISITING_STATUSES.ACTIVE
            ? `and vvs2."createdAt" is null`
            : `and vvs2."createdAt" is not null`
          : ""
      }
    ${flatIds ? `and f.id in (:flatIds)` : ""}
    ${buildingId ? `and b.id = :buildingId` : ""}
    and vv."deletedAt" is null
    order by vvs1."createdAt" desc
    `;

  const visitings = await db.sequelize.query(getVisitingExportsQuery, {
    raw: true,
    type: db.Sequelize.QueryTypes.SELECT,
    nest: true,
    replacements: {
      propertyId,
      checkInDate: checkInDate
        ? getDateTimeObjectFromTimezone(checkInDate, timezone)
        : null,
      checkOutDate: checkOutDate
        ? getDateTimeObjectFromTimezone(checkOutDate, timezone)
        : null,
      flatIds,
      companyId,
      category_en: `%${category_en}%`,
      buildingId,
    },
  });

  return visitings;
};

const getVisitingWithPropertyForExportNew = async (
  {
    propertyId,
    checkInDate,
    checkOutDate,
    status,
    categoryId,
    flatIds,
    companyId,
    search,
    buildingId,
    categoryName,
  },
  timezone
) => {
  const visitingInfo = [];
  const getVisitingExportsQuery = `
  SELECT
    vv."name" AS "name",
    vv."visitorsCount" AS "visitorsCount",
    vt."category_en" AS "category",
    v."documentCountry" AS "documentCountry",
    vv."metaData"->>'description' AS "description",
    f."floor" AS "floor",
    f.name_en AS "flatName",
    v."mobileNumber" AS "visitorNumber",
    vt."company_en" AS "visitorCompanyName",
    v."additionalDetails"->>'email' AS "email",
    v."additionalDetails"->>'gender' AS "gender",
    v."additionalDetails"->>'dateOfBirth' AS "dateOfBirth",
    v."additionalDetails"->>'vehicleNumber' AS "vehicleNumber",
    v."additionalDetails"->>'nameOnDocument' AS "nameOnDocument",
    v."additionalDetails"->>'numberOnDocument' AS "numberOnDocument",
    CASE
      WHEN vv."preapprovedId" IS NOT NULL THEN 'Resident'
      ELSE 'Guard'
    END AS "approvedBy",
    v."documentImage" AS "documentImage",
    v."documentId" AS "documentId",
    v."documentIssueState" AS "documentIssueState",
    v."documentIssueDate" AS "documentIssueDate",
    v."passportNumber" AS "passportNumber",
    b."name_en" AS "building",
    vvs1."createdAt" AS "checkIn",
    vvs2."createdAt"  AS "checkOut"
    from (
      select Distinct ON("visitingId") "createdAt", "visitingId" from visitor_visiting_statuses 
      where status = '${VISITOR_STATUSES.CHECKIN}'
      order by "visitingId", "createdAt" DESC
    ) as vvs1
    left join (
       select Distinct ON("visitingId") "createdAt", "visitingId" from visitor_visiting_statuses 
       where status = '${VISITOR_STATUSES.CHECKOUT}'
       order by "visitingId", "createdAt" DESC
    ) as vvs2 on vvs1."visitingId" = vvs2."visitingId" and vvs1."createdAt" < vvs2."createdAt"

    join visitor_visitings vv on (vv.id = vvs1."visitingId" AND  vv."deletedAt" is null  ${
      companyId ? `and vv."visitorTypeId" = '${companyId}'` : ""
    })
   left join "preapproved_visitings" AS "preapprovedDetails" ON vv."preapprovedId" = "preapprovedDetails"."id" AND ("preapprovedDetails"."deletedAt" IS NULL) 
    join flats f on ( f.id = vv."flatId" and f."deletedAt" is null)
    join buildings b on (b.id = f."buildingId" and b."deletedAt" is null)
    join visitor_types vt on (vt.id = vv."visitorTypeId")
    join visitors v on (v.id = vv."visitorId" and v."deletedAt" is null)
    where b."propertyId" = :propertyId ${
      search
        ? `and (vv.name ilike '%${search}%' 
      or vt.category_en ilike '%${search}%'
      or v."mobileNumber" ilike '%${search}%'
      or vt.company_en ilike '%${search}%'
      or b.name_en ilike '%${search}%'
      or b.name_en ilike '%${search}%'
      or f.name_en ilike '%${search}%'
      or cast(vvs1."createdAt" as text) ilike '%${search}%'
      )`
        : ""
    }
    ${checkInDate ? `and vvs1."createdAt" >= :checkInDate` : ""}
    ${checkOutDate ? `and vvs1."createdAt" <= :checkOutDate` : ""}
    ${categoryId ? `and vt.id = :categoryId ` : ""}
    ${categoryName ? `and vt.category_en = :categoryName ` : ""}
      ${
        status
          ? status === VISITING_STATUSES.ACTIVE
            ? `and vvs2."createdAt" is null`
            : `and vvs2."createdAt" is not null`
          : ""
      }
    ${flatIds ? `and f.id in (:flatIds)` : ""}
    ${buildingId ? `and b.id = :buildingId` : ""}
    and vv."deletedAt" is null
    order by vvs1."createdAt" desc
    `;

  const visitings = await db.sequelize.query(getVisitingExportsQuery, {
    raw: true,
    type: db.Sequelize.QueryTypes.SELECT,
    nest: true,
    replacements: {
      propertyId,
      checkInDate,
      checkOutDate,
      flatIds,
      companyId,
      categoryId,
      buildingId,
      categoryName,
    },
  });

  return visitings;
};

async function updatePreapprovedGuestNew(
  params,
  data,
  propertyId,
  timezone,
  language = LANGUAGES.EN
) {
  const t = await db.sequelize.transaction();

  try {
    const visitingObj = await VisitorVisiting.findOne({
      where: params,
      transaction: t,
    });

    if (!visitingObj) {
      throw new AppError("updatePreapprovedGuest", "Invalid Visiting Id");
    }
    if (data.visitorTypeId) {
      const existingVisitorType = await VisitorType.findOne({
        where: { id: data.visitorTypeId, propertyId, isVisible: true },
      });

      if (!existingVisitorType) {
        throw new AppError(reference, "Invalid visitor type");
      }
    }

    const preapprovedObj = await PreapprovedVisiting.findOne({
      where: {
        id: visitingObj.preapprovedId,
      },
      transaction: t,
    });

    const visitor = await visitorController.addOrUpdate(data, t);

    visitingObj.visitorId = visitor.id;

    if (data.visitorTypeId) {
      visitingObj.visitorTypeId = data.visitorTypeId;
    }

    if (data.hasOwnProperty("metaData")) {
      visitingObj.metaData = data.metaData;
    }

    for (const key of Object.keys(data)) {
      if (key == "name" || key == "visitorsCount") visitingObj[key] = data[key];
      else if (key == "isFrequent") {
        preapprovedObj[key] = data[key];
      } else if (key == "inTime" || key == "outTime") {
        preapprovedObj[key] = getDateTimeObjectFromTimezone(
          data[key],
          timezone
        );
      } else if (key == "approvalDuration") {
        const updatedInTime = data.inTime
          ? getDateTimeObjectFromTimezone(data.inTime, timezone)
          : preapprovedObj.inTime;
        preapprovedObj["outTime"] = moment(updatedInTime)
          .add(data.approvalDuration, "hours")
          .toDate();
      }
    }

    if (!data.approvalDuration) {
      preapprovedObj.outTime = moment(preapprovedObj.outTime)
        .tz(timezone)
        .endOf("day")
        .toDate();
    }

    validatePreapprovedDates(preapprovedObj, timezone);

    await visitingObj.save({ transaction: t });
    await preapprovedObj.save({ transaction: t });

    await t.commit();

    return await getPreapprovedVisitingShareInfo(
      { id: visitingObj.id },
      timezone,
      language
    );
  } catch (error) {
    // console.log(error);
    await t.rollback();
    throw error;
  }
}

module.exports = {
  createPreApprovedGuest,
  getVisitings,
  getVisitingsLatest,
  createNonGuestPreapprovedVisitings,
  updateNonGuestPreapprovedVisiting,
  deleteVisiting,
  getPreapprovedVisitingShareInfo,
  updatePreapprovedGuest,
  getPreapprovedVisitingsByCode,
  createAnonymousGuest,
  createAnonymousNonGuest,
  getBuildingVisitingsByLastStatuses,
  getRequestedVisitorsInABuilding,
  getVisitingLogs,
  getPreapprovedVisitingsByFlat,
  getVisitingDetailWithLastStatusAndResident,
  addOrUpdateVisitorInVisiting,
  getVisitingsHistory,
  getVisitingDetails,
  getVisitingLogsOfProperty,
  createAnonymousGuestMultiple,
  getDailyVisitorTraffic,
  getVisitingsByLastStatusesForGuard,
  getVisitingsHistoryForGuard,
  getRequestedVisitorsForGuard,
  getVisitingStatisticsForGuard,
  getRequestedVisitorsTotalCountForGuard,
  getPropertyInterestedIn,
  getViewingSources,
  getPurchasePurposes,
  getVisitingWithPropertyForExport,
  getWalkInSources,
  getPropertyTypes,
  getProducts,
  getPossessionTimeline,
  getIndicativeBudgets,
  getNationalities,
  createAnonymousGuestMultipleNew,
  createAnonymousGuestNew,
  createPreApprovedGuestNew,
  updatePreapprovedGuestNew,
  createNonGuestPreapprovedVisitingsNew,
  updateNonGuestPreapprovedVisitingNew,
  getVisitingsLatestNew,
  getVisitingLogsNew,
  getVisitingLogsOfPropertyNew,
  getVisitingWithPropertyForExportNew,
};
