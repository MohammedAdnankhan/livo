const nodemailer = require("nodemailer");
const env = process.env.NODE_ENV || "development";
const mailConfig = require("./../config/mail.json")[env];

const sgMail = require("@sendgrid/mail");
const logger = require("./logger");
sgMail.setApiKey(mailConfig.apiKey);

const templates = {
  SIGNUP_INITIATED_ADMIN: "d-9eeb27a5c3ad4961b5c8fcfdb34869c2",
  SIGNUP_INITIATED_USER: "d-bb0023ae3def4718a562c59017619d79",
  SIGNUP_APPROVED_USER: "d-dd2a213f0ca64e3eb0a92f5659892a24",
  REQUEST_CREATED_USER: "d-5ef822c63e814af48dbb36c650b43748",
  REQUEST_CREATED_ADMIN: "d-365cf1ae04d7479fb6f8f4e683aabf45",
  REQUEST_COMPLETED_USER: "d-3a9015b4d4a445eea907af6b7e9ec278",
  REQUEST_COMPLETED_ADMIN: "d-55decd784ea34700ac41748e8622ec81",
  REQUEST_STATUS_CHANGE_ADMIN: "d-d4625b61c08c4967a6d57f4340ecd551",
  REQUEST_STATUS_CHANGE_USER: "d-252b1cf48280490984239360917c8a1d",
  SIGNUP_REJECTED_USER: "d-d8814c823c064178b57e3ecc809c0bcc",
  SIGNUP_REJECTED_ADMIN: "d-aaea4fad1bc14457aa4206d34ba18924",
  ADMIN_COMPLETED_SIGNUP_USER: "d-27db4a78cca04bf592263c85a3700f5b",
  ADMIN_COMPLETED_SIGNUP_ADMIN: "d-197e930a8a9e41ae9f6f093b7924728a",
  SIGNUP_COMPLETED_BYPASS_USER: "d-47b220cd7431400eb6b00208008ee607",
  RENEWAL_REMINDER_ADMIN: "d-b066ca6f21e7459f8d014c8a986bc1f3",
  RENEWAL_REMINDER_USER: "d-013612a1b41940f6ad60f0f2ca56ec9c",
  LEASE_REMINDER_INITIATED_FOR_USER: "d-94b8f19437834abb9c4d3028595d1dd5",
  LEASE_REMINDER_INITIATED_FOR_USER_CRON: "d-d0a57315ccdd40cbae3f71649bb050f4",
  DRAFT_LEASE_REMINDER_FOR_ADMIN: "d-ddd7281f66d64365b39b6887d57805f1",
};

class Email {
  constructor(user) {
    this.email = user.email;
    this.firstName = user.name.split(" ")[0];
    this.from = "Livo Team <livo.team@gmail.com>";
    this.cc = "team@livo.ae";
  }

  newTransport() {
    return nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: mailConfig.email,
        pass: mailConfig.password,
      },
    });
  }

  async send(subject, template) {
    const mailOptions = {
      from: this.from,
      to: this.email,
      cc: this.cc,
      subject,
      html: `<p>${template}</p>`,
    };
    await this.newTransport().sendMail(mailOptions);
  }
}

function singUpInitiatedForUser(to, emailObj) {
  //buildingName, flatName, residentName
  const msg = {
    personalizations: [
      {
        to,
        dynamicTemplateData: emailObj,
        headers: {
          "X-Custom-Header": "Recipient 1",
        },
        customArgs: {
          myArg: "Recipient 1",
        },
      },
    ],
    from: { email: mailConfig.senderId },
    templateId: templates.SIGNUP_INITIATED_USER,
  };
  sgMail
    .send(msg)
    .then(() => logger.info(`Email sent to ${to} for singUpInitiatedForUser`))
    .catch((err) => {
      logger.error(`Error in singUpInitiatedForUser, ${JSON.stringify(err)}`);
    });
}

