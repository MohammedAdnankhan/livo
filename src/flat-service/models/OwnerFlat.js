const { DataTypes } = require("sequelize");
const db = require("../../database");
const Flat = require("./Flat");
const MasterUser = require("../../masterUser-service/models/MasterUser");

const OwnerFlat = db.sequelize.define(
  "OwnerFlat",
  {
    id: {
      type: DataTypes.UUID,
      allowNull: false,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    masterUserId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    flatId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    removedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    removeReason: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    previousMasterUserId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
  },
  {
    tableName: "owner_flats",
    paranoid: true,
    defaultScope: {
      attributes: {
        exclude: ["createdAt", "updatedAt", "deletedAt"],
      },
    },
    indexes: [
      {
        unique: true,
        fields: ["masterUserId", "flatId"],
        where: {
          deletedAt: null,
        },
      },
    ],
  }
);

OwnerFlat.belongsTo(Flat, {
  foreignKey: "flatId",
  as: "flat",
  targetKey: "id",
});

OwnerFlat.belongsTo(MasterUser, {
  foreignKey: "masterUserId",
  as: "owner",
  targetKey: "id",
});

// OwnerFlat.sync({ force: true });
// OwnerFlat.sync({ alter: true });

module.exports = OwnerFlat;
