const { NOTICE_TARGET, LANGUAGES } = require("../../config/constants");
const db = require("../../database");
const { AppError } = require("../../utils/errorHandler");
const ReadNotice = require("../models/ReadNotice");

async function getNoticesForOwner(
  { buildingIds, ownerId },
  { limit, offset },
  language = LANGUAGES.EN
) {
  const descriptionLength = 200;
  const countQuery = `
    SELECT COUNT(DISTINCT(n.id))::INTEGER FROM notices n
    JOIN notice_buildings nb ON (nb."noticeId" = n.id AND nb."deletedAt" IS NULL)
    JOIN buildings b ON (b.id = nb."buildingId" AND b."deletedAt" IS NULL AND b.id IN (:buildingIds))
    WHERE n."deletedAt" IS NULL AND :now between n."validFrom" and n."validTill" AND :noticeTarget = ANY(n."targetUser")`;

  const noticesQuery = `
    SELECT DISTINCT(n.id), n.title, LEFT(n.description, :descriptionLength) AS description,
    CASE WHEN rn.id IS NULL THEN false ELSE true END AS "isRead", b.id AS "building.id",
    b.name_${language} AS "building.name", n."createdAt" FROM notices n
    JOIN notice_buildings nb ON (nb."noticeId" = n.id AND nb."deletedAt" IS NULL)
    JOIN buildings b ON (b.id = nb."buildingId" AND b."deletedAt" IS NULL AND b.id IN (:buildingIds))
    LEFT JOIN read_notices rn ON (rn."noticeId" = n.id AND rn."deletedAt" IS NULL AND rn."ownerId" = :ownerId)
    WHERE n."deletedAt" IS NULL AND :now between n."validFrom" and n."validTill" AND :noticeTarget = ANY(n."targetUser")
    ORDER BY n."createdAt" DESC LIMIT :limit OFFSET :offset`;

  const [[{ count }], notices] = await Promise.all([
    db.sequelize.query(countQuery, {
      type: db.Sequelize.QueryTypes.SELECT,
      raw: true,
      nest: true,
      replacements: {
        buildingIds,
        now: new Date(),
        noticeTarget: NOTICE_TARGET.OWNER,
      },
    }),
    db.sequelize.query(noticesQuery, {
      type: db.Sequelize.QueryTypes.SELECT,
      raw: true,
      nest: true,
      replacements: {
        buildingIds,
        ownerId,
        now: new Date(),
        noticeTarget: NOTICE_TARGET.OWNER,
        descriptionLength,
        limit,
        offset,
      },
    }),
  ]);
  const response = {
    count,
    data: notices,
  };
  return response;
}

async function getNoticeForOwner(
  { buildingIds, noticeId, ownerId },
  language = LANGUAGES.EN
) {
  const reference = "getNoticeForOwner";
  const query = `
    SELECT n.id, n.title, n.category, n.description, n.documents, n."createdAt", a.name as "admin.name", b.id AS "building.id",
    b.name_${language} AS "building.name", n."createdAt" FROM notices n
    JOIN notice_buildings nb ON (nb."noticeId" = n.id AND nb."deletedAt" IS NULL)
    JOIN buildings b ON (b.id = nb."buildingId" AND b."deletedAt" IS NULL AND b.id IN (:buildingIds))
    JOIN administrators a ON (a.id = n."postedBy" AND a."deletedAt" IS NULL)
    WHERE n."deletedAt" IS NULL AND n."validTill" >= :now AND :noticeTarget = ANY(n."targetUser") AND n.id = :noticeId`;

  const [notice] = await db.sequelize.query(query, {
    raw: true,
    nest: true,
    replacements: {
      buildingIds,
      noticeId,
      now: new Date(),
      noticeTarget: NOTICE_TARGET.OWNER,
    },
  });

  if (!notice) {
    throw new AppError(reference, "Notice not found", "custom", 404);
  }

  //Mark notice as read asynchronously
  const readNoticeData = {
    noticeId,
    ownerId,
  };

  ReadNotice.findOrCreate({ where: readNoticeData }); //TODO: trigger error condition at this point and if not handled, handle the same
  return notice;
}

module.exports = {
  getNoticesForOwner,
  getNoticeForOwner,
};
