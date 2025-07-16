const {
  VISITOR_STATUSES,
  PIXLAB_DOCUMENT_TYPES,
  PIXLAB_SUPPORTED_COUNTRIES,
} = require("../../config/constants");
const db = require("../../database");
const { AppError } = require("../../utils/errorHandler");
const Visitor = require("../models/Visitor");

async function addOrUpdate(data = {}, transaction = null) {
  let visitor = await Visitor.findOne({
    where: {
      mobileNumber: data.mobileNumber,
    },
    transaction,
  });

  if (!visitor) {
    visitor = Visitor.build({
      name: data.name,
      mobileNumber: data.mobileNumber,
      countryCode: data.countryCode,
      profilePicture: data.profilePicture,
      additionalDetails: {},
    });
  }

  !visitor.additionalDetails && (visitor.additionalDetails = {});

  visitor.documentId = data.documentId || null;
  visitor.documentImage = data.documentImage || null;
  visitor.documentType = data.documentType || null;
  visitor.documentCountry = data.documentCountry || null;
  visitor.additionalDetails.nameOnDocument = data.nameOnDocument || null;
  visitor.additionalDetails.numberOnDocument = data.numberOnDocument || null;
  visitor.documentExpiry = data.documentExpiry || null;
  visitor.additionalDetails.vehicleNumber = data.vehicleNumber || null;
  visitor.documentExpireMonth = data.documentExpireMonth || null;
  visitor.documentIssueState = data.documentIssueState || null;
  visitor.profilePicture = data.profilePicture || null;
  visitor.documentIssueDate = data.documentIssueDate || null;
  visitor.additionalDetails.dateOfBirth = data.dateOfBirth || null;
  visitor.additionalDetails.occupation = data.occupation || null;
  visitor.additionalDetails.cardNumber = data.cardNumber || null;
  visitor.additionalDetails.email = data.email || null;
  visitor.additionalDetails.gender = data.gender || null;
  visitor.additionalDetails.age = data.age || null;
  visitor.additionalDetails.docTypeDetail = data.docTypeDetail || null;
  // visitor.additionalDetails.bloodGroup = data.bloodGroup || null;
  visitor.additionalDetails.licenseNumber = data.licenseNumber || null;
  visitor.additionalDetails.address = data.address || null;
  // visitor.additionalDetails.licenseIssueAge = data.licenseIssueAge || null;
  visitor.additionalDetails.licenseIssueAuthority =
    data.licenseIssueAuthority || null;
  visitor.passportNumber = data.passportNumber || null;

  if (data.nameOnDocument && data.nameOnDocument != visitor.name) {
    visitor.name = data.nameOnDocument;
  }

  visitor.changed("additionalDetails", true);

  await visitor.save({ transaction });

  return visitor;
}

async function updateVisitor(params, data, transaction = null) {
  const visitor = await Visitor.findOne({ where: params, transaction });
  if (!visitor) {
    throw new AppError("updateVisitor", "Visitor not found");
  }
  delete data.visitorId;
  if (visitor.documentId) {
    delete data.documentId;
    delete data.documentImage;
    delete data.documentType;
    delete data.documentCountry;
    delete data.nameOnDocument;
    delete data.documentExpiry;
    delete data.vehicleNumber;
    delete data.documentExpireMonth;
    delete data.documentIssueState;
  } else if (!data.documentId) {
    visitor.documentImage && delete data.documentImage;
    visitor.documentType && delete data.documentType;
    visitor.documentCountry && delete data.documentCountry;
    visitor.nameOnDocument && delete data.nameOnDocument;
    visitor.documentExpiry && delete data.documentExpiry;
    visitor.vehicleNumber && delete data.vehicleNumber;
    visitor.documentExpireMonth && delete data.documentExpireMonth;
    visitor.documentIssueState && delete data.documentIssueState;
  }

  for (const key in data) {
    visitor[key] = data[key];
  }
  await visitor.save({ transaction });
  return visitor;
}

async function getVisitorWithLastVisitedTime(params) {
  //TODO: add language support in category column
  const query = `
    select v.*, vv."visitorTypeId", vv."metaData", vv."brokerDetails", vv."salesAdvisor", vt.category_en as "category", vt.company_en as company, vt.image, vvs."createdAt" as "lastVisited" 
    from visitors v
    join visitor_visitings vv on vv."visitorId" = v.id
    left join visitor_types vt on (vt.id = vv."visitorTypeId" and vt."deletedAt" is null)
    join visitor_visiting_statuses vvs on (vvs."visitingId" = vv.id and vvs.status = :visitingStatus)
    join flats f on (f.id = vv."flatId" and f."deletedAt" is null)
    join buildings b on (b.id = f."buildingId" and b."deletedAt" is null)
    where b."propertyId" = :propertyId
    and v."mobileNumber" = :mobileNumber
    order by vvs."createdAt" DESC nulls last
    limit 1`;

  const visitors = await db.sequelize.query(query, {
    raw: true,
    type: db.Sequelize.QueryTypes.SELECT,
    replacements: {
      visitingStatus: VISITOR_STATUSES.CHECKIN,
      propertyId: params.propertyId,
      mobileNumber: params.mobileNumber,
    },
  });
  return visitors[0];
}