function singUpInitiatedForAdmin(to, emailObj) {
  //residentName, buildingName, buildingAndFlatName, requestedTime, residentMobileNumber, residentEmail
  const msg = {
    personalizations: [
      {
        to,
        dynamicTemplateData: emailObj,
        headers: {
          "X-Custom-Header": "Recipient 1",
        },
        customArgs: {
          myArg: "Recipient 1",
        },
      },
    ],
    from: { email: mailConfig.senderId },
    templateId: templates.SIGNUP_INITIATED_ADMIN,
  };
  sgMail
    .send(msg)
    .then(() => logger.info(`Email sent to ${to} for singUpInitiatedForAdmin`))
    .catch((err) => {
      logger.error(`Error in singUpInitiatedForAdmin, ${JSON.stringify(err)}`);
    });
}

function singUpApprovedForUser(to, emailObj) {
  //residentName, adminMobileNumber
  const msg = {
    personalizations: [
      {
        to,
        dynamicTemplateData: emailObj,
        headers: {
          "X-Custom-Header": "Recipient 1",
        },
        customArgs: {
          myArg: "Recipient 1",
        },
      },
    ],
    from: { email: mailConfig.senderId },
    templateId: templates.SIGNUP_APPROVED_USER,
  };
  sgMail
    .send(msg)
    .then(() => logger.info(`Email sent to ${to} for singUpApprovedForUser`))
    .catch((err) => {
      logger.error(`Error in singUpApprovedForUser, ${JSON.stringify(err)}`);
    });
}

function signupCompletedByAdminForUser(to, emailObj) {
  //buildingName, residentName, residentMobileNumber, password
  const msg = {
    personalizations: [
      {
        to,
        dynamicTemplateData: emailObj,
        headers: {
          "X-Custom-Header": "Recipient 1",
        },
        customArgs: {
          myArg: "Recipient 1",
        },
      },
    ],
    from: { email: mailConfig.senderId },
    templateId: templates.ADMIN_COMPLETED_SIGNUP_USER,
  };
  sgMail
    .send(msg)
    .then(() =>
      logger.info(`Email sent to ${to} for signupCompletedByAdminForUser`)
    )
    .catch((err) => {
      logger.error(
        `Error in signupCompletedByAdminForUser, ${JSON.stringify(err)}`
      );
    });
}

function signupCompletedBypassForUser(to, emailObj) {
  //buildingName, residentName
  const msg = {
    personalizations: [
      {
        to,
        dynamicTemplateData: emailObj,
        headers: {
          "X-Custom-Header": "Recipient 1",
        },
        customArgs: {
          myArg: "Recipient 1",
        },
      },
    ],
    from: { email: mailConfig.senderId },
    templateId: templates.SIGNUP_COMPLETED_BYPASS_USER,
  };
  sgMail
    .send(msg)
    .then(() =>
      logger.info(`Email sent to ${to} for signupCompletedBypassForUser`)
    )
    .catch((err) => {
      logger.error(
        `Error in signupCompletedBypassForUser, ${JSON.stringify(err)}`
      );
    });
}

function requestCreatedForUser(to, emailObj) {
  //ticketNo, residentName, dateOfRequest, createdTime, flatName, isUrgent, category, description, timeSlot
  const msg = {
    personalizations: [
      {
        to,
        dynamicTemplateData: emailObj,
        headers: {
          "X-Custom-Header": "Recipient 1",
        },
        customArgs: {
          myArg: "Recipient 1",
        },
      },
    ],
    from: { email: mailConfig.senderId },
    templateId: templates.REQUEST_CREATED_USER,
  };
  sgMail
    .send(msg)
    .then(() => logger.info(`Email sent to ${to} for requestCreatedForUser`))
    .catch((err) => {
      logger.error(`Error in requestCreatedForUser, ${JSON.stringify(err)}`);
    });
}

