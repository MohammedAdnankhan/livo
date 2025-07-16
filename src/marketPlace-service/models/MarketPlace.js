const { DataTypes } = require("sequelize");
const db = require("../../database");
const {
  minLength,
  acceptedValues,
  maxLength,
  isPhoneNumber,
} = require("../../utils/modelValidators");
const {
  TARGET_AUDIENCE,
  CURRENCY,
  ITEM_CONDITIONS,
  ITEM_CATEGORIES,
} = require("../../config/constants");
const User = require("../../user-service/models/User");

const MarketPlace = db.sequelize.define(
  "MarketPlace",
  {
    id: {
      type: DataTypes.UUID,
      allowNull: false,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    category: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        ...acceptedValues(
          Object.keys(ITEM_CATEGORIES),
          "Invalid item category"
        ),
      },
    },
    condition: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        ...acceptedValues(
          Object.keys(ITEM_CONDITIONS),
          "Invalid item condition"
        ),
      },
    },
    title: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        ...minLength(3),
      },
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
      validate: {
        ...maxLength(100),
      },
    },
    age: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    contactNumber: {
      type: DataTypes.STRING,
      allowNull: true,
      validate: {
        ...isPhoneNumber(),
      },
    },
    images: {
      type: DataTypes.JSON,
      allowNull: false,
    },
    currency: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "aed",
      validate: {
        ...acceptedValues(Object.values(CURRENCY), "Invalid currency"),
      },
    },
    price: {
      type: DataTypes.FLOAT,
      allowNull: false,
    },
    targetAudience: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        ...acceptedValues(
          Object.values(TARGET_AUDIENCE),
          "Invalid target audience"
        ),
      },
    },
    targetId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    createdBy: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    link: {
      type: DataTypes.STRING,
      allowNull: true,
    },
  },
  {
    tableName: "market_places",
    paranoid: true,
  }
);

MarketPlace.belongsTo(User, {
  as: "user",
  foreignKey: "createdBy",
});

User.hasMany(MarketPlace, {
  as: "createdBy",
  foreignKey: "createdBy",
});

// MarketPlace.sync({ force: true });
// MarketPlace.sync({ alter: true });

module.exports = MarketPlace;
