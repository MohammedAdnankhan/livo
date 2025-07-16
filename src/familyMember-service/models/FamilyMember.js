const { DataTypes } = require("sequelize");
const db = require("../../database");
const User = require("../../user-service/models/User");
const { isPhoneNumber } = require("../../utils/modelValidators");

const FamilyMember = db.sequelize.define(
  "FamilyMember",
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
    countryCode: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    mobileNumber: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: "mobileNumberAndResidentIdIndex",
      validate: {
        ...isPhoneNumber(),
      },
    },
    profilePicture: {
      type: DataTypes.STRING,
    },
    residentId: {
      type: DataTypes.UUID,
      allowNull: false,
      unique: "mobileNumberAndResidentIdIndex",
    },
  },
  {
    tableName: "family_members",
    paranoid: true,
    defaultScope: {
      attributes: {
        exclude: ["createdAt", "updatedAt", "deletedAt"],
      },
    },
  }
);

FamilyMember.belongsTo(User, {
  as: "resident",
  foreignKey: "residentId",
});

// FamilyMember.sync({ force: true });
// FamilyMember.sync({ alter: true });

module.exports = FamilyMember;