function requestCreatedForAdmin(to, emailObj) {
  //ticketNo, residentName, dateOfRequest, createdTime, flatName, buildingName, isUrgent, category, description, timeSlot
  const msg = {
    personalizations: [
      {
        to,
        dynamicTemplateData: emailObj,
        headers: {
          "X-Custom-Header": "Recipient 1",
        },
        customArgs: {
          myArg: "Recipient 1",
        },
      },
    ],
    from: { email: mailConfig.senderId },
    templateId: templates.REQUEST_CREATED_ADMIN,
  };
  sgMail
    .send(msg)
    .then(() => logger.info(`Email sent to ${to} for requestCreatedForAdmin`))
    .catch((err) => {
      logger.error(`Error in requestCreatedForAdmin, ${JSON.stringify(err)}`);
    });
}

function requestStatusChangeForUser(to, emailObj) {
  const msg = {
    personalizations: [
      {
        to,
        dynamicTemplateData: emailObj,
        headers: {
          "X-Custom-Header": "Recipient 1",
        },
        customArgs: {
          myArg: "Recipient 1",
        },
      },
    ],
    from: { email: mailConfig.senderId },
    templateId: templates.REQUEST_STATUS_CHANGE_USER,
  };
  sgMail
    .send(msg)
    .then(() =>
      logger.info(`Email sent to ${to} for requestStatusChangeForUser`)
    )
    .catch((err) => {
      logger.error(
        `Error in requestStatusChangeForUser, ${JSON.stringify(err)}`
      );
    });
}

function requestStatusChangeForAdmin(to, emailObj) {
  const msg = {
    personalizations: [
      {
        to,
        dynamicTemplateData: emailObj,
        headers: {
          "X-Custom-Header": "Recipient 1",
        },
        customArgs: {
          myArg: "Recipient 1",
        },
      },
    ],
    from: { email: mailConfig.senderId },
    templateId: templates.REQUEST_STATUS_CHANGE_ADMIN,
  };
  sgMail
    .send(msg)
    .then(() =>
      logger.info(`Email sent to ${to} for requestStatusChangeForAdmin`)
    )
    .catch((err) => {
      logger.error(
        `Error in requestStatusChangeForAdmin, ${JSON.stringify(err)}`
      );
    });
}

function requestCompletedForUser(to, emailObj) {
  const msg = {
    personalizations: [
      {
        to,
        dynamicTemplateData: emailObj,
        headers: {
          "X-Custom-Header": "Recipient 1",
        },
        customArgs: {
          myArg: "Recipient 1",
        },
      },
    ],
    from: { email: mailConfig.senderId },
    templateId: templates.REQUEST_COMPLETED_USER,
  };
  sgMail
    .send(msg)
    .then(() => logger.info(`Email sent to ${to} for requestCompletedForUser`))
    .catch((err) => {
      logger.error(`Error in requestCompletedForUser, ${JSON.stringify(err)}`);
    });
}

