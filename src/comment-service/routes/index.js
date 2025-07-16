const router = require("express").Router();
const { authToken } = require("../../utils/middlewares/authTokenMiddleware");
const { pagination } = require("../../utils/middlewares/paginationMiddleware");
const commentController = require("../controllers/comment");

//add new comment
router.post("/", authToken(), async (req, res, next) => {
  try {
    const newComment = await commentController.createNewComment({
      ...req.body,
      userId: req.currentUser.id,
    });
    res.json({
      status: "success",
      data: newComment,
    });
  } catch (error) {
    error.reference = error.reference ? error.reference : "POST /comments";
    next(error);
  }
});

//view all comments in a specific post
router.get("/:postId", authToken(), pagination, async (req, res, next) => {
  try {
    const getComments = await commentController.allPostComments(
      {
        postId: req.params.postId,
        replyId: null,
        shareId: req.query.shareId ? req.query.shareId : null,
      },
      req.paginate
    );
    res.json({
      status: "success",
      data: getComments,
    });
  } catch (error) {
    error.reference = error.reference
      ? error.reference
      : "GET /comments/postId";
    next(error);
  }
});

//view comment replies in a post
router.get(
  "/:postId/:replyId",
  authToken(),
  pagination,
  async (req, res, next) => {
    try {
      const replies = await commentController.commentReplies(
        {
          postId: req.params.postId,
          replyId: req.params.replyId,
        },
        req.paginate
      );
      res.json({
        status: "success",
        data: replies,
      });
    } catch (error) {
      error.reference = error.reference
        ? error.reference
        : "GET /comments/postId/replyId";
      next(error);
    }
  }
);

module.exports = router;
