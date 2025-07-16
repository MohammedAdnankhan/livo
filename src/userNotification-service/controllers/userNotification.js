const moment = require("moment-timezone");
const {
  LANGUAGES,
  ACTION_TYPES,
  MAINTENANCE_STATUSES,
} = require("../../config/constants");
const db = require("../../database");
const {
  getUser,
  getUserWithInfo,
} = require("../../user-service/controllers/user");
const { AppError } = require("../../utils/errorHandler");
const logger = require("../../utils/logger");
const UserNotification = require("../models/UserNotification");
const { pushNotification } = require("./pushDevice");

//get all notifications of a user
const getNotifications = async (
  params,
  { limit, offset },
  language = LANGUAGES.EN
) => {
  let query = `
    select un.id, un."actionType", un."createdAt", un."isRead", un."sourceId", un."sourceType", vt.category_${language} as category, vt.company_${language} as company,
      case when u1.name is not null then u1.name else vv.name end as name,
      case when vv.id is null then u1."profilePicture" else vt.image end as image,
      case when vv.id is not null then true else false end as "isVisiting",
      vv."visitorId",
      mr."requestId", ms.status, un."metaData"
    from user_notifications un
    left join visitor_visitings vv on un."sourceId"=vv.id
    left join visitor_types vt on vt.id = vv."visitorTypeId"
    left join visitors v on v.id=vv."visitorId"
    left join users u1 on u1.id=un."generatedBy"
    left join maintenance_requests mr on (mr.id = un."sourceId" and mr."deletedAt" is null)
    left join (
      select distinct on("maintenanceId") * from maintenance_statuses
      where "deletedAt" is null
      order by "maintenanceId", "createdAt" desc
    ) ms on ms."maintenanceId" = mr.id
    where un."generatedFor"=:generatedFor
    and un."deletedAt" is null
    and (vv.id is null or vv."deletedAt" is null)
    order by un."createdAt" DESC
    limit :limit
    offset :offset
  `;

  const notifications = await db.sequelize.query(query, {
    raw: true,
    type: db.Sequelize.QueryTypes.SELECT,
    replacements: {
      generatedFor: params.generatedFor,
      limit,
      offset,
    },
  });

  for (const notification of notifications) {
    switch (notification.actionType) {
      case ACTION_TYPES.ABOUT_TO_ARRIVE.key:
        notification.content = ACTION_TYPES.ABOUT_TO_ARRIVE[
          `content_${language}`
        ].replace(
          "%var%",
          notification.name ? notification.name : notification.category
        );
        break;
      case ACTION_TYPES.ENTRY_REQUESTED.key:
        notification.content = ACTION_TYPES.ENTRY_REQUESTED[
          `content_${language}`
        ].replace(
          "%var%",
          notification.name ? notification.name : notification.category
        );
        break;
      case ACTION_TYPES.ENTERED_BUILDING.key:
        notification.content = ACTION_TYPES.ENTERED_BUILDING[
          `content_${language}`
        ].replace(
          "%var%",
          notification.name ? notification.name : notification.category
        );
        break;
      case ACTION_TYPES.LIKED.key:
        notification.content = ACTION_TYPES.LIKED[
          `content_${language}`
        ].replace("%var%", notification.name);
        break;
      case ACTION_TYPES.COMMENTED.key:
        notification.content = ACTION_TYPES.COMMENTED[
          `content_${language}`
        ].replace("%var%", notification.name);
        break;
      case ACTION_TYPES.NEW_PAYMENT.key:
        notification.content = ACTION_TYPES.NEW_PAYMENT[`content_${language}`];
        break;
      case ACTION_TYPES.LEFT_BUILDING.key:
        notification.content = ACTION_TYPES.LEFT_BUILDING[
          `content_${language}`
        ].replace(
          "%var%",
          notification.name ? notification.name : notification.category
        );
        break;
      case ACTION_TYPES.ENTRY_DENIED_BY_GUARD.key:
        notification.content = ACTION_TYPES.ENTRY_DENIED_BY_GUARD[
          `content_${language}`
        ].replace(
          "%var%",
          notification.name ? notification.name : notification.category
        );
        break;
      case ACTION_TYPES.AUTO_CHECKOUT.key:
        notification.content = ACTION_TYPES.AUTO_CHECKOUT[
          `content_${language}`
        ].replace(
          "%var%",
          notification.name ? notification.name : notification.category
        );
        break;
      case ACTION_TYPES.ENTRY_APPROVED.key:
        notification.content = ACTION_TYPES.ENTRY_APPROVED[
          `content_${language}`
        ].replace(
          "%var%",
          notification.name ? notification.name : notification.category
        );
        break;
      case ACTION_TYPES.ENTRY_DENIED.key:
        notification.content = ACTION_TYPES.ENTRY_DENIED[
          `content_${language}`
        ].replace(
          "%var%",
          notification.name ? notification.name : notification.category
        );
        break;
      case ACTION_TYPES.REQUEST_STATUS_CHANGE.key:
        notification.content = ACTION_TYPES.REQUEST_STATUS_CHANGE[
          `content_${language}`
        ]
          .replace("%id%", notification.requestId)
          .replace(
            "%var%",
            MAINTENANCE_STATUSES[notification.metaData?.status][
              `status_${language}`
            ]
          );
        break;
      default:
        logger.warn(
          `No action types matched for notification with id - ${notification.id}`
        );
        break;
    }
    delete notification.metaData;
    delete notification.status;
    notification.creationTime = moment(notification.createdAt).from(moment());
  }

  return notifications;
};

//read notification
const readNotification = async (params) => {
  const notification = await UserNotification.findOne({ where: params });
  if (!notification) {
    throw new AppError("", "Notification does not exist");
  }
  notification.isRead = true;
  await notification.save();
  return notification;
};

const createNewNotification = async ({
  actionType,
  sourceType,
  sourceId,
  generatedBy,
  generatedFor,
  metaData,
}) => {
  const createNotificaton = await UserNotification.create({
    actionType,
    sourceType,
    sourceId,
    generatedBy,
    generatedFor,
    metaData,
  });

  // const userLang = (await getUser({ id: generatedFor })).language;
  const { language: userLang, notificationEnabled } = await getUserWithInfo(
    generatedFor
  );
  const notification = (
    await getNotifications({ generatedFor }, { limit: 1, offset: 0 }, userLang)
  )[0];

  /*
  if action type exists then check bool value else send notification anyhow
  */
  if (
    notificationEnabled[notification.actionType] ||
    !notificationEnabled.hasOwnProperty(notification.actionType)
  ) {
    await pushNotification({
      message: notification.content,
      title: notification.actionType,
      tag: notification.actionType,
      icon: notification.image,
      sourceType: notification.sourceType,
      sourceId: notification.sourceId,
      userId: generatedFor,
    });
  }

  return createNotificaton;
};

//check if any new notification exists
const checkUnread = async (params) => {
  const check = await UserNotification.findAll({ where: params });
  if (check.length !== 0) {
    return true;
  }
  return false;
};

//mark all notification as read
const readAllNotifications = async (params) => {
  await UserNotification.update({ isRead: true }, { where: params });
  return;
};

module.exports = {
  getNotifications,
  readNotification,
  createNewNotification,
  checkUnread,
  readAllNotifications,
};