function requestCompletedForAdmin(to, emailObj) {
  const msg = {
    personalizations: [
      {
        to,
        dynamicTemplateData: emailObj,
        headers: {
          "X-Custom-Header": "Recipient 1",
        },
        customArgs: {
          myArg: "Recipient 1",
        },
      },
    ],
    from: { email: mailConfig.senderId },
    templateId: templates.REQUEST_COMPLETED_ADMIN,
  };
  sgMail
    .send(msg)
    .then(() => logger.info(`Email sent to ${to} for requestCompletedForAdmin`))
    .catch((err) => {
      logger.error(`Error in requestCompletedForAdmin, ${JSON.stringify(err)}`);
    });
}
//*RENEWAL REMINDER FOR USER
function renewalReminderForUser(to, emailObj) {
  //residentName, residentEmail
  const msg = {
    personalizations: [
      {
        to,
        dynamicTemplateData: emailObj,
        headers: {
          "X-Custom-Header": "Recipient 1",
        },
        customArgs: {
          myArg: "Recipient 1",
        },
      },
    ],
    from: { email: mailConfig.senderId },
    templateId: templates.RENEWAL_REMINDER_USER,
  };
  sgMail
    .send(msg)
    .then(() => logger.info(`Email sent to ${to} for renewalReminderForUser`))
    .catch((err) => {
      logger.error(`Error in renewalReminderForUser, ${JSON.stringify(err)}`);
    });
}
//*RENEWAL REMINDER FOR ADMIN
function renewalReminderForAdmin(to, emailObj) {
  //residentName, residentEmail
  const msg = {
    personalizations: [
      {
        to,
        dynamicTemplateData: emailObj,
        headers: {
          "X-Custom-Header": "Recipient 1",
        },
        customArgs: {
          myArg: "Recipient 1",
        },
      },
    ],
    from: { email: mailConfig.senderId },
    templateId: templates.RENEWAL_REMINDER_ADMIN,
  };
  sgMail
    .send(msg)
    .then(() => logger.info(`Email sent to ${to} for renewalReminderForAdmin`))
    .catch((err) => {
      logger.error(`Error in renewalReminderForAdmin, ${JSON.stringify(err)}`);
    });
}
function leaseReminderInitiatedForUser(to, emailObj) {
  const msg = {
    personalizations: [
      {
        to,
        dynamicTemplateData: emailObj,
        headers: {
          "X-Custom-Header": "Recipient 1",
        },
        customArgs: {
          myArg: "Recipient 1",
        },
      },
    ],
    from: { email: mailConfig.senderId },
    templateId: templates.LEASE_REMINDER_INITIATED_FOR_USER,
  };
  sgMail
    .send(msg)
    .then(() =>
      logger.info(`Email sent to ${to} leaseReminderInitiatedForUser`)
    )
    .catch((err) => {
      logger.error(
        `Error in leaseReminderInitiatedForUser, ${JSON.stringify(err)}`
      );
    });
}

function draftLeaseReminderForAdmin(to, emailObj) {
  const msg = {
    personalizations: [
      {
        to,
        dynamicTemplateData: emailObj,
        headers: {
          "X-Custom-Header": "Recipient 1",
        },
        customArgs: {
          myArg: "Recipient 1",
        },
      },
    ],
    from: { email: mailConfig.senderId },
    templateId: templates.DRAFT_LEASE_REMINDER_FOR_ADMIN,
  };
  sgMail
    .send(msg)
    .then(() => logger.info(`Email sent to ${to} draftLeaseReminderForAdmin`))
    .catch((err) => {
      logger.error(
        `Error in draftLeaseReminderForAdmin, ${JSON.stringify(err)}`
      );
    });
}

function leaseReminderInitiatedForUserCron(to, emailObj) {
  const msg = {
    personalizations: [
      {
        to,
        dynamicTemplateData: emailObj,
        headers: {
          "X-Custom-Header": "Recipient 1",
        },
        customArgs: {
          myArg: "Recipient 1",
        },
      },
    ],
    from: { email: mailConfig.senderId },
    templateId: templates.LEASE_REMINDER_INITIATED_FOR_USER_CRON,
  };
  sgMail
    .send(msg)
    .then(() =>
      logger.info(`Email sent to ${to} leaseReminderInitiatedForUserCron`)
    )
    .catch((err) => {
      logger.error(
        `Error in leaseReminderInitiatedForUserCron, ${JSON.stringify(err)}`
      );
    });
}

module.exports = {
  Email,
  singUpInitiatedForUser,
  singUpInitiatedForAdmin,
  singUpApprovedForUser,
  signupCompletedByAdminForUser,
  signupCompletedBypassForUser,
  requestCreatedForUser,
  requestCreatedForAdmin,
  requestStatusChangeForUser,
  requestStatusChangeForAdmin,
  requestCompletedForUser,
  requestCompletedForAdmin,
  renewalReminderForUser,
  renewalReminderForAdmin,
  leaseReminderInitiatedForUser,
  leaseReminderInitiatedForUserCron,
  draftLeaseReminderForAdmin,
};
