const env = process.env.NODE_ENV || "development";
const stripeConfig = require("../../config/stripe.json")[env];
const stripe = require("stripe")(stripeConfig.SECRET_KEY);
const { AppError } = require("../../utils/errorHandler");
const UserInformation = require("../../user-service/models/UserInformation");
const { getChargePaymentDetails } = require("./charge");
const Payment = require("../models/Payment");
const { PAYMENT_STATUSES } = require("../../config/constants");
const logger = require("../../utils/logger");

async function createPayment(data) {
  return await Payment.create(data);
}

async function updatePaymentStatus(params, payStatus) {
  await Payment.update(payStatus, { where: params });
}

//add new card
const addPaymentMethod = async (data) => {
  if (!data.cardNumber || !data.expiryMonth || !data.expiryYear || !data.cvc) {
    throw new AppError("addPaymentMethod", "All fields are required");
  }
  const customerData = {
    name: data.name,
    email: data.email,
    phone: data.phone,
  };
  const customer = await findOrCreateCustomer(
    { userId: data.userId },
    customerData
  );
  const cardData = {
    number: data.cardNumber,
    exp_month: data.expiryMonth,
    exp_year: data.expiryYear,
    cvc: data.cvc,
  };
  try {
    const paymentMethod = await createPaymentMethod(cardData);

    const savedCards = await stripe.customers.listPaymentMethods(
      customer.customerId,
      {
        type: "card",
      }
    );

    for (let card of savedCards.data) {
      if (card.card.fingerprint == paymentMethod.card.fingerprint) {
        throw new AppError("addPaymentMethod", "Card already exists");
      }
    }
    const newPaymentMethod = await stripe.paymentMethods.attach(
      paymentMethod.id,
      {
        customer: customer.customerId,
      }
    );
    if (newPaymentMethod) {
      delete newPaymentMethod.billing_details;
      delete newPaymentMethod.card.fingerprint;
    }
    return newPaymentMethod;
  } catch (error) {
    throw new AppError(
      "addPaymentMethod",
      error.message,
      "custom",
      error.statusCode
    );
  }
};

//list all cards of a user
const getPaymentMethodList = async (params) => {
  const findCustomer = await UserInformation.findOne({ where: params });

  if (!findCustomer || !findCustomer.customerId) {
    return "No cards found";
  }
  const paymentMethods = await stripe.customers.listPaymentMethods(
    findCustomer.customerId,
    {
      type: "card",
    }
  );
  for (let card of paymentMethods.data) {
    delete card.billing_details;
    delete card.card.fingerprint;
  }
  return paymentMethods;
};

//delete saved card
const removeCard = async (data) => {
  if (!data.paymentMethodId) {
    throw new AppError("removeCard", "Payment Method ID is required");
  }
  try {
    await stripe.paymentMethods.detach(data.paymentMethodId);
    return "Card removed successfully";
  } catch (error) {
    throw new AppError("removeCard", error.message);
  }
};

//create payment-intent
const createIntent = async (data) => {
  if (!data.chargeId) {
    throw new AppError("createIntent", "Charge ID is required");
  }
  const chargeDetail = await getChargePaymentDetails({
    chargeId: data.chargeId,
    flatId: data.flatId,
  });
  if (!chargeDetail) {
    throw new AppError("createIntent", "Charge not found");
  }

  const customerData = {
    name: data.name,
    email: data.email,
    phone: data.phone,
  };
  const customer = await findOrCreateCustomer(
    { userId: data.userId },
    customerData
  );

  const paymentIntentObject = {
    currency: chargeDetail.currency,
    amount: chargeDetail.finalAmount * 100,
    customer: customer.customerId,
    receipt_email: data.email,
  };

  // paymentIntentObject.setup_future_usage = "off_session";
  paymentIntentObject.automatic_payment_methods = { enabled: true };

  try {
    let paymentIntent = await stripe.paymentIntents.create(paymentIntentObject);

    const paymentData = {
      chargeId: data.chargeId,
      amount: chargeDetail.finalAmount,
      stripePaymentIntentId: paymentIntent.id,
      userId: data.userId,
    };

    await createPayment(paymentData);

    logger.info(`Payment Intent created: ${paymentIntent.id}`);

    return {
      clientSecret: paymentIntent.client_secret,
      paymentDone: false,
    };
  } catch (error) {
    throw new AppError("createIntent", error.message);
  }
};

const findOrCreateCustomer = async (params, data) => {
  const findCustomer = await UserInformation.findOne({ where: params });
  if (!findCustomer) {
    //TODO: userInfo creation to be removed later
    const userInformationData = {
      ...params,
      customerId: (await stripe.customers.create(data)).id,
    };
    const customer = await UserInformation.create(userInformationData);
    return customer;
    // throw new AppError("findOrCreateCustomer", "User information not found");
  }
  if (!findCustomer.customerId) {
    findCustomer.customerId = (await stripe.customers.create(data)).id;
    await findCustomer.save();
  }
  return findCustomer;
};

const createPaymentMethod = async (params) => {
  const paymentMethod = await stripe.paymentMethods.create({
    type: "card",
    card: params,
  });
  return paymentMethod;
};

module.exports = {
  addPaymentMethod,
  getPaymentMethodList,
  removeCard,
  createIntent,
  createPayment,
  updatePaymentStatus,
};
