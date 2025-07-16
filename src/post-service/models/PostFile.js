const { DataTypes } = require("sequelize");
const db = require("../../database");
const Post = require("./Post");

const PostFile = db.sequelize.define(
  "PostFile",
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
      type: DataTypes.STRING,
      allowNull: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    type: {
      type: DataTypes.STRING,
      allowNull: false,
    },
  },
  {
    tableName: "post_files",
    paranoid: true,
  }
);

PostFile.belongsTo(Post, {
  foreignKey: "postId",
});

Post.hasMany(PostFile, {
  as: "documents",
  foreignKey: "postId",
});

// PostFile.sync({ force: true });
// PostFile.sync({ alter: true });

module.exports = PostFile;
