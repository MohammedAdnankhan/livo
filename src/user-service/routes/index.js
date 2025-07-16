const router = require("express").Router();
const {
  USER_TYPES,
  ADMIN_ROLES,
  ADMIN_ACTION_TYPES,
  ADMIN_SOURCE_TYPES,
} = require("../../config/constants");
const flatController = require("../../flat-service/controllers/flat");
const { sendOTP } = require("../../otp-service/controllers/otp");
const { authToken } = require("../../utils/middlewares/authTokenMiddleware");
const { AppError } = require("../../utils/errorHandler");
const {
  restrictAdmin,
} = require("../../utils/middlewares/restrictMiddlewares");
const authController = require("../controllers/auth");
const userController = require("../controllers/user");
const uploadController = require("../../upload-service/controllers/s3Upload");
const {
  validateBuildingIdForAdmin,
} = require("../../utils/middlewares/validateBuildingIdMiddleware");
const {
  checkBuildingId,
} = require("../../utils/middlewares/checkBuildingIdMiddleware");
const eventEmitter = require("../../utils/eventEmitter");
const { sendResponse } = require("../../utils/responseHandler");
const tokenController = require("../../token-service/controllers/token");
const { validatePayload } = require("../../utils/middlewares/requestValidator");
const { signupUserSchema, signupUserQuerySchema } = require("../validators");
const { hashPassword } = require("../../utils/utility");

//signup
router.post(
  "/sign-up",
  uploadController.s3Upload.single("profilePicture"),
  validatePayload({ body: signupUserSchema, query: signupUserQuerySchema }),
  async (req, res, next) => {
    try {
      if (req.validatedQuery.newTrigger) {
        const { mobileNumber, otp, secretKey } = req.validatedBody;
        await authController.verifySecretWithOtp({
          mobileNumber,
          otp,
          secretKey,
        });
      } else {
        const { mobileNumber, otp } = req.validatedBody;
        await authController.verifyUserOtp({ mobileNumber, otp });
      }
      let profilePicture;
      if (req.file) {
        const upload = (await uploadController.uploadFiles([req.file]))[0];
        profilePicture = upload.location;
      }

      req.validatedBody.password = await hashPassword(
        req.validatedBody["password"]
      );

      // const newUser = await authController.createUser(
      //   { ...req.body, profilePicture },
      //   req.language
      // );
      const newUser = await authController.signupUser({
        ...req.validatedBody,
        profilePicture,
      });

      eventEmitter.emit("admin_level_notification", {
        flatId: req.body.flatId,
        actionType: ADMIN_ACTION_TYPES.NEW_LOGIN_REQUEST.key,
        sourceType: ADMIN_SOURCE_TYPES.LOGIN_REQUEST,
        sourceId: newUser.id,
        generatedBy: newUser.id,
      });

      // return res.status(201).json({
      //   status: "success",
      //   data: newUser,
      // });
      sendResponse(res, null, "Signup Initiated", 201);
    } catch (error) {
      error.reference = error.reference
        ? error.reference
        : "POST /users/sign-up";
      next(error);
    }
  }
);

//send otp
router.post("/send-otp", async (req, res, next) => {
  try {
    await authController.sendUserOTP({ ...req.body });
    res.json({
      status: "success",
      data: {
        msg: "OTP sent to Mobile Number",
      },
    });
  } catch (error) {
    error.reference = error.reference
      ? error.reference
      : "POST /users/send-otp";
    next(error);
  }
});

//verify-otp
router.post("/verify-otp", async (req, res, next) => {
  try {
    if (req.query.newTrigger) {
      await authController.doVerifyTwilioOtp({ ...req.body });
    } else {
      await authController.verifyUserOtp({ ...req.body });
    }

    return res.status(200).json({
      status: "success",
      data: {
        msg: "OTP verified.",
      },
    });
  } catch (error) {
    error.reference = error.reference
      ? error.reference
      : "POST /users/verify-otp";
    next(error);
  }
});

//login
router.post("/login", async (req, res, next) => {
  try {
    const userBody = req.body;
    const data = await authController.loginUser(userBody);
    sendResponse(res, data, "User logged in successfully");
  } catch (error) {
    error.reference = error.reference ? error.reference : "POST /users/login";
    next(error);
  }
});

router.get("/logout", authToken([USER_TYPES.USER]), async (req, res, next) => {
  try {
    await tokenController.deleteToken({ userId: req.currentUser.id });
    sendResponse(res, null, "User logged out successfully.");
  } catch (error) {
    error.reference = error.reference ? error.reference : "GET /users/logout";
    next(error);
  }
});

