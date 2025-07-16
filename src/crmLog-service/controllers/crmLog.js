const {
  getPropertyFeature,
} = require("../../property-service/controllers/property");
const { decrypt, encrypt } = require("../../utils/encryption");
const { AppError } = require("../../utils/errorHandler");
const logger = require("../../utils/logger");
const CrmLog = require("../models/CrmLog");
const axios = require("axios");
const { getBase64ImageFromS3Object } = require("./crmLog.utility");

async function createCrmLog(data) {
  return await CrmLog.create(data);
}

async function createCrmEntry(visitor, crmDetails, project, subProject) {
  try {
    const crmData = {
      First_Name: visitor.metaData.firstName,
      Last_Name: visitor.metaData.lastName,
      DocumentId: visitor.metaData.scannedDocumentId,
      ScannedSource: visitor.metaData.scannedSource,
      Alternate_Mobile: visitor.metaData.alternateMobileNumber
        ? visitor.metaData.alternateMobileNumber
        : null,
      Middle_Name: visitor.metaData.middleName
        ? visitor.metaData.middleName
        : null,
      Mobile: visitor.mobileNumber,
      Email: visitor.metaData.visitorEmail
        ? visitor.metaData.visitorEmail
        : null,
      Address: visitor.visitorAddress ? visitor.visitorAddress : null,
      City: visitor.city ? visitor.city : null,
      Country: visitor.country ? visitor.country : null,
      UAE_Resident: visitor.isUAEResident ? "True" : "False",
      Interested_In: visitor.interestedIn ? visitor.interestedIn : null,
      Purpose_Of_Purchase: visitor.purchasePurpose
        ? visitor.purchasePurpose
        : null,
      Remarks: visitor.remarks ? visitor.remarks : null,
      Birth_Date: visitor.metaData.visitorDateOfBirth,
      Source: visitor.source ? visitor.source : null,
      Agent_Name: visitor?.brokerDetails?.agentName
        ? visitor.brokerDetails.agentName
        : null,
      Agent_Id: visitor?.brokerDetails?.agentId
        ? visitor.brokerDetails.agentId
        : null,
      Company: visitor?.brokerDetails?.agentCompany
        ? visitor.brokerDetails.agentCompany
        : null,
      Sales_Advisor: visitor.salesAdvisor ? visitor.salesAdvisor : null,
      Project_Name: project,
      subProject_Name: subProject,
      uniqueId: visitor.passportNumber
        ? visitor.passportNumber
        : visitor.cardNumber
          ? visitor.cardNumber
          : visitor.documentId,
      Nationality: visitor.nationality ? visitor.nationality : null,
      Sobha_Connect_name: visitor.sobhaConnectName
        ? visitor.sobhaConnectName
        : null,
      Sobha_Connect_Id: visitor.sobhaConnectId ? visitor.sobhaConnectId : null,
      Sobha_Connect_companyName: visitor.sobhaConnectCompanyName
        ? visitor.sobhaConnectCompanyName
        : null,
      product_Type: visitor.productType ? visitor.productType : null,
      Budget: visitor.budget ? visitor.budget : null,
      possession_Timeline: visitor.possessionTimeLine
        ? visitor.possessionTimeLine
        : null,
      AlternateEmail: visitor.metaData.alternateEmailAddress
        ? visitor.metaData.alternateEmailAddress
        : null,
    };
    const Raw_Request_Body = {
      documentId: visitor.documentId,
      documentType: visitor.documentType,
      documentCountry: visitor.documentCountry,
      nameOnDocument: visitor.nameOnDocument,
      documentExpiry: visitor.documentExpiry,
      documentExpireMonth: visitor.documentExpireMonth,
      documentIssueState: visitor.documentIssueDate,
      numberOnDocument: visitor.numberOnDocument,
      gender: visitor.gender,
      email: visitor.email,
      occupation: visitor.occupation,
      dateOfBirth: visitor.dateOfBirth,
      passportNumber: visitor.passportNumber,
      documentIssueDate: visitor.documentIssueDate,
      age: visitor.age,
      docTypeDetail: visitor.docTypeDetail,
      licenseNumber: visitor.licenseNumber,
      address: visitor.address,
      licenseIssueAuthority: visitor.licenseIssueAuthority,
      cardNumber: visitor.cardNumber,
    };
    if (visitor["documentImage"]) {
      const image = await getBase64ImageFromS3Object(visitor["documentImage"]);
      crmData["FileContent"] = image;
    }
    crmData["Raw_Request_Body"] = JSON.stringify(Raw_Request_Body);

    const crmLogData = {
      propertyId: visitor.propertyId,
      payload: crmData,
      response: null,
    };
    crmLogData.response = await createSalesforceEntry(crmData, crmDetails);

    await createCrmLog(crmLogData);
  } catch (error) {
    logger.error(`Error in createCrmEntry: ${JSON.stringify(error)}`);
  }
}

