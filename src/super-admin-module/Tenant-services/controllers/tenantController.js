const Tenant = require("../models/tenant.js");
const bcrypt = require("bcryptjs");
const sendMail = require("../../Utils/sendMail");
const Log = require("../../logs-service/models/log");
const Administrator = require("../../../admin-service/models/Admin.js");
const jwt = require("jsonwebtoken");
// const SECRET = process.env.JWT_SECRET || 'supersecret';
const TenantUser = require("../models/tenant_user.js"); // Added TenantUser import
const {
  generateRefreshToken,
  generateAccessToken,
  generate_Access_Token_Super_Admin,
} = require("../../../utils/generateToken.js");
const { Op } = require("sequelize");
const {
  TOKEN_EXPIRY_TIMES,
  USER_TYPES,
} = require("../../../config/constants.js");
const {
  createProperty,
} = require("../../../property-service/controllers/property.js");
const Property = require("../../../property-service/models/Property.js");
const PropertyFeature = require("../../../property-service/models/PropertyFeature.js");
const {
  createTokenEntity,
} = require("../../../token-service/controllers/token.js");
const env = process.env.NODE_ENV || "development";
const ACCESS_KEY = require("../../../config/jwt.json")[env]?.secret_key;
// const Role = require('../../permission-service/models/roles');
// const Page = require('../../permission-service/models/pages');
// const Permission = require('../models/permissions');

exports.createTenant = async (req, res, next) => {
  req.logMeta = { entity: "Tenant", entity_id: null, action: "create" };
  try {
    const {
      tenant_name,
      localityId,
      propertyName,
      admin_user_email,
      admin_user_password,
      contact_email,
      contact_number,
      industry,
      modules,
      status,
      notes,
      user_add_limit,
    } = req.body;
    // Check if tenant with same email already exists
    if (!admin_user_email || !admin_user_password) {
      return res.status(400).json({
        success: false,
        code: 400,
        message: "email and password are required",
      });
    }
    let data = { localityId, name: propertyName };

    const property = await Property.create({ localityId, name: propertyName });

    const propertyFeatureData = {
      propertyId: property.id,
      isSignupApprovalRequired:
        "isSignupApprovalRequired" in data &&
        typeof data.isSignupApprovalRequired === "boolean"
          ? data.isSignupApprovalRequired
          : true,
    };

    if (!propertyFeatureData.isSignupApprovalRequired) {
      propertyFeatureData.approvalDetails = {
        approvalDuration:
          "approvalDuration" in data && !isNaN(data.approvalDuration)
            ? data.approvalDuration
            : 1,
        flatUsage: data.flatUsage ? data.flatUsage : FLAT_USAGE.RESIDENTIAL,
        securityDeposit:
          "securityDeposit" in data && !isNaN(data.securityDeposit)
            ? data.securityDeposit
            : 0,
        activationFee:
          "activationFee" in data && !isNaN(data.activationFee)
            ? data.activationFee
            : 0,
        paymentFrequency: data.paymentFrequency
          ? data.paymentFrequency
          : PAYMENT_FREQUENCIES.YEARLY,
        paymentMode: data.paymentMode ? data.paymentMode : "Cash",
        currency: data.currency ? data.currency : "AED",
        noticePeriod:
          "noticePeriod" in data && !isNaN(data.noticePeriod)
            ? data.noticePeriod
            : 0,
        rentAmount:
          "rentAmount" in data && !isNaN(data.noticePeriod)
            ? data.rentAmount
            : 0,
      };
    }
    await PropertyFeature.create(propertyFeatureData);

    let tenant = await Tenant.findOne({ where: { admin_user_email } });
    let admin_Already_Exist = await Administrator.findOne({
      where: { email: admin_user_email },
    });
    if (tenant || admin_Already_Exist) {
      res
        .status(400)
        .json({ success: false, code: 400, message: "Tenant already exists" });
      return next();
    }
    const hashedPassword = await bcrypt.hash(admin_user_password, 10);

    // Create the Administrator for this tenant
    let admin_just_created = await Administrator.create({
      name: tenant_name,
      email: admin_user_email,
      countryCode: "+1", // Default country code
      mobileNumber: contact_number || "9999", // fallback to a valid dummy number
      profilePicture: "",
      role: "Admin",
      password: hashedPassword,
      propertyId: property.id || null, // or set if you have a propertyId
    });

    tenant = await Tenant.create({
      tenant_name,
      admin_user_email,
      admin_user_password: hashedPassword,
      contact_email,
      contact_number,
      industry,
      modules,
      status,
      notes,
      user_add_limit,
      connected_admin_id: admin_just_created.id,
    });
    console.log(admin_just_created, "Tenant created");

    await tenant.save();
    // Send welcome email to admin
    const subject = "Welcome to Our Platform!";
    const html = `
      <h2>Welcome, ${tenant_name} Admin!</h2>
      <p>Your tenant account has been created. Here are your login details:</p>
      <ul>
        <li><strong>Email:</strong> ${admin_user_email}</li>
        <li><strong>Password:</strong> ${admin_user_password}</li>
      </ul>
      <p>Please log in and change your password after your first login.</p>
      <br>
      <p>Best regards,<br>Your App Team</p>
    `;
    // await sendMail({ to: contact_email, subject, html });

    req.logMeta = {
      entity: "Tenant",
      entity_id: tenant.tenant_id,
      action: "create",
    };
    res.status(201).json({
      success: true,
      code: 201,
      message: "Tenant created",
      data: tenant,
    });
    return next();
  } catch (err) {
    req.logMeta = { entity: "Tenant", entity_id: null, action: "create" };
    console.error("Error creating tenant:", err);

    // Handle validation errors
    if (
      err.name === "SequelizeValidationError" ||
      err.name === "SequelizeUniqueConstraintError"
    ) {
      const errors = err.errors.map((e) => ({
        field: e.path,
        message: e.message,
        value: e.value,
      }));

      return res.status(400).json({
        success: false,
        code: 400,
        message: "Validation error",
        errors: errors,
      });
    }

    // For other types of errors
    res.status(500).json({
      success: false,
      code: 500,
      message: "Internal server error",
      error:
        process.env.NODE_ENV === "development"
          ? err.message
          : "Something went wrong",
    });
    return next();
  }
};

