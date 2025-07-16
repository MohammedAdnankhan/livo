const { DataTypes } = require("sequelize");
const db = require("../../database");
const Locality = require("../../locality-service/models/Locality");
const { minLength } = require("../../utils/modelValidators");
const PropertyFeature = require("./PropertyFeature");

const Property = db.sequelize.define(
  "Property",
  {
    id: {
      type: DataTypes.UUID,
      allowNull: false,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV1,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: "PropertyAndLocalityIdIndex",
      validate: {
        ...minLength(2),
      },
    },
    localityId: {
      type: DataTypes.UUID,
      allowNull: false,
      unique: "PropertyAndLocalityIdIndex",
    },
  },
  {
    tableName: "properties",
    paranoid: true,
    defaultScope: {
      attributes: {
        exclude: ["createdAt", "updatedAt", "deletedAt"],
      },
    },
  }
);

Property.belongsTo(Locality, {
  foreignKey: "localityId",
  as: "locality",
});

Property.hasOne(PropertyFeature, {
  foreignKey: "propertyId",
  as: "propertyFeature",
});

// Property.sync({ force: true });
// Property.sync({ alter: true });

module.exports = Property;
