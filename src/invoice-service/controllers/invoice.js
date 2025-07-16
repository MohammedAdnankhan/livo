const {
  INVOICE_TYPES,
  INVOICE_PAYMENT_STATUSES,
} = require("../../config/constants");
const db = require("../../database");
const { AppError } = require("../../utils/errorHandler");
const Invoice = require("../models/Invoice");
const Payment = require("../models/Payment");
const PaymentStatus = require("../models/PaymentStatus");

const generateInvoiceId = () => {
  const prefix = "INV";
  const date = new Date();
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const day = date.getDate().toString().padStart(2, "0");
  const randomPart = Math.floor(Math.random() * 10000)
    .toString()
    .padStart(4, "0");

  return `${prefix}-${year}${month}${day}-${randomPart}`;
};

module.exports.generateInvoice = async (data) => {
  data.invoiceId = generateInvoiceId();
  data.invoiceType = INVOICE_TYPES.PRODUCTS;
  const transaction = await db.sequelize.transaction();
  try {
    delete data.sendEmail;
    const invoice = await Invoice.create(data, { transaction });
    const createPayment = await Payment.create(
      {
        invoiceId: invoice.id,
        amount: invoice.finalAmount,
      },
      { transaction }
    );
    await PaymentStatus.create(
      {
        paymentId: createPayment.id,
        status: INVOICE_PAYMENT_STATUSES.OPENED,
      },
      { transaction }
    );
    await transaction.commit();
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

module.exports.getInvoices = async (params, { limit, offset }) => {
  const countQuery = `SELECT COUNT(*)::INTEGER
FROM (
  SELECT DISTINCT i."invoiceId"
  FROM invoices i
  INNER JOIN payments p ON p."invoiceId" = i.id AND p."deletedAt" IS NULL
  INNER JOIN payment_statuses ps ON ps."paymentId" = p."id" AND ps."deletedAt" IS NULL
  LEFT JOIN leases l ON (l."masterUserId"= i."masterUserId" and l."deletedAt" IS null)
  LEFT JOIN flats f ON (f.id = l."flatId" AND f."deletedAt" IS NULL)
  LEFT JOIN sub_flats sf ON (sf.id = l."subFlatId" AND sf."deletedAt" IS NULL)
  LEFT JOIN flats f1 ON (f1.id = sf."flatId" AND f1."deletedAt" IS NULL)
  LEFT JOIN buildings b ON ((b.id = f."buildingId" OR b.id = f1."buildingId") AND b."deletedAt" IS NULL)
  WHERE i."propertyId" = :propertyId and i."deletedAt" is null
  ${params.buildingId ? `AND b."id" = :buildingId` : ""}
  ${
    params.search
      ? `AND (
          i."invoiceId" ILIKE '%${params.search}%' OR
          i."userInfo"->>'name' ILIKE '%${params.search}%' OR
          CAST(i."createdAt" AS TEXT) ILIKE '%${params.search}%' OR
          CAST(i."dueDate" AS TEXT) ILIKE '%${params.search}%' OR
          CAST(i."finalAmount" AS TEXT) ILIKE '%${params.search}%' OR
          ps."status" ILIKE '%${params.search}%'
        )`
      : ""
  }
) AS CountedInvoices;
`;

  const dataQuery = `SELECT DISTINCT ON (i."invoiceId")
  i.id,
  i."invoiceId",
  i."userInfo"->>'name' AS "masterUserName",
  i."createdAt" AS "createdAt",
  i."dueDate",
  i."currency",
  i."userInfo",
  i."finalAmount",
  ps."status",
 CASE
    WHEN i."dueDate" < CURRENT_DATE THEN 
      ROUND(EXTRACT(EPOCH FROM AGE(CURRENT_DATE, i."dueDate")) / 86400)
    ELSE 0
  END AS "overDueBy"
 FROM invoices i
 INNER JOIN payments p ON p."invoiceId" = i.id AND p."deletedAt" IS NULL
 INNER JOIN payment_statuses ps ON ps."paymentId" = p."id" AND ps."deletedAt" IS NULL
 LEFT JOIN leases l ON (l."masterUserId"= i."masterUserId" and l."deletedAt" IS null)
 LEFT JOIN flats f ON (f.id = l."flatId" AND f."deletedAt" IS NULL)
 LEFT JOIN sub_flats sf ON (sf.id = l."subFlatId" AND sf."deletedAt" IS NULL)
 LEFT JOIN flats f1 ON (f1.id = sf."flatId" AND f1."deletedAt" IS NULL)
 LEFT JOIN buildings b ON ((b.id = f."buildingId" OR b.id = f1."buildingId") AND b."deletedAt" IS NULL)
 WHERE i."propertyId" = :propertyId and i."deletedAt" is null
 ${params.buildingId ? `AND b."id" = :buildingId` : ""}

  ${
    params.search
      ? `and (
    i."invoiceId" ilike '%${params.search}%' OR
    i."userInfo"->>'name' ILIKE '%${params.search}%' OR
    CAST(i."createdAt" AS TEXT) ilike '%${params.search}%' OR
    CAST(i."dueDate" AS TEXT) ilike '%${params.search}%' OR
    CAST(i."finalAmount" AS TEXT) ilike '%${params.search}%' OR
    ps."status" ilike '%${params.search}%'
  )`
      : ""
  }
 ORDER BY i."invoiceId", ps."createdAt" DESC
 limit :limit offset :offset;`;

  const [invoiceCount, data] = await Promise.all([
    db.sequelize.query(countQuery, {
      type: db.Sequelize.QueryTypes.SELECT,
      raw: true,
      nest: true,
      replacements: {
        propertyId: params.propertyId,
        buildingId: params.buildingId,
      },
    }),
    db.sequelize.query(dataQuery, {
      type: db.Sequelize.QueryTypes.SELECT,
      raw: true,
      nest: true,
      replacements: {
        propertyId: params.propertyId,
        buildingId: params.buildingId,
        offset,
        limit,
      },
    }),
  ]);
  return { count: invoiceCount[0].count, rows: data };
};

module.exports.getInvoiceDetails = async (params) => {
  const reference = "getInvoiceDetails";
  const dataQuery = `SELECT
i.id, i."invoiceFor", i."invoiceId", i."masterUserId", i."invoiceType", i."products", i.currency,
i."paymentMode", i."invoiceUrl"	, i."dueDate", i."documents", i."termsConditions", i."totalAmount",
i."discountType", i."discountValue", i."taxValue", i."finalAmount", i."propertyId",
i."createdAt", i."invoiceDate", i."tagIds",
  json_agg(jsonb_build_object(
    'status', ps."status",
    'createdAt', ps."createdAt",
    'paidDate', ps."paidDate",
    'dueAmount', ps."dueAmount",
    'amountPaid', ps."amountPaid",
    'paymentMode', ps."paymentMode",
    'transactionId', ps."transactionId"
  ) ORDER BY ps."createdAt" ASC) AS paymentStatuses,
  i."userInfo", i."netAmount", i."subTotalAmount", i."depositedAmount"
FROM invoices i
LEFT JOIN LATERAL (
  SELECT ps."status", ps."createdAt", ps."paymentMode", ps."transactionId", ps."amountPaid", ps."dueAmount",  ps."paidDate"
  FROM payments p
  INNER JOIN payment_statuses ps ON ps."paymentId" = p."id" AND ps."deletedAt" IS NULL
  WHERE p."invoiceId" = i.id
) ps ON true
WHERE i."propertyId" = :propertyId AND i.id = :invoiceId AND i."deletedAt" IS NULL
GROUP BY i.id
ORDER BY i."invoiceId", i."createdAt" DESC;
`;

  const invoice = await db.sequelize.query(dataQuery, {
    type: db.Sequelize.QueryTypes.SELECT,
    raw: true,
    mapToModel: true,
    nest: true,
    replacements: {
      propertyId: params.propertyId,
      invoiceId: params.invoiceId,
    },
  });
  if (invoice.length === 0) {
    throw new AppError(reference, "Invoice not found", "custom", 404);
  }
  return invoice[0];
};

module.exports.updateInvoice = async (data) => {
  const reference = `updateInvoice`;
  delete data.sendEmail;
  const invoice = await Invoice.findOne({
    where: { id: data.invoiceId, propertyId: data.propertyId },
  });

  if (!invoice) {
    throw new AppError(reference, "Invoice not found", "custom", 404);
  }

  if (data.amountReceived) {
    const payment = await Payment.findOne({
      where: { invoiceId: data.invoiceId },
    });
    payment.amount = data.finalAmount;
    await payment.save();
    if (data.finalAmount === 0) {
      await PaymentStatus.create({
        paymentId: payment.id,
        status: INVOICE_PAYMENT_STATUSES.PAID,
        amountPaid: data.amountReceived,
        dueAmount: data.finalAmount,
        paidDate: data?.paidDate,
        paymentMode: data?.paymentMode,
        transactionId: data?.transactionId,
      });
    } else {
      await PaymentStatus.create({
        paymentId: payment.id,
        status: INVOICE_PAYMENT_STATUSES.PAYMENT_RECEIVED,
        amountPaid: data.amountReceived,
        dueAmount: data.finalAmount,
        paidDate: data?.paidDate,
        paymentMode: data?.paymentMode,
        transactionId: data?.transactionId,
      });
    }
    invoice.depositedAmount += parseFloat(data.amountReceived);
    parseFloat(invoice.depositedAmount).toFixed(2);
  }

  if (!data.amountReceived && data.finalAmount) {
    const payment = await Payment.findOne({ invoiceId: data.invoiceId });
    payment.amount = data.finalAmount;
    await payment.save();
  }
  delete data.amountReceived;
  delete data.invoiceId;
  delete data.transactionId;
  Object.keys(data).map((key) => (invoice[key] = data[key]));

  await invoice.save();
  return null;
};
