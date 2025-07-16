const router = require("express").Router();
const { authToken } = require("../../utils/middlewares/authTokenMiddleware");
const { AppError } = require("../../utils/errorHandler");
const { pagination } = require("../../utils/middlewares/paginationMiddleware");
const familyMemberController = require("../controllers/familyMember");

//get all family members
router.get("/", authToken(), pagination, async (req, res, next) => {
  try {
    let residentId = req.currentUser.id;

    if (req.currentUser.familyMemberId) {
      residentId = (
        await familyMemberController.getFamilyMember({
          id: req.currentUser.familyMemberId,
        })
      ).residentId;
    }

    const members = await familyMemberController.getAllMembers(
      { residentId },
      req.paginate
    );
    res.json({
      status: "success",
      data: members,
    });
  } catch (error) {
    error.reference = error.reference ? error.reference : "GET /family-members";
    next(error);
  }
});

//add family member
router.post("/", authToken(), async (req, res, next) => {
  try {
    if (req.currentUser.familyMemberId) {
      throw new AppError(
        "",
        "You have not the priviledge to perform this action",
        "custom",
        200
      );
    }

    const newMember = await familyMemberController.addMember({
      ...req.body,
      residentId: req.currentUser.id,
      residentMobileNumber: req.currentUser.mobileNumber,
    });
    res.json({
      status: "success",
      msg: "Member added successfully",
      data: newMember,
    });
  } catch (error) {
    error.reference = error.reference
      ? error.reference
      : "POST /family-members";
    next(error);
  }
});

//update family member details
router.patch("/:memberId", authToken(), async (req, res, next) => {
  try {
    if (req.currentUser.familyMemberId) {
      throw new AppError(
        "",
        "You have not the priviledge to perform this action",
        "custom",
        200
      );
    }
    const updatedMember = await familyMemberController.updateMember(
      {
        id: req.params.memberId,
        residentMobileNumber: req.currentUser.mobileNumber,
        residentId: req.currentUser.id,
      },
      req.body
    );
    res.json({
      status: "success",
      msg: "Member updated successfully",
      data: updatedMember,
    });
  } catch (error) {
    error.reference = error.reference
      ? error.reference
      : "PATCH /family-members";
    next(error);
  }
});

//delete family member
router.delete("/:memberId", authToken(), async (req, res, next) => {
  try {
    if (req.currentUser.familyMemberId) {
      throw new AppError(
        "",
        "You have not the priviledge to perform this action",
        "custom",
        200
      );
    }

    await familyMemberController.deleteMember({
      id: req.params.memberId,
      residentId: req.currentUser.id,
    });
    res.json({
      status: "success",
      msg: "Member deleted successfully",
      data: [],
    });
  } catch (error) {
    error.reference = error.reference
      ? error.reference
      : "DELETE /family-members";
    next(error);
  }
});

module.exports = router;
