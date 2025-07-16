const { DataTypes } = require("sequelize");
const db = require("../../database");
const User = require("../../user-service/models/User");
const Post = require("../../post-service/models/Post");

const Comment = db.sequelize.define(
  "Comment",
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
    },
    content: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    replyId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    shareId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
  },
  {
    tableName: "comments",
    paranoid: true,
  }
);

Comment.belongsTo(Post, {
  foreignKey: "postId",
  as: "post",
});

Comment.belongsTo(User, {
  foreignKey: "userId",
  as: "resident",
});

// Comment.sync({ force: true });
// Comment.sync({ alter: true });

module.exports = Comment;
