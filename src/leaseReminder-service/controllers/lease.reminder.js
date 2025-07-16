const {
  LEASE_STATUSES,
  SCHEDULING_TYPES,
  LEASE_REMINDER_STATUSES,
} = require("../../config/constants");
const db = require("../../database");
const {
  getLeaseWithLatestStatus,
} = require("../../lease-service/controllers/lease");
const Lease = require("../../lease-service/models/Lease");
const {
  leaseReminderInitiatedForUser,
  leaseReminderInitiatedForUserCron,
  draftLeaseReminderForAdmin,
} = require("../../utils/email");
const { AppError } = require("../../utils/errorHandler");
const logger = require("../../utils/logger");
const LeaseReminder = require("../models/LeaseReminder");
const schedule = require("node-schedule");

module.exports.addReminder = async (data) => {
  const reference = `addReminder`;
  await Promise.all(
    data.map(async (leaseReminder) => {
      const lease = await getLeaseWithLatestStatus({
        id: leaseReminder.leaseId,
      });

      if (!lease) {
        throw new AppError(reference, "lease not found", "custom", 404);
      }
      if (lease.statuses[0].status !== LEASE_STATUSES.ACTIVE) {
        throw new AppError(
          reference,
          "Only Active leases are allowed",
          "custom",
          412
        );
      }

      leaseReminder.cronId = String(Date.now());
      leaseReminder.cronTime = leaseReminder.scheduledTime;
      delete leaseReminder.scheduledTime;
      schedule.scheduleJob(leaseReminder.cronId, leaseReminder.cronTime, () =>
        sendReminders({
          leaseId: leaseReminder.leaseId,
          cronId: leaseReminder.cronId,
          scheduledFor: leaseReminder.scheduledFor,
          smsTitle: leaseReminder.smsTitle,
          smsBody: leaseReminder.smsBody,
        })
      );
    })
  );
  await LeaseReminder.bulkCreate(data);
  return null;
};

