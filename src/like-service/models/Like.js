const { DataTypes } = require("sequelize");
const db = require("../../database");
const User = require("../../user-service/models/User");
const Post = require("../../post-service/models/Post");
const Share = require("../../share-service/models/Share");

const Like = db.sequelize.define(
  "Like",
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
      unique: "PostUserAndShareIndex",
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
      unique: "PostUserAndShareIndex",
    },
    shareId: {
      type: DataTypes.UUID,
      allowNull: true,
      unique: "PostUserAndShareIndex",
    },
  },
  {
    tableName: "likes",
    paranoid: true,
  }
);

Like.belongsTo(User, {
  as: "user",
  foreignKey: "userId",
});

Like.belongsTo(Post, {
  as: "post",
  foreignKey: "postId",
});

Like.belongsTo(Share, {
  as: "share",
  foreignKey: "shareId",
});

// Like.sync({ force: true });
// Like.sync({ alter: true });

module.exports = Like;
