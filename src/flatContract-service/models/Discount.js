const { DataTypes } = require("sequelize");
const { DISCOUNT_APPLICABILITY } = require("../../config/constants");
const db = require("../../database");
const { acceptedValues } = require("../../utils/modelValidators");

const Discount = db.sequelize.define(
  "Discount",
  {
    id: {
      type: DataTypes.UUID,
      allowNull: false,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    contractId: {
      type: DataTypes.UUID,
      allowNull: false,
      unique: true,
    },
    amount: {
      type: DataTypes.FLOAT,
      allowNull: true,
    },
    grace: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    applicableOn: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        ...acceptedValues(
          Object.values(DISCOUNT_APPLICABILITY),
          "Invalid Input Value"
        ),
      },
    },
    period: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
  },
  {
    tableName: "discounts",
    paranoid: true,
    defaultScope: {
      attributes: {
        exclude: ["updatedAt", "deletedAt"],
      },
    },
  }
);

module.exports = Discount;
