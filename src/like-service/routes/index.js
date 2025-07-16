const router = require("express").Router();
const { authToken } = require("../../utils/middlewares/authTokenMiddleware");
const { pagination } = require("../../utils/middlewares/paginationMiddleware");
const likeController = require("../controllers/like");

//like/unlike a post
router.post("/", authToken(), async (req, res, next) => {
  try {
    const reaction = await likeController.react({
      ...req.body,
      userId: req.currentUser.id,
    });
    res.json({
      status: "success",
      data: reaction,
    });
  } catch (error) {
    error.reference = error.reference ? error.reference : "POST /likes";
    next(error);
  }
});

//get all users who liked on a post
router.get("/:postId", authToken(), pagination, async (req, res, next) => {
  try {
    const getUsersWhoLiked = await likeController.getUserLikes(
      {
        postId: req.params.postId,
        shareId: req.query.shareId ? req.query.shareId : null,
      },
      req.paginate
    );
    res.json({
      status: "success",
      data: getUsersWhoLiked,
    });
  } catch (error) {
    error.reference = error.reference ? error.reference : "GET /likes/postId";
    next(error);
  }
});

module.exports = router;
