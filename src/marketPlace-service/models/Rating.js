const { DataTypes } = require("sequelize");
const db = require("../../database");
const User = require("../../user-service/models/User");
const MarketPlace = require("./MarketPlace");

const Rating = db.sequelize.define(
  "Rating",
  {
    id: {
      type: DataTypes.UUID,
      allowNull: false,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    rating: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    itemId: {
      type: DataTypes.UUID,
      allowNull: false,
      unique: "ItemAndUserIndexId",
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
      unique: "ItemAndUserIndexId",
    },
  },
  {
    tableName: "ratings",
    paranoid: true,
  }
);

Rating.belongsTo(MarketPlace, {
  as: "item",
  foreignKey: "itemId",
});

Rating.belongsTo(User, {
  as: "resident",
  foreignKey: "userId",
});

MarketPlace.hasMany(Rating, {
  as: "rating",
  foreignKey: "itemId",
});

// Rating.sync({ force: true });
// Rating.sync({ alter: true });

module.exports = Rating;
