const { DataTypes } = require("sequelize");
const { GENDERS } = require("../../config/constants");
const db = require("../../database");
const Property = require("../../property-service/models/Property");
const {
  isPhoneNumber,
  acceptedValues,
} = require("../../utils/modelValidators");
const BankDetail = require("./BankDetail");
const City = require("../../city-service/models/City");

const MasterUser = db.sequelize.define(
  "MasterUser",
  {
    id: {
      type: DataTypes.UUID,
      allowNull: false,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      autoIncrement: true,
    },
    email: {
      type: DataTypes.STRING,
      allowNull: true,
      validate: {
        isEmail: {
          args: true,
          msg: "Please enter a valid Email.",
        },
      },
    },
    countryCode: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    mobileNumber: {
      type: DataTypes.STRING,
      allowNull: true,
      validate: {
        ...isPhoneNumber(),
      },
    },
    name: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    propertyId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    profilePicture: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    documents: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    nationality: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    documentType: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    documentId: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    gender: {
      type: DataTypes.STRING,
      allowNull: true,
      validate: {
        ...acceptedValues(Object.values(GENDERS), "Invalid Gender"),
      },
    },
    dateOfBirth: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    documentDetails: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    alternateContact: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    isCompany: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    // Fields related to company as a user
    companyId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    companyType: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    companyCityId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    companyCountry: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    licenseNumber: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    tradeLicense: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    companyPoc: {
      type: DataTypes.JSON,
      allowNull: true,
    },
  },
  {
    tableName: "master_users",
    paranoid: true,
    indexes: [
      {
        fields: ["email"],
        unique: true,
        where: {
          deletedAt: null,
        },
      },
      {
        fields: ["mobileNumber"],
        unique: true,
        where: {
          deletedAt: null,
        },
      },
    ],
    defaultScope: {
      attributes: {
        exclude: ["createdAt", "updatedAt", "deletedAt"],
      },
    },
    hooks: {
      afterDestroy: async function (instance, options) {
        await BankDetail.destroy({
          where: {
            masterUserId: instance.dataValues.id,
          },
        });
      },
    },
  }
);

MasterUser.belongsTo(Property, {
  foreignKey: "propertyId",
  as: "property",
});

MasterUser.belongsTo(City, {
  foreignKey: "companyCityId",
  as: "cities",
});

MasterUser.hasOne(BankDetail, {
  foreignKey: "masterUserId",
  as: "bankDetails",
});

// MasterUser.sync({ force: true });
// MasterUser.sync({ alter: true });

module.exports = MasterUser;