//get user details
router.get("/details", authToken(), async (req, res, next) => {
  try {
    const [flatDetails, userInfo] = await Promise.all([
      flatController.getFlatWithBuilding(
        { id: req.currentUser.flatId },
        req.language
      ),
      userController.getUserInformation({ userId: req.currentUser.id }),
    ]);

    return res.status(200).json({
      status: "success",
      data: {
        ...JSON.parse(JSON.stringify(req.currentUser)),
        userInfo,
        flat: flatDetails,
      },
    });
  } catch (error) {
    next(error);
  }
});

//get notification preference
router.get("/notifications", authToken(), async (req, res, next) => {
  try {
    const preference = await userController.getUserWithInfo(req.currentUser.id);
    res.json({
      status: "success",
      data: preference.notificationEnabled,
    });
  } catch (error) {
    error.reference = error.reference
      ? error.reference
      : "GET /users/notifications";
    next(error);
  }
});

//change password
router.patch("/change-password", authToken(), async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      throw new AppError("", "All fields are compulsory");
    }
    const updatedUser = await authController.changePassword({
      currentPassword,
      newPassword,
      id: req.currentUser.id,
    });
    res.json({
      status: "success",
      msg: "Password changed successfully",
      data: updatedUser,
    });
  } catch (error) {
    error.reference = error.reference
      ? error.reference
      : "PATCH /users/change-password";
    next(error);
  }
});

//update user profile
router.patch("/update", authToken(), async (req, res, next) => {
  try {
    const updatedUser = await userController.updateUser(
      { id: req.currentUser.id },
      req.body
    );
    res.json({
      status: "success",
      msg: "Profile update successful",
      data: updatedUser,
    });
  } catch (error) {
    error.reference = error.reference ? error.reference : "PATCH /users/update";
    next(error);
  }
});

//change notification preferences
router.patch("/notifications", authToken(), async (req, res, next) => {
  try {
    await userController.updateNotificationPreference({
      ...req.body,
      userId: req.currentUser.id,
    });
    res.json({
      status: "success",
      data: "Notification preferences updated successfully",
    });
  } catch (error) {
    error.reference = error.reference
      ? error.reference
      : "PATCH /users/notifications";
    next(error);
  }
});

//forgot password
router.patch("/forgot-password", async (req, res, next) => {
  try {
    if (!req.body.username) {
      throw new AppError("", "username is required");
    }
    if (req.query.newTrigger) {
      const { username, otp, secretKey, newPassword } = req.body;
      await authController.resetPassword({
        username,
        newPassword,
        otp,
        secretKey,
      });
    } else {
      await authController.forgotPassword({ ...req.body });
    }

    res.json({
      status: "success",
      data: "Password updated successfully",
    });
  } catch (error) {
    error.reference = error.reference
      ? error.reference
      : "PATCH /users/forgot-password";
    next(error);
  }
});

//send otp for forgot password
router.post("/forgot-password/send-otp", async (req, res, next) => {
  try {
    await authController.forgotPasswordOtp({ ...req.body });
    res.json({
      status: "success",
      data: "Otp sent",
    });
  } catch (error) {
    error.reference = error.reference
      ? error.reference
      : "POST /users/forgot-password/send-otp";
    next(error);
  }
});

//get other user profile info
router.get("/other/:userId", authToken(), async (req, res, next) => {
  try {
    const profileDetails = await userController.getProfileDetails(
      {
        userId: req.params.userId,
      },
      req.language
    );
    res.json({
      status: "success",
      data: profileDetails,
    });
  } catch (error) {
    error.reference = error.reference
      ? error.reference
      : "GET /users/other/:userId";
    next(error);
  }
});

//add or update public info
router.post("/public-details", authToken(), async (req, res, next) => {
  try {
    const publicDetails = await userController.addOrUpdateDetails(
      {
        userId: req.currentUser.id,
      },
      req.body
    );
    res.json({
      status: "success",
      data: publicDetails,
    });
  } catch (error) {
    error.reference = error.reference
      ? error.reference
      : "POST /users/public-details";
    next(error);
  }
});

router.get(
  "/requested",
  authToken(USER_TYPES.ADMIN),
  restrictAdmin(ADMIN_ROLES.ADMIN),
  validateBuildingIdForAdmin,
  async (req, res, next) => {
    try {
      let requestedUsers;
      if (req.currentAdmin.buildingId) {
        requestedUsers = await userController.requestedFlatUsers({
          buildingId: req.currentAdmin.buildingId,
          propertyId: req.currentAdmin.propertyId,
          search: req.query?.search,
        });
      } else {
        requestedUsers = await userController.requestedFlatUsersInProperty({
          propertyId: req.currentAdmin.propertyId,
          search: req.query?.search,
        });
      }
      res.json({
        status: "success",
        data: requestedUsers,
      });
    } catch (error) {
      error.reference = error.reference
        ? error.reference
        : "GET /users/requested";
      next(error);
    }
  }
);

module.exports = router;
