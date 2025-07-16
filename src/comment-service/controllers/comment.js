const moment = require("moment-timezone");
const { ACTION_TYPES, SOURCE_TYPES } = require("../../config/constants");
const User = require("../../user-service/models/User");
const { AppError } = require("../../utils/errorHandler");
const eventEmitter = require("../../utils/eventEmitter");
const Comment = require("../models/Comment");

//add new comment
const createNewComment = async (data) => {
  if (!data.postId) {
    throw new AppError("", "Post ID is required");
  }
  if (!data.content) {
    throw new AppError("", "Invalid Body", "custom", 200, [
      {
        column: "content",
        message: "Write something to add a comment",
      },
    ]);
  }
  const comment = await Comment.create(data);

  eventEmitter.emit("send_community_notification", {
    actionType: ACTION_TYPES.COMMENTED.key,
    sourceType: data.shareId ? SOURCE_TYPES.SHARED_POST : SOURCE_TYPES.POST,
    sourceId: data.shareId ? data.shareId : data.postId,
    generatedBy: data.userId,
  });

  return comment;
};

//view all comments in a specific post
const allPostComments = async (params, { offset, limit }) => {
  let order = [["createdAt", "DESC"]];
  let comments = JSON.parse(
    JSON.stringify(
      await countAndGetCommentsWithUser(params, { offset, limit }, order)
    )
  );

  for (const comment of comments.rows) {
    comment.creationTime = moment(comment.createdAt).from(moment());
  }

  return comments;
};

//view comment replies in a post
const commentReplies = async (params, { offset, limit }) => {
  let order = [["createdAt", "DESC"]];
  const commentReplies = await countAndGetCommentsWithUser(
    params,
    { offset, limit },
    order
  );
  return commentReplies;
};

async function countAndGetCommentsWithUser(params, { offset, limit }, order) {
  return await Comment.findAndCountAll({
    where: params,
    include: {
      model: User,
      as: "resident",
      required: true,
      attributes: ["id", "name", "profilePicture"],
    },
    order,
    offset,
    limit,
  });
}

module.exports = { createNewComment, allPostComments, commentReplies };
