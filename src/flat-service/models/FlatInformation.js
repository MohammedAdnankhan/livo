const { DataTypes } = require("sequelize");
const { CURRENCY, FLAT_FURNISHINGS } = require("../../config/constants");
const db = require("../../database");
const { acceptedValues } = require("../../utils/modelValidators");
const Flat = require("./Flat");

const FlatInformation = db.sequelize.define(
  "FlatInformation",
  {
    id: {
      type: DataTypes.UUID,
      allowNull: false,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    flatId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    bedroom: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    bathroom: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    furnishing: {
      type: DataTypes.STRING,
      allowNull: true,
      validate: {
        ...acceptedValues(
          Object.values(FLAT_FURNISHINGS),
          "Invalid furnishing type"
        ),
      },
    },
    primaryContact: {
      type: DataTypes.JSON,
      defaultValue: {
        name: null,
        mobileNumber: null,
        email: null,
      },
    },
    poaDetails: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    parkingLots: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    accessCards: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    leaseType: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    rentalType: {
      type: DataTypes.STRING,
      allowNull: true,
    },
  },
  {
    tableName: "flat_informations",
    paranoid: true,
    indexes: [
      {
        fields: ["flatId"],
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
  }
);

FlatInformation.belongsTo(Flat, {
  foreignKey: "flatId",
  as: "flat",
});

Flat.hasOne(FlatInformation, {
  foreignKey: "flatId",
  as: "flatInfo",
});

// FlatInformation.sync({ alter: true });

module.exports = FlatInformation;
