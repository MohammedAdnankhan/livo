const { Op } = require("sequelize");
const { AppError } = require("../../utils/errorHandler");
const MasterUser = require("../models/MasterUser");
const { getMasterUser } = require("./masterUser");
const BankDetail = require("../models/BankDetail");
const { getFlatCount } = require("../../flat-service/controllers/flat");
const { isObjEmpty } = require("../../utils/utility");
const db = require("../../database");
const Flat = require("../../flat-service/models/Flat");
const Building = require("../../building-service/models/Building");
const {
  getLeaseWithLatestStatus,
} = require("../../lease-service/controllers/lease");
const { LEASE_STATUSES } = require("../../config/constants");
const City = require("../../city-service/models/City");

/**
 * @async
 * @function getCompaniesDropDown
 * @param {string} propertyId
 * @description Function to show companies in dropdowns
 * @returns {Promise<{id: string, name: string}[]>}
 */
exports.getCompaniesDropDown = async (propertyId) => {
  return await MasterUser.findAll({
    where: {
      isCompany: true,
      propertyId,
    },
    attributes: ["id", "name"],
    order: [["name", "ASC"]],
  });
};

/**
 * @async
 * @function getCompanyById
 * @param {Object} params
 * @param {string} params.companyId
 * @param {string} params.propertyId
 * @description Function to get company(Master User as company) by Id
 * @returns {Promise<Object>}
 */
exports.getCompanyById = async (params) => {
  const reference = "getCompanyById";
  const attributes = [
    "id",
    "userId",
    "email",
    "countryCode",
    "mobileNumber",
    "name",
    "profilePicture",
    "documents",
    "alternateContact",
    "companyType",
    "licenseNumber",
    "tradeLicense",
    "companyPoc",
  ];

  const companyLeasesQuery = `
    SELECT l.id, ls.status, f.name_en AS "flat.name_en", f."flatType" AS "flat.flatType",
    b.name_en AS "flat.building.name_en", b.address_en AS "flat.building.address_en" FROM leases l
    JOIN (
      SELECT DISTINCT ON("leaseId") "leaseId", status FROM lease_statuses WHERE "deletedAt" IS NULL
      ORDER BY "leaseId", "createdAt" DESC
    ) ls ON (ls."leaseId" = l.id)
    JOIN flats f ON (f.id = l."flatId" AND f."deletedAt" IS NULL)
    JOIN buildings b ON (b.id = f."buildingId" AND b."deletedAt" IS NULL)
    WHERE l."masterUserId" = :muId AND l."deletedAt" IS NULL ORDER BY l."createdAt" DESC`;

  const companyLeasesQueryConfig = {
    type: db.Sequelize.QueryTypes.SELECT,
    raw: true,
    nest: true,
    replacements: {
      muId: params.companyId,
    },
  };

  const [company, leases] = await Promise.all([
    MasterUser.findOne({
      where: {
        isCompany: true,
        id: params.companyId,
        propertyId: params.propertyId,
      },
      attributes,
      include: [
        {
          model: BankDetail,
          as: "bankDetails",
          required: true,
          attributes: [
            "accountNumber",
            "accountHolderName",
            "bankName",
            "swiftCode",
            "iban",
          ],
        },
        {
          model: Flat,
          as: "ownedFlats",
          attributes: ["name_en", "flatType"],
          required: false,
          include: [
            {
              model: Building,
              as: "building",
              required: false,
              attributes: ["name_en", "address_en"],
            },
          ],
        },
      ],
    }),
    db.sequelize.query(companyLeasesQuery, companyLeasesQueryConfig),
  ]);

  if (!company) {
    throw new AppError(reference, "Company not found", "custom", 404);
  }

  company.setDataValue("leases", leases);
  return company;
};

/**
 * @async
 * @function deleteCompanyById
 * @param {Object} params
 * @param {string} params.companyId
 * @param {string} params.propertyId
 * @description Function to delete company(Master User as company) by Id
 * @returns {Promise<null>}
 */
exports.deleteCompanyById = async (params) => {
  const company = await MasterUser.findOne({
    where: {
      isCompany: true,
      id: params.companyId,
      propertyId: params.propertyId,
    },
    attributes: ["id"],
  });

  if (!company) {
    throw new AppError(reference, "Company not found", "custom", 404);
  }
  await company.destroy();
  return null;
};

/**
 * @async
 * @function updateCompany
 * @param {Object} params
 * @param {string} params.companyId
 * @param {string} params.propertyId
 * @param {import("../types").IUpdateCompany} companyData
 * @description Function to update details of a company
 * @returns {Promise<null>}
 */
