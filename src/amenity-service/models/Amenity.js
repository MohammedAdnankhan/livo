const { DataTypes } = require("sequelize");
const db = require("../../database");
const { minLength } = require("../../utils/modelValidators");
const Amenity = db.sequelize.define(
  "Amenity",
  {
    id: {
      type: DataTypes.UUID,
      allowNull: false,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    propertyId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    isVisible: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        ...minLength(2),
      },
    },
    image: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    raisedFor: {
      type: DataTypes.STRING,
      allowNull: false,
    },
  },
  {
    tableName: "amenities",
    paranoid: true,
    defaultScope: {
      attributes: {
        exclude: ["updatedAt", "deletedAt", "propertyId"],
      },
    },
    indexes: [
      {
        unique: true,
        fields: ["name", "propertyId", "raisedFor"],
        where: {
          deletedAt: null,
        },
      },
    ],
  }
);

// Amenity.sync({ force: true });
// Amenity.sync({ alter: true });

module.exports = Amenity;
