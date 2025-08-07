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

exports.createTenant = async (req, res) => {
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

    // Input validation
    if (!admin_user_email || !admin_user_password) {
      return res.status(400).json({
        success: false,
        code: 400,
        message: "Email and password are required",
      });
    }

    if (
      !contact_number ||
      contact_number.length > 12 ||
      contact_number.length < 4
    ) {
      return res.status(400).json({
        success: false,
        code: 400,
        message: "Contact number length should be between 4 and 12",
      });
    }

    // Check for existing property
    const existingProperty = await Property.findOne({
      where: { localityId, name: propertyName },
    });

    if (existingProperty) {
      return res.status(400).json({
        success: false,
        code: 400,
        message: "Property already exists with this locality and Property Name",
      });
    }

    // Check for existing tenant/admin
    const [existingTenant, admin_Already_Exist] = await Promise.all([
      Tenant.findOne({ where: { admin_user_email } }),
      Administrator.findOne({ where: { email: admin_user_email } }),
    ]);

    if (existingTenant || admin_Already_Exist) {
      return res.status(400).json({
        success: false,
        code: 400,
        message: "Tenant already exists",
      });
    }

    // Create property
    const createdProperty = await Property.create({
      localityId,
      name: propertyName,
    });

    // Create property features
    const propertyFeatureData = {
      propertyId: createdProperty.id,
      isSignupApprovalRequired: true,
    };

    await PropertyFeature.create(propertyFeatureData);

    const hashedPassword = await bcrypt.hash(admin_user_password, 10);

    // Create admin user
    const createdAdmin = await Administrator.create({
      name: tenant_name,
      email: admin_user_email,
      countryCode: "+1",
      mobileNumber: contact_number || "9999",
      profilePicture: "",
      role: "Admin",
      password: hashedPassword,
      propertyId: createdProperty.id,
    });

    // Create tenant
    const createdTenant = await Tenant.create({
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
      connected_admin_id: createdAdmin.id,
    });

    // Send welcome email
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
      <p>Best regards,<br>Your App Team</p>`;

    // await sendMail({ to: contact_email, subject, html });

    return res.status(201).json({
      success: true,
      code: 201,
      message: "Tenant created successfully",
      data: createdTenant,
    });
  } catch (err) {
    console.error("Error in createTenant:", err);

    // Handle specific error types
    if (
      err.name === "SequelizeValidationError" ||
      err.name === "SequelizeUniqueConstraintError"
    ) {
      return res.status(400).json({
        success: false,
        code: 400,
        message: "Validation error",
        errors: err.errors
          ? err.errors.map((e) => ({
              field: e.path,
              message: e.message,
              value: e.value,
            }))
          : [err.message],
      });
    }

    // For other errors
    return res.status(500).json({
      success: false,
      code: 500,
      message: "Internal server error",
      error:
        process.env.NODE_ENV === "development"
          ? err.message
          : "Something went wrong while creating tenant",
    });
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
