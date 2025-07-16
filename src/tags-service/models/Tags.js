const { DataTypes } = require("sequelize");
const db = require("../../database");
const { minLength } = require("../../utils/modelValidators");

const Tags = db.sequelize.define(
  "Tags",
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
      validate: {
        ...minLength(2),
      },
    },
    propertyId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
  },
  {
    tableName: "tags",
    paranoid: true,
    defaultScope: {
      attributes: {
        exclude: ["createdAt", "updatedAt", "deletedAt"],
      },
    },
  }
);

// Tags.sync({ force: true });

module.exports = Tags;
