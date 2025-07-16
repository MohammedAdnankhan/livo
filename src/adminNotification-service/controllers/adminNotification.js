const moment = require("moment-timezone");
const { LANGUAGES, ADMIN_ACTION_TYPES } = require("../../config/constants");
const db = require("../../database");
const { getAdmin } = require("../../admin-service/controllers/admin");
const { AppError } = require("../../utils/errorHandler");
const logger = require("../../utils/logger");
const AdminNotification = require("../models/adminNotification");
const { pushNotification } = require("./adminPushDevice");

//get all notifications of a admin
const getNotifications = async (
  params,
  { limit, offset },
  language = LANGUAGES.EN
) => {
  let query = `
    select an.id, an."actionType", an."createdAt", an."isRead", an."sourceId", an."sourceType", 
    case  when a.name is null then u.name else a.name end
    from admin_notifications an
    left join users u on u.id=an."generatedBy"
    left join administrators a on a.id=an."generatedBy"
    left join maintenance_requests mr on (mr.id = an."sourceId" and mr."deletedAt" is null)
    left join (
      select distinct on("maintenanceId") * from maintenance_statuses
      where "deletedAt" is null
      order by "maintenanceId", "createdAt" desc
    ) ms on ms."maintenanceId" = mr.id
    where an."generatedFor"=:generatedFor
    and an."deletedAt" is null
    order by an."createdAt" DESC
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
      case ADMIN_ACTION_TYPES.NEW_REQUEST.key:
        notification.content = ADMIN_ACTION_TYPES.NEW_REQUEST[
          `content_${language}`
        ].replace(
          "%var%",
          notification.name ? notification.name : notification.category
        );
        break;
      case ADMIN_ACTION_TYPES.DUE_REQUEST.key:
        notification.content = ADMIN_ACTION_TYPES.DUE_REQUEST[
          `content_${language}`
        ].replace(
          "%var%",
          notification.name ? notification.name : notification.category
        );
        break;
      case ADMIN_ACTION_TYPES.DUE_LEASE.key:
        notification.content = ADMIN_ACTION_TYPES.DUE_LEASE[
          `content_${language}`
        ].replace(
          "%var%",
          notification.name ? notification.name : notification.category
        );
        break;
      case ADMIN_ACTION_TYPES.BILL_PASSED_DUE_DATE.key:
        notification.content = ADMIN_ACTION_TYPES.BILL_PASSED_DUE_DATE[
          `content_${language}`
        ].replace("%var%", notification.name);
        break;
      case ADMIN_ACTION_TYPES.NEW_LOGIN_REQUEST.key:
        notification.content = ADMIN_ACTION_TYPES.NEW_LOGIN_REQUEST[
          `content_${language}`
        ].replace("%var%", notification.name);
        break;
      case ADMIN_ACTION_TYPES.SERVICE_REQUEST_OPEN_TO_ASSIGNEE.key:
        notification.content =
          ADMIN_ACTION_TYPES.SERVICE_REQUEST_OPEN_TO_ASSIGNEE[
            `content_${language}`
          ].replace("%var%", notification.name);
        break;
      case ADMIN_ACTION_TYPES.SERVICE_REQUEST_OPEN_TO_INPROCESS.key:
        notification.content =
          ADMIN_ACTION_TYPES.SERVICE_REQUEST_OPEN_TO_INPROCESS[
            `content_${language}`
          ].replace("%var%", notification.name);
        break;
      case ADMIN_ACTION_TYPES.SERVICE_REQUEST_INPROCESS_TO_COMPLETE.key:
        notification.content =
          ADMIN_ACTION_TYPES.SERVICE_REQUEST_INPROCESS_TO_COMPLETE[
            `content_${language}`
          ].replace("%var%", notification.name);
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
  const notification = await AdminNotification.findOne({ where: params });
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
  const createNotificaton = await AdminNotification.create({
    actionType,
    sourceType,
    sourceId,
    generatedBy,
    generatedFor,
    metaData,
  });

  const { notificationEnabled, userLang = "en" } = await getAdmin({
    id: generatedFor,
  });

  console.log("here --", createNotificaton);
  const notification = (
    await getNotifications({ generatedFor }, { limit: 1, offset: 0 }, userLang)
  )[0];
  console.log("god----------", notification);
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
      adminId: generatedFor,
    });
  }

  return createNotificaton;
};

//check if any new notification exists
const checkUnread = async (params) => {
  const check = await AdminNotification.findAll({ where: params });
  if (check.length !== 0) {
    return true;
  }
  return false;
};

//mark all notification as read
const readAllNotifications = async (params) => {
  await AdminNotification.update({ isRead: true }, { where: params });
  return;
};

const unreadCount = async (params) => {
  return await AdminNotification.count({
    where: params,
  });
};

module.exports = {
  getNotifications,
  readNotification,
  createNewNotification,
  checkUnread,
  readAllNotifications,
  unreadCount,
};
