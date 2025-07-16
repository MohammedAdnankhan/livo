const { DataTypes } = require("sequelize");
const Notice = require("./Notice");
const User = require("../../user-service/models/User");

const db = require("../../database");

const ReadNotice = db.sequelize.define(
  "ReadNotice",
  {
    id: {
      type: DataTypes.UUID,
      allowNull: false,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    residentId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    noticeId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    ownerId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
  },
  {
    tableName: "read_notices",
    paranoid: true,
    defaultScope: {
      attributes: {
        exclude: ["createdAt", "updatedAt", "deletedAt"],
      },
    },
    indexes: [
      {
        name: "ownerIdAndNoticeIdIndex",
        fields: ["ownerId", "noticeId"],
        unique: true,
        where: {
          deletedAt: null,
        },
      },
      {
        name: "residentIdAndNoticeIdIndex",
        fields: ["residentId", "noticeId"],
        unique: true,
        where: {
          deletedAt: null,
        },
      },
    ],
  }
);

Notice.hasMany(ReadNotice, {
  as: "readBy",
  foreignKey: "noticeId",
});

ReadNotice.belongsTo(User, {
  // as: "resident",
  foreignKey: "residentId",
});

ReadNotice.belongsTo(Notice, {
  // as: "notice",
  foreignKey: "noticeId",
});

// ReadNotice.sync({ force: true });
// ReadNotice.sync({ alter: true });

module.exports = ReadNotice;
