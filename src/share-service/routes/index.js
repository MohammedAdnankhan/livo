const router = require("express").Router();
const { authToken } = require("../../utils/middlewares/authTokenMiddleware");
const shareController = require("../controllers/share");

//share a post
router.post("/", authToken(), async (req, res, next) => {
  try {
    const createShare = await shareController.share({
      ...req.body,
      userId: req.currentUser.id,
    });
    res.json({
      status: "success",
      data: createShare,
    });
  } catch (error) {
    error.reference = error.reference ? error.reference : "POST /shares";
    next(error);
  }
});

module.exports = router;
