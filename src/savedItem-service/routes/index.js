const router = require("express").Router();
const { authToken } = require("../../utils/middlewares/authTokenMiddleware");
const { pagination } = require("../../utils/middlewares/paginationMiddleware");
const savedItemController = require("../controllers/savedItem");

//add to / remove from saved item
router.post("/", authToken(), async (req, res, next) => {
  try {
    const saveItem = await savedItemController.createOrUpdateSavedItem({
      ...req.body,
      userId: req.currentUser.id,
    });
    res.json({
      status: "success",
      data: saveItem,
    });
  } catch (error) {
    error.reference = error.reference ? error.reference : "POST /saved-items";
    next(error);
  }
});

//get saved items for a user
router.get("/", authToken(), pagination, async (req, res, next) => {
  try {
    const getItems = await savedItemController.getSavedItem(
      {
        ...req.query,
        userId: req.currentUser.id,
      },
      req.paginate,
      req.language
    );
    res.json({
      status: "success",
      data: getItems,
    });
  } catch (error) {
    error.reference = error.reference ? error.reference : "POST /saved-items";
    next(error);
  }
});

module.exports = router;
