const { createNewCharge } = require("../../charge-service/controllers/charge");
const {
  MAINTENANCE_STATUSES,
  SERVICE_TAX,
  CURRENCY,
  CHARGE_TYPES,
} = require("../../config/constants");
const {
  getRequestWithChargeAndPayment,
  getRequestWithFlatBuildingAndStaff,
} = require("../../maintenanceRequest-service/controllers/maintenanceRequest");
const { getUser } = require("../../user-service/controllers/user");
const { AppError } = require("../../utils/errorHandler");
const { calucatePercent } = require("../../utils/utility");
const MaintenanceCatalogue = require("../models/MaintenanceCatalogue");
const MaintenanceChargeCatalogue = require("../models/MaintenanceChargeCatalogue");
const { getChargeCatalogue } = require("./maintenanceChargeCatalogue");

//request payment
const requestPayment = async (data) => {
  if (!data.requestId) {
    throw new AppError("requestPayment", "Request ID is required");
  }
  const request = await getRequestWithChargeAndPayment({ id: data.requestId });
  if (!request) {
    throw new AppError("requestPayment", "Request not found");
  }

  if (request.status == MAINTENANCE_STATUSES.CANCELLED.key) {
    throw new AppError("requestPayment", "Cannot request for payment");
  } else if (request.charge) {
    throw new AppError("requestPayment", "Payment already requested");
  }

  if (!data.charges || !Array.isArray(data.charges)) {
    throw new AppError("requestPayment", "Enter charges in valid format");
  }

  let invoiceAmount = 0,
    totalAmount;
  for (let charge of data.charges) {
    invoiceAmount += (await getChargeCatalogue({ id: charge })).serviceCost;
  }
  totalAmount = invoiceAmount + calucatePercent(invoiceAmount, SERVICE_TAX);

  let maintenanceCatalogueData = [];
  for (let charge of data.charges) {
    const maintenanceCatalogueObj = {
      maintenanceId: request.id,
      maintenanceChargeCatalogueId: charge,
    };
    maintenanceCatalogueData.push(maintenanceCatalogueObj);
  }
  const maintenanceCatalogues = await MaintenanceCatalogue.bulkCreate(
    maintenanceCatalogueData
  );

  const chargeData = {
    currency: CURRENCY.AED,
    amount: totalAmount,
    chargeType: CHARGE_TYPES.MAINTENANCE.key,
    chargeTypeId: request.id,
    flatId: (await getUser({ id: request.userId })).flatId,
  };
  const charge = await createNewCharge(chargeData);
  // await request.update({ status: MAINTENANCE_STATUSES.COMPLETED.key });
  return { charge, maintenanceCatalogues, invoiceAmount, totalAmount };
};

//get requested payment
const getRequestedPayment = async (params) => {
  const request = await getRequestWithFlatBuildingAndStaff(params);
  if (!request) {
    throw new AppError("getRequestedPayment", "Request not found");
  }
  const services = await getMaintenanceCataloguesWithChargeCatalogue({
    maintenanceId: request.id,
  });

  let invoiceAmount = 0,
    tax = SERVICE_TAX;

  for (let service of services) {
    invoiceAmount += service.charge.serviceCost;
  }

  const serviceTax = calucatePercent(invoiceAmount, tax);
  const totalAmount = invoiceAmount + serviceTax;

  return { request, services, invoiceAmount, serviceTax, totalAmount };
};

async function getMaintenanceCataloguesWithChargeCatalogue(params) {
  return await MaintenanceCatalogue.findAll({
    where: params,
    include: {
      model: MaintenanceChargeCatalogue,
      as: "charge",
      required: false,
    },
  });
}

module.exports = {
  requestPayment,
  getRequestedPayment,
  getMaintenanceCataloguesWithChargeCatalogue,
};