async function createSalesforceEntry(visitor, config) {
  const reference = "createSalesforceEntry";
  const {
    grant_type,
    client_id,
    client_secret,
    username,
    password,
    authUrl,
    visitorRegistrationEndpoint,
  } = JSON.parse(decrypt(config));

  if (
    !grant_type ||
    !client_id ||
    !client_secret ||
    !username ||
    !password ||
    !authUrl ||
    !visitorRegistrationEndpoint
  ) {
    throw new AppError(reference, `CRM config not found`, "custom", 412, [
      {
        grant_type,
        client_id,
        client_secret,
        username,
        password,
        authUrl,
        visitorRegistrationEndpoint,
      },
    ]);
  }
  const authQueryParams = {
    grant_type,
    client_id,
    client_secret,
    username,
    password,
  };

  const authConfig = {
    method: "POST",
    url:
      authUrl +
      "?" +
      Object.entries(authQueryParams)
        .map(([key, value]) => `${key}=${value}&`)
        .join(""),
  };
  const authObj = await axios(authConfig)
    .then(({ data }) => data)
    .catch((err) => {
      return err.response.data;
    });

  if (authObj.error) {
    return authObj;
  }

  const {
    access_token,
    instance_url: visitorRegistrationUrl,
    id,
    token_type,
    issued_at,
    signature,
  } = authObj;

  const visitorEntryConfig = {
    method: "POST",
    url: visitorRegistrationUrl + visitorRegistrationEndpoint,
    headers: {
      Authorization: `${token_type} ${access_token}`,
    },
    data: [visitor],
  };

  return await axios(visitorEntryConfig)
    .then(({ data }) => {
      return data;
    })
    .catch((err) => {
      return err.response.data;
    });
}

async function getCrmAuth({ propertyId }) {
  const reference = "getCrmAuth";
  if (!propertyId) {
    throw new AppError(reference, "Property Id is required", "custom", 412);
  }
  const { isCrmPushRequired, crmDetails } = await getPropertyFeature(
    {
      propertyId,
    },
    "featureDetails"
  );
  if (!isCrmPushRequired) {
    throw new AppError(
      reference,
      "Un-authorized for CRM action",
      "custom",
      403
    );
  }
  const {
    grant_type,
    client_id,
    client_secret,
    username,
    password,
    authUrl,
    visitorRegistrationEndpoint,
    salesManagerEndpoint,
    brokerEndpoint,
    sobhaConnectEndpoint,
  } = JSON.parse(decrypt(crmDetails));

  const authQueryParams = {
    grant_type,
    client_id,
    client_secret,
    username,
    password,
  };

  const authConfig = {
    method: "POST",
    url:
      authUrl +
      "?" +
      Object.entries(authQueryParams)
        .map(([key, value]) => `${key}=${value}&`)
        .join(""),
  };
  const authObj = await axios(authConfig)
    .then(({ data }) => data)
    .catch((err) => {
      return err.response.data;
    });
  if (authObj.error) {
    return authObj;
  }
  return {
    tokenType: authObj.token_type,
    accessToken: authObj.access_token,
    instanceUrl: authObj.instance_url,
    visitorRegistrationEndpoint,
    salesManagerEndpoint,
    brokerEndpoint,
    sobhaConnectEndpoint,
  };
}