async function getpixlabDocumentTypes(language) {
  return Object.keys(PIXLAB_DOCUMENT_TYPES).map((type) => {
    return {
      key: type,
      value: PIXLAB_DOCUMENT_TYPES[type][language],
      image: PIXLAB_DOCUMENT_TYPES[type]["image"],
    };
  });
}

async function getpixlabCountries(language) {
  return Object.keys(PIXLAB_SUPPORTED_COUNTRIES).map((type) => {
    return {
      key: type,
      value: PIXLAB_SUPPORTED_COUNTRIES[type][`name_${language}`],
    };
  });
}

async function getUniqueVisitors({ buildingIds, startDate, endDate }) {
  const query = `
  select count(distinct v.id) from visitors v
  join visitor_visitings vv on vv."visitorId" = v.id
  join visitor_visiting_statuses vvs on vvs."visitingId" = vv.id
  join flats f on (f.id = vv."flatId" and f."buildingId" in (:buildingIds))
  where vvs.status = :status ${
    startDate ? 'and vvs."createdAt" >= :startDate' : ""
  }  and vvs."createdAt" <= :endDate`;

  return (
    await db.sequelize.query(query, {
      raw: true,
      type: db.Sequelize.QueryTypes.SELECT,
      replacements: {
        status: VISITOR_STATUSES.CHECKIN,
        buildingIds,
        startDate,
        endDate,
      },
    })
  )[0]?.count;
}

async function getRepeatedVisitors({ buildingIds, endDate, startDate }) {
  const query = `
select count(*) from(
 SELECT v.id AS "visitorId", vv."flatId" AS "flatId"
FROM visitors v
JOIN visitor_visitings vv ON vv."visitorId" = v.id
JOIN visitor_visiting_statuses vvs ON vvs."visitingId" = vv.id
join flats f on (f.id = vv."flatId" and f."buildingId" in (:buildingIds))
where vvs.status = :status   and vvs."createdAt" >= :startDate  and vvs."createdAt" <= :endDate
  GROUP BY v.id, vv."flatId"
HAVING COUNT(*) >1
) as subquery`;

  return (
    await db.sequelize.query(query, {
      raw: true,
      type: db.Sequelize.QueryTypes.SELECT,
      replacements: {
        status: VISITOR_STATUSES.CHECKIN,
        buildingIds,
        startDate,
        endDate,
      },
    })
  )[0]?.count;
}

async function getVisitorsCount({ buildingIds, startDate, endDate }) {
  const query = `select count(*)::INTEGER
  FROM visitors v
  JOIN visitor_visitings vv ON vv."visitorId" = v.id
  JOIN visitor_visiting_statuses vvs ON vvs."visitingId" = vv.id
  JOIN flats f on (f.id = vv."flatId" and f."buildingId" in (:buildingIds))
  where vvs.status = :status  and vvs."createdAt" >= :startDate and vvs."createdAt" <= :endDate
  `;

  return (
    await db.sequelize.query(query, {
      raw: true,
      type: db.Sequelize.QueryTypes.SELECT,
      replacements: {
        status: VISITOR_STATUSES.CHECKIN,
        buildingIds,
        startDate,
        endDate,
      },
    })
  )[0]?.count;
}

async function getUniqueVisitorsNew({ buildingIds, endDate, startDate }) {
  const query = `
select count(*) from(
 SELECT v.id AS "visitorId", vv."flatId" AS "flatId"
FROM visitors v
JOIN visitor_visitings vv ON vv."visitorId" = v.id
JOIN visitor_visiting_statuses vvs ON vvs."visitingId" = vv.id
join flats f on (f.id = vv."flatId" and f."buildingId" in (:buildingIds))
where vvs.status = :status  and vvs."createdAt" >= :startDate and vvs."createdAt" <= :endDate
GROUP BY v.id, vv."flatId"
HAVING COUNT(*) <= 1
) as subquery`;

  return (
    await db.sequelize.query(query, {
      raw: true,
      type: db.Sequelize.QueryTypes.SELECT,
      replacements: {
        status: VISITOR_STATUSES.CHECKIN,
        buildingIds,
        startDate,
        endDate,
      },
    })
  )[0]?.count;
}

module.exports = {
  addOrUpdate,
  updateVisitor,
  getVisitorWithLastVisitedTime,
  getpixlabDocumentTypes,
  getpixlabCountries,
  getUniqueVisitors,
  getUniqueVisitorsNew,
  getRepeatedVisitors,
  getVisitorsCount,
};
