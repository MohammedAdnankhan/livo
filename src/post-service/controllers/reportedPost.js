const { REPORT_REASONS } = require("../../config/constants");
const User = require("../../user-service/models/User");
const { AppError } = require("../../utils/errorHandler");
const Post = require("../models/Post");
const PostFile = require("../models/PostFile");
const ReportedPost = require("../models/ReportedPost");
const { deletePost } = require("./post");

//report a post
const reportPost = async (data) => {
  if (!data.postId) {
    throw new AppError("reportPost", "Post ID is required");
  }
  const post = await Post.findOne({ where: { id: data.postId } });
  if (!post) {
    throw new AppError("reportPost", "Post not found");
  }
  if (data.reason && !Object.keys(REPORT_REASONS).includes(data.reason)) {
    throw new AppError("reportPost", "Enter valid reason");
  }

  await ReportedPost.create(data);
  return "Post has been reported";
};

//view all reported post - to be viewed by admin
const getReportedPosts = async ({ targetId }) => {
  const reportedPosts = await ReportedPost.findAll({
    order: [["createdAt", "DESC"]],
    include: [
      {
        model: Post,
        as: "post",
        required: true,
        where: { targetId },
        include: [
          {
            model: PostFile,
            as: "documents",
            required: false,
          },
          {
            model: User,
            as: "user",
            required: true,
            attributes: ["id", "name", "profilePicture"],
          },
        ],
      },
      {
        model: User,
        as: "userReported",
        required: true,
        attributes: ["id", "name", "profilePicture"],
      },
    ],
  });
  for (let post of reportedPosts) {
    post.reason = REPORT_REASONS[post.reason];
  }
  return reportedPosts;
};

//get report reasons
const getReportReasons = async () => {
  return Object.keys(REPORT_REASONS).map((reason) => {
    return {
      key: reason,
      reason: REPORT_REASONS[reason],
    };
  });
};

//delete reported post - to be used by admin
const deleteReportedPost = async ({ targetId, postId }) => {
  const reportedPost = await ReportedPost.findOne({
    include: {
      model: Post,
      as: "post",
      required: true,
      where: {
        id: postId,
        targetId,
      },
    },
  });
  if (!reportedPost) {
    throw new AppError("deleteReportedPost", "Post not found");
  }
  await deletePost({ id: postId });
  return;
};

module.exports = {
  reportPost,
  getReportedPosts,
  getReportReasons,
  deleteReportedPost,
};
