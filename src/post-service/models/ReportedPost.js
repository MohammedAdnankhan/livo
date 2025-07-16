const { DataTypes } = require("sequelize");
const { REPORT_REASONS } = require("../../config/constants");
const db = require("../../database");
const User = require("../../user-service/models/User");
const { acceptedValues } = require("../../utils/modelValidators");
const Post = require("./Post");
const ReportedPost = db.sequelize.define(
  "ReportedPost",
  {
    id: {
      type: DataTypes.UUID,
      allowNull: false,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    postId: {
      type: DataTypes.UUID,
      allowNull: false,
      unique: "PostAndReportedByIndex",
    },
    reportedBy: {
      type: DataTypes.UUID,
      allowNull: false,
      unique: "PostAndReportedByIndex",
    },
    reason: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        ...acceptedValues(Object.keys(REPORT_REASONS), "Invalid Reason"),
      },
      defaultValue: REPORT_REASONS.INAPPROPRIATE_CONTENT,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    tableName: "reported_posts",
    paranoid: true,
  }
);

ReportedPost.belongsTo(User, {
  as: "userReported",
  foreignKey: "reportedBy",
});

ReportedPost.belongsTo(Post, {
  as: "post",
  foreignKey: "postId",
});

// ReportedPost.sync({ force: true });
// ReportedPost.sync({ alter: true });

module.exports = ReportedPost;
