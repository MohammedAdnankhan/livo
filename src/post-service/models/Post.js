const { DataTypes } = require("sequelize");
const db = require("../../database");
const { TARGET_AUDIENCE } = require("../../config/constants");
const User = require("../../user-service/models/User");
const Post = db.sequelize.define(
  "Post",
  {
    id: {
      type: DataTypes.UUID,
      allowNull: false,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    content: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    targetAudience: {
      type: DataTypes.ENUM(Object.values(TARGET_AUDIENCE)),
    },
    targetId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    createdBy: {
      type: DataTypes.UUID,
      allowNull: false,
    },
  },
  {
    tableName: "posts",
    paranoid: true,
  }
);

Post.belongsTo(User, {
  as: "user",
  foreignKey: "createdBy",
});

// Post.sync({ force: true });
// Post.sync({ alter: true });

module.exports = Post;
