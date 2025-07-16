const db = require("../../database");
const { LEASE_STATUSES } = require("../../config/constants");
const LeaseStatus = require("../models/LeaseStatus");
const { deleteUser } = require("../../user-service/controllers/user");

module.exports.expireLeasesCron = async () => {
  const query = `
    select l."masterUserId" ,l.id as "leaseId", u.id as "userId", ls."status" as status FROM leases l
    JOIN (
        SELECT DISTINCT ON("leaseId") id, "leaseId", status, "createdAt" FROM lease_statuses
        WHERE "deletedAt" IS NULL ORDER BY "leaseId", "createdAt" DESC
      ) ls ON (l.id = ls."leaseId")
    JOIN master_users mu ON (mu."id" = l."masterUserId" and mu."deletedAt" is null)
    JOIN users u ON (u."mobileNumber" = mu."mobileNumber" and u."deletedAt" is null)
    where l."endDate" + INTERVAL '1 month' * COALESCE(CAST(l."discount"->>'grace' AS NUMERIC), 0) < NOW()
    and ls."status" = :status
`;
  const expiredLeases = await db.sequelize.query(query, {
    raw: true,
    type: db.Sequelize.QueryTypes.SELECT,
    replacements: {
      status: LEASE_STATUSES.ACTIVE,
    },
  });
  await Promise.all(
    expiredLeases.map((lease) => {
      LeaseStatus.create({
        status: LEASE_STATUSES.EXPIRED,
        leaseId: lease.leaseId,
      });
      deleteUser({ id: lease.userId });
    })
  );

  return expiredLeases.length;
};