module.exports.getReminders = async (
  { propertyId, buildingId, startDate, endDate, search, status },
  { offset, limit }
) => {
  const getRemindersCountQuery = `SELECT count(*)
  FROM lease_reminders lr
  JOIN leases l ON (l.id = lr."leaseId" and l."deletedAt" is null)
  JOIN master_users mu on(mu.id= l."masterUserId" and mu."deletedAt" is null)
  LEFT JOIN flats f ON (l."flatId" = f.id and f."deletedAt" is null)
  LEFT JOIN sub_flats sf ON (sf.id = l."subFlatId" AND sf."deletedAt" IS NULL)
  LEFT JOIN flats f1 ON (f1.id = sf."flatId" AND f1."deletedAt" IS NULL)
  join buildings b ON ((b.id = f."buildingId" OR b.id = f1."buildingId") AND b."deletedAt" IS NULL)
   where  b."propertyId" = :propertyId  ${
     buildingId ? `AND b.id = :buildingId` : ""
   } ${
    startDate && endDate
      ? `AND CAST(DATE_TRUNC('MINUTE', lr."cronTime" ::timestamp) AS TIMESTAMP) AT TIME ZONE 'UTC' between :startDate  and :endDate`
      : ""
  }
  ${
    search
      ? `and (
    b."name_en" ilike '%${search}%' OR
    f."name_en" ilike '%${search}%' OR
   sf."name_en" ilike '%${search}%' OR
    b."name_en" ilike '%${search}%' OR
    mu."name"   ilike '%${search}%' OR
    CAST(l."leaseId" AS TEXT) ilike '%${search}%' 
  )`
      : ""
  }
    ${
      status
        ? status === LEASE_REMINDER_STATUSES.PENDING
          ? `AND CAST(DATE_TRUNC('MINUTE', lr."cronTime" ::timestamp ) AS TIMESTAMP) AT TIME ZONE 'UTC'> now()`
          : `AND CAST(DATE_TRUNC('MINUTE', lr."cronTime" ::timestamp ) AS TIMESTAMP) AT TIME ZONE 'UTC'< now()`
        : ""
    }
`;

  const getRemindersQuery = `SELECT l."id" as "leaseId",lr."id", lr."reminderId",b."name_en" as "buildingName",
  mu."name" as "tenantName",l."endDate"  + INTERVAL '1 month' * COALESCE(CAST(l."discount"->>'grace' AS NUMERIC), 0) as "endingOn",
  lr."cronTime" as "lastScheduled",
  CASE
    WHEN 
    CAST(DATE_TRUNC('MINUTE', lr."cronTime" ::timestamp ) AS TIMESTAMP) AT TIME ZONE 'UTC'> now() THEN 'Pending'
    ELSE 'Sent'
    END AS "status",
  CASE 
      WHEN f."name_en" IS NOT NULL THEN f."name_en"
      ELSE sf."name_en"
  END AS "name_en"
  FROM lease_reminders lr
  JOIN leases l ON (l.id = lr."leaseId" and l."deletedAt" is null)
  JOIN master_users mu on(mu.id= l."masterUserId" and mu."deletedAt" is null)
  LEFT JOIN flats f ON (l."flatId" = f.id and f."deletedAt" is null)
  LEFT JOIN sub_flats sf ON (sf.id = l."subFlatId" AND sf."deletedAt" IS NULL)
  LEFT JOIN flats f1 ON (f1.id = sf."flatId" AND f1."deletedAt" IS NULL)
  join buildings b ON ((b.id = f."buildingId" OR b.id = f1."buildingId") AND b."deletedAt" IS NULL)
  where  b."propertyId" = :propertyId  ${
    buildingId ? `AND b.id = :buildingId` : ""
  } ${
    startDate && endDate
      ? `AND CAST(DATE_TRUNC('MINUTE', lr."cronTime" ::timestamp) AS TIMESTAMP) AT TIME ZONE 'UTC' between :startDate  and :endDate`
      : ""
  }
    ${
      search
        ? `and (
    b."name_en" ilike '%${search}%' OR
    f."name_en" ilike '%${search}%' OR
   sf."name_en" ilike '%${search}%' OR
    b."name_en" ilike '%${search}%' OR
    mu."name"   ilike '%${search}%' OR
    CAST(l."leaseId" AS TEXT) ilike '%${search}%'    
  )`
        : ""
    }
    ${
      status
        ? status === LEASE_REMINDER_STATUSES.PENDING
          ? `AND CAST(DATE_TRUNC('MINUTE', lr."cronTime" ::timestamp ) AS TIMESTAMP) AT TIME ZONE 'UTC'> now()`
          : `AND CAST(DATE_TRUNC('MINUTE', lr."cronTime" ::timestamp ) AS TIMESTAMP) AT TIME ZONE 'UTC'< now()`
        : ""
    }
    ORDER BY lr."createdAt" DESC LIMIT :limit OFFSET :offset
  `;

  const [[{ count }], reminders] = await Promise.all([
    db.sequelize.query(getRemindersCountQuery, {
      raw: true,
      type: db.Sequelize.QueryTypes.SELECT,
      replacements: {
        buildingId,
        propertyId,
        startDate,
        endDate,
      },
    }),
    db.sequelize.query(getRemindersQuery, {
      raw: true,
      type: db.Sequelize.QueryTypes.SELECT,
      replacements: {
        buildingId,
        propertyId,
        startDate,
        endDate,
        limit,
        offset,
      },
    }),
  ]);

  return { count, rows: reminders };
};

const sendReminders = async ({
  leaseId,
  cronId,
  scheduledFor,
  smsTitle,
  smsBody,
}) => {
  const query = `SELECT mu."mobileNumber", mu."name", mu.email, lr."reminderId",
 b."name_en" as "buildingName", DATE(l."endDate" + INTERVAL '1 month' * COALESCE(CAST(l."discount"->>'grace' AS NUMERIC), 0)) AS "expiryDate",
   CASE 
    WHEN f."name_en" IS NOT NULL THEN f."name_en"
    ELSE sf."name_en"
  END AS "flatName"
  FROM lease_reminders lr
  JOIN leases l ON (l.id = lr."leaseId" and l."deletedAt" is null)
  JOIN master_users mu ON (mu.id= l."masterUserId" and mu."deletedAt" is null)
  LEFT JOIN flats f ON (l."flatId" = f.id and f."deletedAt" is null)
  LEFT JOIN sub_flats sf ON (sf.id = l."subFlatId" AND sf."deletedAt" IS NULL)
  LEFT JOIN flats f1 ON (f1.id = sf."flatId" AND f1."deletedAt" IS NULL)
  JOIN buildings b ON ((b.id = f."buildingId" OR b.id = f1."buildingId") AND b."deletedAt" IS NULL)
  where lr."leaseId" = :leaseId and lr."cronId" = :cronId`;

  const [user] = await db.sequelize.query(query, {
    raw: true,
    type: db.Sequelize.QueryTypes.SELECT,
    replacements: {
      leaseId,
      cronId,
    },
  });
  let emailObj, smsObj;
  switch (scheduledFor) {
    case SCHEDULING_TYPES.E_MAIL:
      emailObj = {
        residentName: user.name,
        flatName: user.flatName,
        buildingName: user.buildingName,
        expiryDate: user.expiryDate,
      };
      leaseReminderInitiatedForUser(user.email, emailObj);
      break;
    case SCHEDULING_TYPES.SMS:
      break;
    case SCHEDULING_TYPES.BOTH:
      emailObj = {
        residentName: user.name,
        flatName: user.flatName,
        buildingName: user.buildingName,
        expiryDate: user.expiryDate,
      };
      leaseReminderInitiatedForUser(user.email, emailObj);
      break;

    default:
      logger.error(
        `Scheduling type not found for reminderId :${user.reminderId}`
      );
      break;
  }
  return null;
};