exports.updateCompany = async (params, companyData) => {
  const reference = "updateCompany";
  const [company, ownedFlatsCount, lease] = await Promise.all([
    MasterUser.findOne({
      where: {
        isCompany: true,
        id: params.companyId,
        propertyId: params.propertyId,
      },
      include: [
        {
          model: BankDetail,
          as: "bankDetails",
          required: true,
        },
      ],
    }),
    getFlatCount({ ownerId: params.companyId }),
    getLeaseWithLatestStatus({ masterUserId: params.companyId }),
  ]);

  if (!company) {
    throw new AppError(reference, "Company not found", "custom", 404);
  }

  const { bankDetails, companyPoc, alternateContact, ...data } = companyData;

  if (
    (lease && lease["statuses"][0]["status"] === LEASE_STATUSES.ACTIVE) ||
    ownedFlatsCount
  ) {
    if (data.name && data.name !== company.name) {
      throw new AppError(
        reference,
        "Cannot edit name during ongoing lease or an active owner",
        "custom",
        412
      );
    }
    if (data.email && data.email !== company.email) {
      throw new AppError(
        reference,
        "Cannot edit email during ongoing lease or an active owner",
        "custom",
        412
      );
    }

    if (data.mobileNumber && data.mobileNumber !== company.mobileNumber) {
      throw new AppError(
        reference,
        "Cannot edit Mobile Number during ongoing lease or an active owner",
        "custom",
        412
      );
    }
  }

  if (
    data.email &&
    (await getMasterUser({ email: data.email, id: { [Op.ne]: company.id } }))
  ) {
    throw new AppError(reference, "Email already exists", "custom", 412);
  }

  if (
    data.mobileNumber &&
    (await getMasterUser({
      mobileNumber: data.mobileNumber,
      id: { [Op.ne]: company.id },
    }))
  ) {
    throw new AppError(
      reference,
      "Mobile Number already exists",
      "custom",
      412
    );
  }

  if (!isObjEmpty(alternateContact)) {
    for (const key in alternateContact) {
      company["alternateContact"][key] = alternateContact[key];
    }
    company.changed("alternateContact", true);
  }

  if (!isObjEmpty(companyPoc)) {
    for (const key in companyPoc) {
      company["companyPoc"][key] = companyPoc[key];
    }
    company.changed("companyPoc", true);
  }

  for (const key in data) {
    company[key] = data[key];
  }

  if (!isObjEmpty(bankDetails)) {
    for (const key in bankDetails) {
      company["bankDetails"][key] = bankDetails[key];
    }
  }

  await Promise.all([company.save(), company.bankDetails.save()]);
  return null;
};

/**
 * @async
 * @function getCompanies
 * @param {Object} params
 * @param {string} params.propertyId
 * @param {string | undefined} params.search
 * @param {Object} pagination
 * @param {number} pagination.offset
 * @param {number} pagination.limit
 * @returns {Promise<{count: number, rows: Object[]}>}
 * @description Function to list paginated companies
 */
exports.getCompanies = async (params, { offset, limit }) => {
  const attributes = [
    "id",
    "userId",
    "countryCode",
    "mobileNumber",
    "name",
    "companyType",
    "licenseNumber",
    "tradeLicense",
    "companyCountry",
  ];

  const companyParams = {
    isCompany: true,
    propertyId: params.propertyId,
  };

  if (params.search) {
    companyParams[Op.or] = [
      db.sequelize.where(
        db.sequelize.cast(db.sequelize.col("MasterUser.userId"), "VARCHAR"),
        { [Op.iLike]: `%${params.search}%` }
      ),
      { name: { [Op.iLike]: `%${params.search}%` } },
      { mobileNumber: { [Op.iLike]: `%${params.search}%` } },
      { companyType: { [Op.iLike]: `%${params.search}%` } },
      { tradeLicense: { [Op.iLike]: `%${params.search}%` } },
    ];
  }

  if (params.companyType) {
    companyParams.companyType = params.companyType;
  }

  if (params.companyCityId) {
    companyParams.companyCityId = params.companyCityId;
  }

  if (params.companyCountry) {
    companyParams.companyCountry = params.companyCountry;
  }

  return await MasterUser.findAndCountAll({
    where: companyParams,
    attributes,
    order: [["updatedAt", "DESC"]],
    include: [
      {
        model: City,
        as: "cities",
        attributes: ["name_en"],
        required: false,
      },
    ],
    offset,
    limit,
  });
};

/**
 * @async
 * @function getCompaniesExport
 * @param {Object} params
 * @param {string} params.propertyId
 * @param {string | undefined} params.search
 * @param {string | undefined} params.companyType
 * @param {Object} pagination
 * @param {number} pagination.offset
 * @param {number} pagination.limit
 * @returns {rows: Object[]}>}
 * @description Function to list paginated companies
 */
exports.getCompaniesExport = async (params, { offset, limit }) => {
  const attributes = [
    "id",
    "userId",
    "countryCode",
    "mobileNumber",
    "name",
    "companyType",
    "licenseNumber",
    "tradeLicense",
    "companyCountry",
  ];

  const companyParams = {
    isCompany: true,
    propertyId: params.propertyId,
  };

  if (params.search) {
    companyParams[Op.or] = [
      db.sequelize.where(
        db.sequelize.cast(db.sequelize.col("MasterUser.userId"), "VARCHAR"),
        { [Op.iLike]: `%${params.search}%` }
      ),
      { name: { [Op.iLike]: `%${params.search}%` } },
      { mobileNumber: { [Op.iLike]: `%${params.search}%` } },
      { companyType: { [Op.iLike]: `%${params.search}%` } },
      { tradeLicense: { [Op.iLike]: `%${params.search}%` } },
    ];
  }

  if (params.companyType) {
    companyParams.companyType = params.companyType;
  }

  if (params.companyCityId) {
    companyParams.companyCityId = params.companyCityId;
  }

  if (params.companyCountry) {
    companyParams.companyCountry = params.companyCountry;
  }

  return await MasterUser.findAll({
    where: companyParams,
    attributes,
    include: [
      {
        model: City,
        as: "cities",
        attributes: ["name_en"],
        required: false,
      },
    ],
    order: [["updatedAt", "DESC"]],
    offset,
    limit,
  });
};
