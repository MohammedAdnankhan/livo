const { DataTypes } = require("sequelize");
const db = require("../../database");
const MarketPlace = require("../../marketPlace-service/models/MarketPlace");
const User = require("../../user-service/models/User");

const SavedItem = db.sequelize.define(
  "SavedItem",
  {
    id: {
      type: DataTypes.UUID,
      allowNull: false,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    itemId: {
      type: DataTypes.UUID,
      allowNull: false,
      unique: "itemAndUserIdIndex",
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
      unique: "itemAndUserIdIndex",
    },
  },
  {
    tableName: "saved_items",
    paranoid: true,
  }
);

SavedItem.belongsTo(MarketPlace, {
  as: "marketPlaceItem",
  foreignKey: "itemId",
});

SavedItem.belongsTo(User, {
  as: "user",
  foreignKey: "userId",
});

// SavedItem.sync({ force: true });
// SavedItem.sync({ alter: true });

module.exports = SavedItem;