exports.getAllTenants = async (req, res, next) => {
  try {
    const tenants = await Tenant.findAll({ order: [["createdAt", "DESC"]] });

    return res.status(200).json({
      success: true,
      code: 200,
      message: "Tenants fetched",
      data: tenants,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      code: 500,
      message: "Internal server error",
      error: err.message,
    });
  }
};

exports.getTenantById = async (req, res, next) => {
  try {
    const { tenant_id } = req.params;
    const tenant = await Tenant.findByPk(tenant_id);
    const tenant_by_admin_id = await Tenant.findOne({
      where: {
        connected_admin_id: tenant_id,
      },
    });
    if (!tenant && !tenant_by_admin_id) {
      return res
        .status(404)
        .json({ success: false, code: 404, message: "Tenant not found" });
    }
    return res.status(200).json({
      success: true,
      code: 200,
      message: "Tenant fetched",
      data: tenant || tenant_by_admin_id,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      code: 500,
      message: "Internal server error",
      error: err.message,
    });
  }
};

exports.updateTenant = async (req, res, next) => {
  try {
    const { tenant_id, id } = req.params;

    // Only allow updatable fields (removed admin_user_password)
    const allowedFields = [
      "tenant_name",
      "admin_user_email",
      "contact_email",
      "contact_number",
      "industry",
      "modules",
      "status",
      "notes",
      "user_add_limit",
    ];

    const updateData = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updateData[field] = req.body[field];
      }
    }

    const [updated] = await Tenant.update(updateData, {
      where: { connected_admin_id: tenant_id || id },
    });

    if (!updated) {
      return res.status(404).json({
        success: false,
        code: 404,
        message: "Tenant not found",
      });
    }

    const tenant = await Tenant.findByPk(tenant_id);

    return res.status(200).json({
      success: true,
      code: 200,
      message: "Tenant updated",
      data: tenant,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      code: 500,
      message: "Internal server error",
      error: err.message,
    });
  }
};

exports.deleteTenant = async (req, res, next) => {
  try {
    const { tenant_id } = req.params;
    const deleted = await Tenant.destroy({ where: { tenant_id } });
    if (!deleted) {
      return res
        .status(404)
        .json({ success: false, code: 404, message: "Tenant not found" });
    }
    return res.status(200).json({
      success: true,
      code: 200,
      message: "Tenant deleted successfully",
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      code: 500,
      message: "Internal server error",
      error: err.message,
    });
  }
};

exports.getTenantOverview = async (req, res) => {
  try {
    const totalTenants = await Tenant.count();
    const activeTenants = await Tenant.count({ where: { status: "Active" } });
    const inactiveTenants = await Tenant.count({
      where: { status: "Inactive" },
    });
    return res.status(200).json({
      success: true,
      code: 200,
      message: "Tenant overview fetched",
      data: {
        totalTenants,
        activeTenants,
        inactiveTenants,
      },
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      code: 500,
      message: "Error fetching tenant overview",
      error: err.message,
    });
  }
};