async function getSalesManagers({ propertyId }) {
  const reference = "getSalesManagers";
  const crmAuthObj = await getCrmAuth({ propertyId });

  if (!crmAuthObj.salesManagerEndpoint) {
    logger.warn(
      `Endpoint not found in getSalesManagers: ${JSON.stringify(crmAuthObj)}`
    );
    throw new AppError(reference, "Some error occurred", "custom", 422);
  }

  const { instanceUrl, accessToken, salesManagerEndpoint, tokenType } =
    crmAuthObj;

  const salesManagersConfig = {
    method: "GET",
    url: instanceUrl + salesManagerEndpoint,
    headers: {
      Authorization: `${tokenType} ${accessToken}`,
    },
  };

  const salesManagers = await axios(salesManagersConfig)
    .then(({ data }) => data)
    .catch((err) => {
      logger.warn(`Error in salesManager listing: ${JSON.stringify(err)}`);
      console.log(err);
      throw new AppError(reference, "Sales manager not found", "custom", 404);
    });

  const responseArr = [];
  if (Array.isArray(salesManagers)) {
    salesManagers.forEach((salesManager) => {
      responseArr.push({
        firstName: salesManager.FirstName,
        lastName: salesManager.LastName,
        email: salesManager.Email,
        mobileNumber: salesManager.MobilePhone,
        title: salesManager.Title,
      });
    });
  }
  return responseArr;
}

async function getBrokers({ propertyId }) {
  const reference = "getBrokers";
  const crmAuthObj = await getCrmAuth({ propertyId });

  if (!crmAuthObj.brokerEndpoint) {
    logger.warn(
      `Endpoint not found in getBrokers: ${JSON.stringify(crmAuthObj)}`
    );
    throw new AppError(reference, "An error occurred", "custom", 422);
  }

  const { instanceUrl, accessToken, brokerEndpoint, tokenType } = crmAuthObj;

  const brokersConfig = {
    method: "GET",
    url: instanceUrl + brokerEndpoint,
    headers: {
      Authorization: `${tokenType} ${accessToken}`,
    },
  };

  const brokers = await axios(brokersConfig)
    .then(({ data }) => data)
    .catch((err) => {
      logger.warn(`Error in brokers listing: ${JSON.stringify(err)}`);
      logger.warn(
        `Broker's listing err data: ${JSON.stringify(err.response.data)}`
      );
      console.log(err);
      return err.response.data;
    });

  return brokers.map((broker) => {
    return {
      name: broker.Name,
      mobileNumber: broker.Mobile_No__c,
      id: broker.Channel_Partner_Id__c || broker.ChannelPartner_Id__c,
      company: broker.Name,
    };
  });
}

async function getConnectBrokers({ propertyId }) {
  const reference = "getConnectBrokers";
  const crmAuthObj = await getCrmAuth({ propertyId });

  if (!crmAuthObj.sobhaConnectEndpoint) {
    logger.warn(
      `Connect Endpoint not found in getConnectBrokers: ${JSON.stringify(
        crmAuthObj
      )}`
    );
    throw new AppError(reference, "An error occurred", "custom", 422);
  }

  const { instanceUrl, accessToken, sobhaConnectEndpoint, tokenType } =
    crmAuthObj;

  const connectBrokersConfig = {
    method: "GET",
    url: instanceUrl + sobhaConnectEndpoint,
    headers: {
      Authorization: `${tokenType} ${accessToken}`,
    },
  };
  const connectBrokers = await axios(connectBrokersConfig)
    .then(({ data }) => data)
    .catch((err) => {
      logger.warn(`Error in connectBrokers listing: ${JSON.stringify(err)}`);
      logger.warn(
        `Connect Broker's listing err data: ${JSON.stringify(
          err.response.data
        )}`
      );
      console.log(err);
      // return err.response.data;
      throw err.response.data;
    });

  return connectBrokers.reduce((accumulator, broker) => {
    if (broker.Contact_Person__c) {
      accumulator.push({
        name: broker.Contact_Person__c,
        id: broker.SC_Id__c,
        company: broker.Name__c || broker.Name,
      });
    }
    return accumulator;
  }, []);
}

module.exports = {
  createCrmLog,
  createCrmEntry,
  getSalesManagers,
  getBrokers,
  getConnectBrokers,
};