const sendDraftRemindersForAdmin = async ({
  leaseId,
  cronId,
  scheduledFor,
}) => {
  const query = `SELECT a."mobileNumber" , a."name", a.email, lr."reminderId",
 b."name_en" as "buildingName",
 DATE(l."createdAt") as "requestedTime",
 mu.name as "residentName",
 mu.email as "residentEmail",
 mu."mobileNumber" as "residentMobileNumber",
   CASE 
    WHEN f."name_en" IS NOT NULL THEN f."name_en"
    ELSE sf."name_en"
  END AS "flatName"
  FROM lease_reminders lr
  JOIN leases l ON (l.id = lr."leaseId" and l."deletedAt" is null)
  JOIN master_users mu ON (mu.id= l."masterUserId" and mu."deletedAt" is null)
  LEFT JOIN flats f ON (l."flatId" = f.id and f."deletedAt" is null)
  LEFT JOIN sub_flats sf ON (sf.id = l."subFlatId" AND sf."deletedAt" IS NULL)
  LEFT JOIN flats f1 ON (f1.id = sf."flatId" AND f1."deletedAt" IS NULL)
  JOIN buildings b ON ((b.id = f."buildingId" OR b.id = f1."buildingId") AND b."deletedAt" IS NULL)
  JOIN administrators a ON (a."propertyId" = b."propertyId" and a."deletedAt" is null)
  where lr."leaseId" = :leaseId and lr."cronId" = :cronId`;

  const [admin] = await db.sequelize.query(query, {
    raw: true,
    type: db.Sequelize.QueryTypes.SELECT,
    replacements: {
      leaseId,
      cronId,
    },
  });
  let emailObj;
  switch (scheduledFor) {
    case SCHEDULING_TYPES.E_MAIL:
      emailObj = {
        adminName: admin.name,
        buildingAndFlatName: `${admin.buildingName},${admin.flatName}`,
        residentName: admin.residentName,
        residentEmail: admin.residentEmail,
        residentMobileNumber: admin.residentMobileNumber,
        requestedTime: admin.requestedTime,
      };
      draftLeaseReminderForAdmin(admin.email, emailObj);
      break;
    case SCHEDULING_TYPES.SMS:
      break;
    case SCHEDULING_TYPES.BOTH:
      emailObj = {
        adminName: admin.name,
        buildingAndFlatName: `${admin.buildingName},${admin.flatName}`,
        residentName: admin.residentName,
        residentEmail: admin.residentEmail,
        residentMobileNumber: admin.residentMobileNumber,
        requestedTime: admin.requestedTime,
      };
      draftLeaseReminderForAdmin(admin.email, emailObj);
      break;

    default:
      logger.error(
        `Scheduling type not found for reminderId :${user.reminderId}`
      );
      break;
  }
  return null;
};

