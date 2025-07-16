const { DataTypes } = require("sequelize");
const Administrator = require("../../admin-service/models/Admin");
const { NOTICE_CATEGORIES } = require("../../config/constants");

const db = require("../../database");
const { acceptedValues } = require("../../utils/modelValidators");
const NoticeBuilding = require("./NoticeBuilding");

const Notice = db.sequelize.define(
  "Notice",
  {
    id: {
      type: DataTypes.UUID,
      allowNull: false,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    title: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: "titleAndCategoryIndex",
    },
    category: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: "titleAndCategoryIndex",
      validate: {
        ...acceptedValues(
          Object.values(NOTICE_CATEGORIES),
          "Invalid notice category"
        ),
      },
      defaultValue: NOTICE_CATEGORIES.EVENT,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    documents: {
      type: DataTypes.JSON,
    },
    postedBy: {
      type: DataTypes.UUID,
    },
    validFrom: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    validTill: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    actionRequired: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
      defaultValue: false,
    },
    actionDeadline: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    targetUser: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      allowNull: false,
      // validate: {
      //   ...acceptedValues(Object.values(NOTICE_TARGET), "Invalid target user")
      // },
      // defaultValue: Object.values(NOTICE_TARGET),
    },
  },
  {
    tableName: "notices",
    paranoid: true,
    defaultScope: {
      attributes: {
        exclude: ["updatedAt", "deletedAt"],
      },
    },
  }
);

Notice.hasMany(NoticeBuilding, {
  as: "noticeBuildings",
  foreignKey: "noticeId",
});

Notice.belongsTo(Administrator, {
  foreignKey: "postedBy",
  as: "admin",
});

// Notice.sync({ force: true });
// Notice.sync({ alter: true });

module.exports = Notice;
