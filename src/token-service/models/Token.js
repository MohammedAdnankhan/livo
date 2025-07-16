const { DataTypes } = require("sequelize");
const db = require("../../database");

const Token = db.sequelize.define(
  "Token",
  {
    id: {
      type: DataTypes.UUID,
      allowNull: false,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    token: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    guardId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    staffId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    adminId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    ownerId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
  },
  {
    tableName: "tokens",
    paranoid: true,
    defaultScope: {
      attributes: {
        exclude: ["createdAt", "updatedAt", "deletedAt"],
      },
    },
  }
);
// Token.sync({ alter: true });

module.exports = Token;