exports.tenantLogin = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        code: 400,
        message: "Email and password are required",
      });
    }

    // 1. First, try to find in Administrator table (Super Admin)
    let findAdmin = await Administrator.scope(null).findOne({
      where: {
        [Op.or]: [{ email: email }, { mobileNumber: email }],
      },
    });

    if (findAdmin) {
      const checkPassword = await bcrypt.compare(password, findAdmin.password);
      if (!checkPassword) {
        return res.status(401).json({
          success: false,
          code: 401,
          message: "Invalid credentials",
        });
      }

      // Static sidebar data for Administrator
      const sidebarData = [
        "My Properties",
        "Services",
        "Lease Management",
        "Visitor Management",
        "Guard Management",
        "Notices",
        "Helpline",
        "Configuration",
        "Dashboard",
        "Invoice Management",
      ];
      let tenant = await Tenant.findOne({
        where: { connected_admin_id: findAdmin.id },
      });

      // Generate tokens for Administrator
      const [refreshToken, accessToken] = await Promise.all([
        generateRefreshToken(findAdmin.id, USER_TYPES.ADMIN),
        generateAccessToken(findAdmin.id, USER_TYPES.ADMIN),
      ]);

      await createTokenEntity({ token: refreshToken, adminId: findAdmin.id });

      const adminType = Buffer.from(findAdmin.role).toString("base64");
      const modules = tenant.modules || {};
      let tenant_sidebarData = [];
      if (tenant) {
        tenant_sidebarData = Object.keys(modules).filter(
          (key) => modules[key] && modules[key].can_view
        );
      }
      return res.status(200).json({
        accessToken,
        refreshToken,
        a_t: adminType,
        sidebarData,
        admin: findAdmin,
        tenant_sidebarData,
        success: true,
        data: {
          accessToken,
          refreshToken,
          a_t: adminType,
          tenant: {
            ...findAdmin.dataValues,
            tenant_id: findAdmin.id,
            modules: {
              fm: {
                can_view: true,
              },
              leasing: {
                can_view: true,
              },
              guard_management: {
                can_view: true,
              },
              visitor_management: {
                can_view: true,
              },
            },
          },
        },
        code: 200,
      });
    }
    // 1. Try to find in tenant table first
    // let tenant = await Tenant.findOne({ where: { admin_user_email: email } });
    // if (tenant) {
    //   // Compare password with tenant.admin_user_password
    //   const isMatch = await bcrypt.compare(
    //     password,
    //     tenant.admin_user_password
    //   );
    //   if (!isMatch) {
    //     return res
    //       .status(401)
    //       .json({ success: false, code: 401, message: "Invalid credentials" });
    //   }
    //   // sidebarData: keys of modules with can_view true
    //   const modules = tenant.modules || {};
    //   const sidebarData = Object.keys(modules).filter(
    //     (key) => modules[key] && modules[key].can_view
    //   );
    //   // Generate JWT access token
    //   // const accessToken = jwt.sign({ email, type: 'admin', tenant_id: tenant.tenant_id }, SECRET, { expiresIn: '1h' });
    //   //      const accessToken = await generate_Access_Token_Super_Admin({ email, type: 'admin', id:tenant.tenant_id,tenant_id: tenant.tenant_id },
    //   //   ACCESS_KEY,
    //   //   TOKEN_EXPIRY_TIMES[env].REFRESH_TOKEN_EXPIRY_TIME
    //   // );
    //   const [
    //     refreshToken,
    //     accessToken,
    //     // sidebarData
    //   ] = await Promise.all([
    //     generateRefreshToken(tenant.tenant_id, USER_TYPES.ADMIN),
    //     generateAccessToken(tenant.tenant_id, USER_TYPES.ADMIN),
    //     // getSideBarData(findAdmin.propertyId),
    //   ]);
    //   // const refreshToken = '';
    //   const a_t = "admin";
    //   const adminType = Buffer.from("admin").toString("base64");

    //   return res.status(200).json({
    //     accessToken,
    //     refreshToken,
    //     a_t,
    //     sidebarData,
    //     tenant,
    //     success: true,
    //     code: 200,
    //     status: "sucess",
    //     data: {
    //       accessToken,
    //       refreshToken,
    //       a_t: adminType,
    //       sidebarData,
    //     },
    //   });
    // }
    // 2. If not found in tenant, check TenantUser table for user login
    const user = await TenantUser.findOne({
      where: { email },
      attributes: { include: ["password"] },
    });
    if (user) {
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res
          .status(401)
          .json({ success: false, code: 401, message: "Invalid credentials" });
      }

      // let tenant = await Tenant.findByPk(user.tenant_id);
      // No sidebarData logic, just return a_t: 'tenant_user'
      // const accessToken = jwt.sign({ id: user.user_id, email: user.email, type: 'tenant_user', tenant_id: user.tenant_id }, SECRET, { expiresIn: '1h' });
      // const accessToken = await generate_Access_Token_Super_Admin(
      //   {
      //     id: user.user_id,
      //     email: user.email,
      //     type: "tenant_user",
      //     tenant_id: user.tenant_id,
      //   },
      //   ACCESS_KEY,
      //   TOKEN_EXPIRY_TIMES[env].REFRESH_TOKEN_EXPIRY_TIME
      // );

      const [refreshToken, accessToken] = await Promise.all([
        generateRefreshToken(user.tenant_id, USER_TYPES.ADMIN),
        generateAccessToken(user.tenant_id, USER_TYPES.ADMIN),
      ]);
      const a_t = "tenant_user";
      return res.status(200).json({
        accessToken,
        refreshToken,
        a_t,
        user,
        success: true,
        code: 200,
      });
    }
    return res
      .status(401)
      .json({ success: false, code: 401, message: "Invalid credentials" });
  } catch (err) {
    return res.status(500).json({
      success: false,
      code: 500,
      message: "Internal server error",
      error: err.message,
    });
  }
};

exports.tenantLogout = async (req, res, next) => {
  // JWT is stateless; just respond success
  return res
    .status(200)
    .json({ success: true, code: 200, message: "Logged out" });
};
