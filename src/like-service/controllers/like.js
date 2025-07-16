const { ACTION_TYPES, SOURCE_TYPES } = require("../../config/constants");
const db = require("../../database");
const User = require("../../user-service/models/User");
const { AppError } = require("../../utils/errorHandler");
const eventEmitter = require("../../utils/eventEmitter");
const Like = require("../models/Like");

//like/unlike a post
const react = async (data) => {
  if (!data.postId) {
    throw new AppError("", "Post ID is required");
  }
  const params = {
    userId: data.userId,
    postId: data.postId,
    shareId: data.shareId ? data.shareId : null,
  };
  const t = await db.sequelize.transaction();
  try {
    const findLike = await Like.findOne({
      where: params,
      paranoid: false,
      transaction: t,
      lock: true,
    });
    let msg = "";
    let isLiked;
    if (!findLike) {
      await Like.create(params, { transaction: t });
      msg = "You liked this post";
      isLiked = true;
    } else if (findLike.deletedAt !== null) {
      await findLike.restore({ transaction: t });
      msg = "You liked this post";
      isLiked = true;
    } else if (findLike.deletedAt == null) {
      await findLike.destroy({ transaction: t });
      msg = "Unliked";
      isLiked = false;
    }
    const numberOfLikes = await Like.count({
      where: {
        postId: data.postId,
        shareId: data.shareId ? data.shareId : null,
      },
      transaction: t,
    });
    await t.commit();

    if (isLiked) {
      // Send notification
      eventEmitter.emit("send_community_notification", {
        actionType: ACTION_TYPES.LIKED.key,
        sourceType: data.shareId ? SOURCE_TYPES.SHARED_POST : SOURCE_TYPES.POST,
        sourceId: data.shareId ? data.shareId : data.postId,
        generatedBy: data.userId,
      });
    }

    return {
      message: msg,
      likes: numberOfLikes,
      isLiked,
      postId: params.postId,
      shareId: params.shareId,
    };
  } catch (error) {
    console.log(error);
    await t.rollback();
    throw error;
  }
};

//get all users who liked on a post
const getUserLikes = async (params, { offset, limit }) => {
  let order = [["createdAt", "DESC"]];
  const findUsersWhoLiked = await Like.findAndCountAll({
    where: params,
    order,
    offset,
    limit,
    include: [
      {
        model: User,
        as: "user",
        attributes: ["id", "name", "profilePicture"],
      },
    ],
  });
  return findUsersWhoLiked;
};

//get likes on a post
async function getLikesCount(params) {
  return await Like.count({ where: params });
}

//check if liked by yourself
async function checkIsLiked(params) {
  if (!params.postId || !params.userId) {
    throw new AppError("checkIsLiked", "User ID and Post ID are required");
  }
  const checkIfLiked = await Like.findOne({ where: params });
  if (!checkIfLiked) {
    return false;
  }
  return true;
}

module.exports = { react, getUserLikes, getLikesCount, checkIsLiked };
