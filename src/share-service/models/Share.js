const { DataTypes } = require("sequelize");
const db = require("../../database");
const Post = require("../../post-service/models/Post");
const User = require("../../user-service/models/User");

const Share = db.sequelize.define(
  "Share",
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
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
  },
  {
    tableName: "shares",
    paranoid: true,
  }
);

Share.belongsTo(Post, {
  foreignKey: "postId",
  as: "post",
});

Share.belongsTo(User, {
  foreignKey: "userId",
  as: "resident",
});

// Share.sync({ force: true });
// Share.sync({ alter: true });

module.exports = Share;
