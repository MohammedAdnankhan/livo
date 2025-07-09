const { DataTypes } = require("sequelize");
const db = require('../../db.js');

const ADMIN_ROLES = {
  ADMIN: "Admin",
  MASTER_ADMIN: "Master Admin",
};
const ADMIN_ACTION_TYPES = {
  NEW_REQUEST: {
    content_en: "%var% new request is raised",
    content_ar: "%var% new request is raised",
    key: "NEW_REQUEST",
  },
  DUE_REQUEST: {
    content_en: "%var% request is due",
    content_ar: "%var% request is due",
    key: "DUE_REQUEST",
  },
  DUE_LEASE: {
    content_en: "%var% lease is due",
    content_ar: "%var% lease is due",
    key: "DUE_LEASE",
  },
  BILL_PASSED_DUE_DATE: {
    content_en: "%var% bill passed it's due date",
    content_ar: "%var% bill passed it's due date",
    key: "BILL_PASSED_DUE_DATE",
  },
  NEW_LOGIN_REQUEST: {
    content_en: "%var% new login request",
    content_ar: "%var% new login request",
    key: "NEW_LOGIN_REQUEST",
  },
  SERVICE_REQUEST_OPEN_TO_ASSIGNEE: {
    content_en: "%var% service request status changed from open to assigned",
    content_ar: "%var% service request status changed from open to assigned",
    key: "SERVICE_REQUEST_OPEN_TO_ASSIGNEE",
  },
  SERVICE_REQUEST_OPEN_TO_INPROCESS: {
    content_en: "%var% service request status changed from open to in process",
    content_ar: "%var% service request status changed from open to in process",
    key: "SERVICE_REQUEST_OPEN_TO_INPROCESS",
  },
  SERVICE_REQUEST_INPROCESS_TO_COMPLETE: {
    content_en:
      "%var% service request status changed from in process to complete",
    content_ar:
      "%var% service request status changed from in process to complete",
    key: "SERVICE_REQUEST_INPROCESS_TO_COMPLETE",
  },
  SERVICE_REQUEST_COMPLETE_TO_REOPEN: {
    content_en: "%var% service request status changed from complete to reopen",
    content_ar: "%var% service request status changed from complete to reopen",
    key: "SERVICE_REQUEST_COMPLETE TO_REOPEN",
  },
  LEASE_RENEWAL_REQUEST: {
    content_en: "%var% new lease renewal request is raised",
    content_ar: "%var% new lease renewal request is raised",
    key: "LEASE_RENEWAL_REQUEST",
  },
};
function minLength(len) {
  return {
    len: {
      args: [len],
      msg: `Length should be more than ${len}`,
    },
  };
}
function isPhoneNumber() {
  return {
    isNumeric: true,
    len: {
      args: [4, 12],
      msg: `Invalid Mobile Number`,
    },
  };
}
function acceptedValues(valueArray, msg) {
  return {
    isIn: {
      args: [valueArray],
      msg,
    },
  };
}

const Administrator = db.sequelize.define(
  "Administrator",
  {
    id: {
      type: DataTypes.UUID,
      allowNull: false,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: {
        isEmail: {
          args: true,
          msg: "Please enter a valid Email.",
        },
      },
    },
    countryCode: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    mobileNumber: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: {
        ...isPhoneNumber(),
      },
    },
    profilePicture: {
      type: DataTypes.STRING,
    },
    role: {
      type: DataTypes.STRING,
      validate: {
        ...acceptedValues(Object.values(ADMIN_ROLES), "Invalid role type"),
      },
    },
    password: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        ...minLength(6),
      },
    },
    propertyId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    notificationEnabled: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: (function () {
        const notification = {};
        Object.keys(ADMIN_ACTION_TYPES).forEach((action) => {
          notification[action] = true;
        });
        return notification;
      })(),
    },
  },
  {
    tableName: "administrators",
    paranoid: true,
    defaultScope: {
      attributes: {
        exclude: ["password", "createdAt", "deletedAt", "updatedAt"],
      },
    },
  }
);

// Administrator.belongsTo(Property, {
//   as: "property",
//   foreignKey: "propertyId",
// });

// Administrator.sync({ force: true });
// Administrator.sync({ alter: true });

module.exports = Administrator;
