const EventEmitter = require("events");
const schedule = require("node-schedule");
const logger = require("./logger");
const userNotificationController = require("./../userNotification-service/controllers/userNotification");
const adminNotificationController = require("./../adminNotification-service/controllers/adminNotification");
const userController = require("./../user-service/controllers/user");
const adminController = require("./../admin-service/controllers/admin");
const { SOURCE_TYPES } = require("../config/constants");

const eventEmitter = new EventEmitter();
module.exports = eventEmitter;

const { getShare } = require("../share-service/controllers/share");
const { getPost } = require("../post-service/controllers/post");
const { createCrmEntry } = require("../crmLog-service/controllers/crmLog");

eventEmitter.on(
  "schedule_notification",
  (
    { actionType, sourceType, sourceId, generatedBy, generatedFor },
    dateTime
  ) => {
    try {
      schedule.scheduleJob(dateTime, function () {
        eventEmitter.emit("send_notification", {
          actionType,
          sourceType,
          sourceId,
          generatedBy,
          generatedFor,
        });
      });
    } catch (error) {
      logger.error(JSON.stringify(error.message));
    }
  }
);

eventEmitter.on(
  "send_notification",
  async ({
    actionType,
    sourceType,
    sourceId,
    generatedBy,
    generatedFor,
    metaData,
  }) => {
    try {
      logger.info(
        `Creating Notification: ${JSON.stringify({
          actionType,
          sourceType,
          sourceId,
          generatedBy,
          generatedFor,
          metaData,
        })}`
      );
      await userNotificationController.createNewNotification({
        actionType,
        sourceType,
        sourceId,
        generatedBy,
        generatedFor,
        metaData,
      });
    } catch (error) {
      logger.error(JSON.stringify(error.message));
    }
  }
);

eventEmitter.on(
  "flat_level_notification",
  async ({
    flatId,
    actionType,
    sourceType,
    sourceId,
    generatedBy,
    metaData,
  }) => {
    try {
      const flatResidents = await userController.getUsers({
        flatId,
        familyMemberId: null,
      });

      for (const resident of flatResidents) {
        eventEmitter.emit("send_notification", {
          actionType,
          sourceType,
          sourceId,
          generatedBy,
          generatedFor: resident.id,
          metaData: metaData ? metaData : null,
        });
      }
    } catch (error) {
      logger.error(JSON.stringify(error.message));
    }
  }
);

eventEmitter.on(
  "send_community_notification",
  async ({ actionType, sourceType, sourceId, generatedBy }) => {
    try {
      let generatedFor;

      if (sourceType === SOURCE_TYPES.SHARED_POST) {
        generatedFor = (await getShare({ id: sourceId }, ["userId"])).userId;
      } else if (sourceType === SOURCE_TYPES.POST) {
        generatedFor = (await getPost({ id: sourceId }, ["createdBy"]))
          .createdBy;
      }

      if (generatedBy != generatedFor) {
        eventEmitter.emit("send_notification", {
          actionType,
          sourceType,
          sourceId,
          generatedBy,
          generatedFor,
        });
      }
    } catch (error) {
      logger.error(JSON.stringify(error.message));
    }
  }
);

eventEmitter.on(
  "create_crm_entry",
  async function ({ visitor, crmDetails, project }) {
    try {
      await createCrmEntry(
        visitor,
        crmDetails,
        project["building"]?.["name"],
        project["name"]
      );
    } catch (error) {
      logger.error(`Error in create_crm_entry: ${JSON.stringify(message)}`);
    }
  }
);

eventEmitter.on(
  "admin_level_notification",
  async ({
    flatId,
    actionType,
    sourceType,
    sourceId,
    generatedBy,
    metaData,
  }) => {
    try {
      const admins = await adminController.getAllAdminsForFlat(flatId);

      for (const admin of admins) {
        eventEmitter.emit("send_admin_notification", {
          actionType,
          sourceType,
          sourceId,
          generatedBy,
          generatedFor: admin.id,
          metaData: metaData ? metaData : null,
        });
      }
    } catch (error) {
      logger.error(JSON.stringify(error.message));
    }
  }
);

eventEmitter.on(
  "send_admin_notification",
  async ({
    actionType,
    sourceType,
    sourceId,
    generatedBy,
    generatedFor,
    metaData,
  }) => {
    try {
      logger.info(
        `Creating Notification: ${JSON.stringify({
          actionType,
          sourceType,
          sourceId,
          generatedBy,
          generatedFor,
          metaData,
        })}`
      );
      await adminNotificationController.createNewNotification({
        actionType,
        sourceType,
        sourceId,
        generatedBy,
        generatedFor,
        metaData,
      });
    } catch (error) {
      logger.error(JSON.stringify(error.message));
    }
  }
);