module.exports.sendLeaseExpiryRemindersCron = async () => {
  const query = `SELECT  mu."name" as "residentName", mu.email as "residentEmail",
 b."name_en" as "buildingName", DATE(l."endDate" + INTERVAL '1 month' * COALESCE(CAST(l."discount"->>'grace' AS NUMERIC), 0)) AS "expiryDate",
    CASE 
    WHEN f."name_en" IS NOT NULL THEN f."name_en"
    ELSE sf."name_en"
  END AS "flatName",
  EXTRACT(EPOCH FROM AGE(DATE(l."endDate" + INTERVAL '1 month' * COALESCE(CAST(l."discount"->>'grace' AS NUMERIC), 0)), CURRENT_DATE)) / (60 * 60 * 24) AS "expiresIn"
  FROM leases l
  JOIN lease_statuses ls ON(l.id = ls."leaseId" AND ls."deletedAt" is null)
  JOIN master_users mu ON (mu.id= l."masterUserId" and mu."deletedAt" is null)
  LEFT JOIN flats f ON (l."flatId" = f.id and f."deletedAt" is null)
  LEFT JOIN sub_flats sf ON (sf.id = l."subFlatId" AND sf."deletedAt" IS NULL)
  LEFT JOIN flats f1 ON (f1.id = sf."flatId" AND f1."deletedAt" IS NULL)
  JOIN buildings b ON ((b.id = f."buildingId" OR b.id = f1."buildingId") AND b."deletedAt" IS NULL)
  where l."deletedAt" is null and DATE(l."endDate") + INTERVAL '1 month' * COALESCE(CAST(l."discount"->>'grace' AS NUMERIC), 0) <= CURRENT_DATE + INTERVAL '90 days'
  AND ls."status"='${LEASE_STATUSES.ACTIVE}' order by ls."createdAt" desc`;

  const expiringLeases = await db.sequelize.query(query, {
    raw: true,
    type: db.Sequelize.QueryTypes.SELECT,
  });

  expiringLeases.map((expiryLease) => {
    emailObj = {
      residentName: expiryLease.residentName,
      flatName: expiryLease.flatName,
      buildingName: expiryLease.buildingName,
      expiryDate: expiryLease.expiryDate,
      expiresIn: expiryLease.expiresIn,
    };
    leaseReminderInitiatedForUserCron(expiryLease.residentEmail, emailObj);
  });
  return null;
};

module.exports.addInstantReminder = async (data) => {
  const reference = `addInstantReminder`;

  const lease = await getLeaseWithLatestStatus({
    id: data.leaseId,
  });

  if (!lease) {
    throw new AppError(reference, "lease not found", "custom", 404);
  }

  if (
    lease.statuses[0].status !== LEASE_STATUSES.ACTIVE &&
    lease.statuses[0].status !== LEASE_STATUSES.DRAFT
  ) {
    throw new AppError(
      reference,
      "Only Active/Draft lease allowed",
      "custom",
      412
    );
  }
  if (lease.statuses[0].status === LEASE_STATUSES.ACTIVE) {
    data.cronId = String(Date.now());
    data.scheduledFor = SCHEDULING_TYPES.E_MAIL;
    await LeaseReminder.create(data);
    sendReminders({
      leaseId: data.leaseId,
      cronId: data.cronId,
      scheduledFor: SCHEDULING_TYPES.E_MAIL,
    });
  }

  if (lease.statuses[0].status === LEASE_STATUSES.DRAFT) {
    data.cronId = String(Date.now());
    data.scheduledFor = SCHEDULING_TYPES.E_MAIL;
    await LeaseReminder.create(data);
    sendDraftRemindersForAdmin({
      leaseId: data.leaseId,
      cronId: data.cronId,
      scheduledFor: SCHEDULING_TYPES.E_MAIL,
    });
  }

  return null;
};

module.exports.restartReminders = async () => {
  const query = `SELECT *
FROM lease_reminders
WHERE  TO_TIMESTAMP("cronTime", 'YYYY-MM-DD HH24:MI:SS') >= NOW()`;
  try {
    const leaseReminders = await db.sequelize.query(query, {
      raw: true,
      type: db.Sequelize.QueryTypes.SELECT,
    });

    leaseReminders.map((leaseReminder) => {
      schedule.scheduleJob(leaseReminder.cronId, leaseReminder.cronTime, () =>
        sendReminders({
          leaseId: leaseReminder.leaseId,
          cronId: leaseReminder.cronId,
          scheduledFor: leaseReminder.scheduledFor,
          smsTitle: leaseReminder.smsTitle,
          smsBody: leaseReminder.smsBody,
        })
      );
    });
    logger.info(`${leaseReminders.length} reminder jobs were restarted`);
  } catch (error) {
    logger.error(`Job failed with error: ${JSON.stringify(error.message)}`);
  }
};
