const User = require("../models/User");
const bcrypt = require("bcryptjs");
const {
  generateRefreshToken,
  generateAccessToken,
} = require("../../utils/generateToken");
const { Op } = require("sequelize");
const { AppError } = require("../../utils/errorHandler");
const {
  sendOTP,
  verifyOtp,
  verifyTwilioOtp,
  verifyOtpWithSecret,
} = require("../../otp-service/controllers/otp");
const {
  USER_TYPES,
  LANGUAGES,
  USER_ROLES,
  UAE_OFFSET,
  LEASE_STATUSES,
} = require("../../config/constants");
const { getUser } = require("./user");
const UserInformation = require("../models/UserInformation");
const {
  getFamilyMember,
} = require("../../familyMember-service/controllers/familyMember");
const {
  getMasterUser,
} = require("../../masterUser-service/controllers/masterUser");
const {
  getFlatContract,
  createFlatContract,
} = require("../../flatContract-service/controllers/flatContract");
const {
  singUpInitiatedForUser,
  singUpInitiatedForAdmin,
  signupCompletedBypassForUser,
} = require("../../utils/email");
const logger = require("../../utils/logger");
const { getFlatWithBuilding } = require("../../flat-service/controllers/flat");
const { getAdmin } = require("../../admin-service/controllers/admin");
const moment = require("moment-timezone");
const {
  getPropertyFeatureFromFlat,
} = require("../../property-service/controllers/property");
const db = require("../../database");
const MasterUser = require("../../masterUser-service/models/MasterUser");
const BankDetail = require("../../masterUser-service/models/BankDetail");
const { createTokenEntity } = require("../../token-service/controllers/token");
const {
  getLeaseWithLatestStatus,
} = require("../../lease-service/controllers/lease");
const { hashPassword } = require("../../utils/utility");
const {
  findOrCreateMuForHomeTherapy,
} = require("../../masterUser-service/controllers/masterUser.wrapper");
const {
  createLeaseForHomeTherapy,
} = require("../../lease-service/controllers/lease.wrapper");
const {
  sendSignUpInitiatedEmail,
  sendSignUpEmailsToSobha,
} = require("./user.utility");

//signup
const createUser = async (data, language) => {
  const [
    { isSignupApprovalRequired, approvalDetails, propertyId },
    exitingUserForFlat,
    userFromEmail,
    userFromMobileNumber,
  ] = await Promise.all([
    getPropertyFeatureFromFlat(data.flatId),
    getUser({ flatId: data.flatId }),
    getUser({ email: data.email }),
    getUser({ mobileNumber: data.mobileNumber }),
  ]);

  if (userFromEmail) {
    throw new AppError("createUser", "Email already exists");
  }

  if (userFromMobileNumber) {
    throw new AppError("createUser", "Mobile Number already exists");
  }

  if (isSignupApprovalRequired) {
    const checkPendingUser = await getUser({
      requestedFlat: data.flatId,
      mobileNumber: data.mobileNumber,
      flatId: null,
    });
    if (checkPendingUser) {
      throw new AppError(
        "createUser",
        "Your signup request is pending. Please try after some time"
      );
    }
  }

  if (exitingUserForFlat) {
    const familyMember = await getFamilyMember({
      residentId: exitingUserForFlat.id,
      mobileNumber: data.mobileNumber,
    });

    if (!familyMember) {
      throw new AppError("createUser", "Invalid Body", "custom", 200, [
        {
          column: "flatId",
          message: "Please select another Flat, it is already taken!",
        },
      ]);
    } else {
      data.familyMemberId = familyMember.id;
    }
  } else {
    const contract = await getFlatContract({ flatId: data.flatId });
    if (contract) {
      if (!contract.isExpired) {
        const masterUser = await getMasterUser({
          mobileNumber: data.mobileNumber,
        });
        if (!masterUser || masterUser.id !== contract.masterUserId) {
          throw new AppError("createUser", "Invalid Body", "custom", 200, [
            {
              column: "flatId",
              message: "Please select another Flat, it is already taken!",
            },
          ]);
        }
      } else {
        if (isSignupApprovalRequired) {
          data.requestedFlat = data.flatId;
          delete data.flatId;
        }
      }
    } else {
      if (isSignupApprovalRequired) {
        data.requestedFlat = data.flatId;
        delete data.flatId;
      }
    }
  }

  if (!data.password || data.password.length < 6) {
    throw new AppError("createUser", "Invalid Body", "custom", 200, [
      {
        column: "password",
        message: "Enter valid password",
      },
    ]);
  }
  if (language && !Object.values(LANGUAGES).includes(language)) {
    throw new AppError("createUser", "Invalid Body", "custom", 200, [
      {
        column: "language",
        message: "Enter valid language",
      },
    ]);
  }
  data.password = await bcrypt.hash(data.password, 10);

  language && (data.language = language);

  //create user
  let newUser;
  // try {
  //   newUser = await User.create(data);
  // } catch (error) {
  //   newUser = await User.findOne({
  //     where: {
  //       [Op.or]: [{ mobileNumber: data.mobileNumber }, { email: data.email }],
  //       deletedAt: { [Op.ne]: null },
  //     },
  //     paranoid: false,
  //   });

  //   if (!newUser) {
  //     throw error;
  //   }

  //   for (const key in JSON.parse(JSON.stringify(newUser))) {
  //     newUser[key] = null;
  //   }

  //   for (const key in data) {
  //     newUser[key] = data[key];
  //   }
  //   newUser.emailVerified = false;
  //   newUser.role = USER_ROLES.RESIDENT;
  //   await newUser.save();
  //   await newUser.restore();
  // }
  const transaction = await db.sequelize.transaction();
  try {
    findDeletedUser = await User.findOne({
      where: {
        [Op.or]: [{ mobileNumber: data.mobileNumber }, { email: data.email }],
        deletedAt: { [Op.ne]: null },
      },
      paranoid: false,
    });
    if (findDeletedUser) {
      for (const key in findDeletedUser.get({ plain: true })) {
        findDeletedUser[key] = null;
      }
      for (const key in data) {
        findDeletedUser[key] = data[key];
      }
      findDeletedUser.emailVerified = false;
      findDeletedUser.role = USER_ROLES.RESIDENT;
      await findDeletedUser.save({ transaction });
      await findDeletedUser.restore({ transaction });
      newUser = findDeletedUser;
    } else {
      newUser = await User.create(data, { transaction });
    }
    newUser.password = undefined;

    await UserInformation.findOrCreate({
      where: { userId: newUser.id },
      transaction,
    });

    if (!isSignupApprovalRequired) {
      const flatContractData = {
        flatId: data.flatId,
        flatUsage: approvalDetails.flatUsage,
        contractStartDate: moment().endOf("day").toDate(),
        contractEndDate: moment()
          .add(approvalDetails.approvalDuration, "year")
          .endOf("day")
          .toDate(),
        moveInDate: moment().endOf("day").toDate(),
        moveOutDate: moment()
          .add(approvalDetails.approvalDuration, "year")
          .endOf("day")
          .toDate(),
        securityDeposit: approvalDetails.securityDeposit,
        activationFee: approvalDetails.activationFee,
        paymentFrequency: approvalDetails.paymentFrequency,
        paymentMode: approvalDetails.paymentMode,
        currency: approvalDetails.currency,
        noticePeriod: approvalDetails.noticePeriod,
        paymentsData: [
          {
            amount: approvalDetails.rentAmount,
            date: moment().startOf("day").toDate(),
          },
        ],
      };

      const masterUser = await getMasterUser({
        mobileNumber: data.mobileNumber,
      });

      if (masterUser) {
        const flatContract = await getFlatContract({
          masterUserId: masterUser.id,
        });
        if (flatContract && !flatContract.isExpired) {
          throw new AppError("createUser", "Contract already exist for user");
        }
        flatContractData.masterUserId = masterUser.id;
      } else {
        //create master user
        const masterUserData = {
          email: data.email,
          countryCode: data.countryCode,
          mobileNumber: data.mobileNumber,
          name: data.name,
          propertyId,
          profilePicture: data.profilePicture ? data.profilePicture : null,
          documentDetails: {
            passportImage: null,
            govIdImage: null,
            documentExpiry: null,
          },
          alternateContact: {
            countryCode: null,
            mobileNumber: null,
            email: null,
          },
        };
        const newMasterUser = await MasterUser.create(masterUserData, {
          transaction,
        });
        await BankDetail.create(
          {
            masterUserId: newMasterUser.id,
            accountNumber: null,
            accountHolderName: null,
            bankName: null,
            swiftCode: null,
            iban: null,
          },
          { transaction }
        );
        flatContractData.masterUserId = newMasterUser.id;
      }
      if (!data.familyMemberId) {
        await createFlatContract(flatContractData, transaction);
      }
    }
    await transaction.commit();
  } catch (error) {
    await transaction.rollback();
    throw error;
  }

  //send email to admin and user
  if (isSignupApprovalRequired) {
    getFlatWithBuilding({ id: newUser.requestedFlat })
      .then(async (flatDetails) => {
        flatDetails = JSON.parse(JSON.stringify(flatDetails));
        const admin = await getAdmin({
          propertyId: flatDetails.building.propertyId,
        });
        const emailToUserObj = {
          buildingName: flatDetails.building.name,
          flatName: flatDetails.name,
          residentName: newUser.name,
        };
        singUpInitiatedForUser(newUser.email, emailToUserObj);
        const emailToAdminObj = {
          adminName: admin.name,
          residentName: newUser.name,
          buildingName: flatDetails.building.name,
          flatName: flatDetails.name,
          buildingAndFlatName: `${flatDetails.name}, ${flatDetails.building.name}`,
          requestedTime: moment(newUser.updatedAt)
            .utcOffset(UAE_OFFSET)
            .format("LLLL"),
          residentMobileNumber: newUser.mobileNumber,
          residentEmail: newUser.email,
          requestType: "Registration",
        };
        singUpInitiatedForAdmin(admin.email, emailToAdminObj);
      })
      .catch((err) => {
        console.log(err);
        logger.error(`Error in createUser: ${JSON.stringify(err)}`);
      });
  } else {
    getFlatWithBuilding({ id: newUser.flatId })
      .then(async (flatDetails) => {
        flatDetails = JSON.parse(JSON.stringify(flatDetails));
        const admin = await getAdmin({
          propertyId: flatDetails.building.propertyId,
        });
        const emailToUserObj = {
          buildingName: flatDetails.building.name,
          residentName: newUser.name,
        };
        signupCompletedBypassForUser(newUser.email, emailToUserObj);
        const emailToAdminObj = {
          adminName: admin.name,
          residentName: newUser.name,
          buildingName: flatDetails.building.name,
          flatName: flatDetails.name,
          buildingAndFlatName: `${flatDetails.name}, ${flatDetails.building.name}`,
          requestedTime: moment(newUser.updatedAt)
            .utcOffset(UAE_OFFSET)
            .format("LLLL"),
          residentMobileNumber: newUser.mobileNumber,
          residentEmail: newUser.email,
          requestType: "Registration",
        };
        singUpInitiatedForAdmin(admin.email, emailToAdminObj);
      })
      .catch((err) => {
        console.log(err);
        logger.error(`Error in createUser: ${JSON.stringify(err)}`);
      });
  }

  return newUser;
};

// send OTP
const sendUserOTP = async (data) => {
  if (!data.email || !data.mobileNumber) {
    throw new AppError("sendUserOtp", "Invalid Body", "custom", 200, [
      {
        column: "mobileNumber / email",
        message: "Email and mobile number are required",
      },
    ]);
  }
  const findEmail = await User.findOne({
    where: { email: data.email },
  });
  if (findEmail) {
    throw new AppError("sendUserOtp", "Invalid Body", "custom", 200, [
      {
        column: "email",
        message: "Email already exists",
      },
    ]);
  }
  const findNumber = await User.findOne({
    where: { mobileNumber: data.mobileNumber },
  });
  if (findNumber) {
    throw new AppError("sendUserOtp", "Invalid Body", "custom", 200, [
      {
        column: "mobileNumber",
        message: "Mobile number already exists",
      },
    ]);
  }
  await sendOTP(data);
};

//verify otp
const verifyUserOtp = async (data) => {
  await verifyOtp(data);
};

const doVerifyTwilioOtp = async (data) => {
  await verifyTwilioOtp(data);
};

const verifySecretWithOtp = async (data) => {
  await verifyOtpWithSecret(data);
};

//login
const loginUser = async (data) => {
  let username = data.username ? data.username : null;
  if (!data.password)
    throw new AppError("loginUser", "Invalid Body", "custom", 200, [
      {
        column: "password",
        message: "Enter Password",
      },
    ]);

  let password = data.password;

  const findUser = await User.scope(null).findOne({
    where: {
      [Op.or]: [{ email: username }, { mobileNumber: username }],
    },
  });

  if (!findUser) {
    throw new AppError("loginUser", "User not found", "custom", 200, [
      {
        column: "username",
        message: "User not found",
      },
    ]);
  }

  if (findUser.requestedFlat && !findUser.flatId) {
    throw new AppError("loginUser", "Request not approved", "custom", 200, [
      {
        column: "login",
        message:
          "Your signup request is not approved yet. Please try after some time",
      },
    ]);
  }

  const checkPassword = await bcrypt.compare(password, findUser.password);
  if (!checkPassword) {
    throw new AppError("loginUser", "Invalid Body", "custom", 200, [
      {
        column: "password",
        message: "Incorrect password",
      },
    ]);
  }
  const [refreshToken, accessToken] = await Promise.all([
    generateRefreshToken(findUser.id, USER_TYPES.USER),
    generateAccessToken(findUser.id, USER_TYPES.USER),
  ]);

  await createTokenEntity({ token: refreshToken, userId: findUser.id });
  return { accessToken, refreshToken, userType: USER_TYPES.USER };
};

//change password
const changePassword = async (data) => {
  const { currentPassword, newPassword, id } = data;
  const findUser = await User.scope(null).findByPk(id);
  if (!(await bcrypt.compare(currentPassword, findUser.password))) {
    throw new AppError("", "Invalid Body", "custom", 200, [
      {
        column: "password",
        message: "Incorrect password",
      },
    ]);
  }
  if (newPassword.length <= 5 || newPassword == currentPassword) {
    throw new AppError("", "Invalid Body", "custom", 200, [
      {
        column: "password",
        message: "Enter valid password",
      },
    ]);
  }
  findUser.password = await bcrypt.hash(newPassword, 10);
  const updatedUser = await findUser.save();
  updatedUser.password = undefined;
  return updatedUser;
};

//forgot password
const forgotPassword = async ({ username, newPassword, otp }) => {
  const findUser = await User.scope(null).findOne({
    where: {
      [Op.or]: [{ email: username }, { mobileNumber: username }],
    },
  });
  if (!findUser) {
    throw new AppError("", "User not found");
  }

  try {
    await verifyUserOtp({ mobileNumber: findUser.mobileNumber, otp });
  } catch (error) {
    throw error;
  }

  if (!newPassword || newPassword.length <= 5) {
    throw new AppError("", "Invalid Body", "custom", 200, [
      {
        column: "password",
        message: "Enter valid password",
      },
    ]);
  }
  if (await bcrypt.compare(newPassword, findUser.password)) {
    throw new AppError("", "Invalid Body", "custom", 200, [
      {
        column: "password",
        message: "New password cannot be same as previous password",
      },
    ]);
  }
  findUser.password = await bcrypt.hash(newPassword, 10);
  await findUser.save();
  return;
};

//reset password
const resetPassword = async ({ username, newPassword, otp, secretKey }) => {
  const findUser = await User.scope(null).findOne({
    where: {
      [Op.or]: [{ email: username }, { mobileNumber: username }],
    },
  });
  if (!findUser) {
    throw new AppError("", "User not found");
  }

  try {
    await verifySecretWithOtp({
      mobileNumber: findUser.mobileNumber,
      otp,
      secretKey,
    });
  } catch (error) {
    throw error;
  }

  if (!newPassword || newPassword.length <= 5) {
    throw new AppError("", "Invalid Body", "custom", 200, [
      {
        column: "password",
        message: "Enter valid password",
      },
    ]);
  }
  if (await bcrypt.compare(newPassword, findUser.password)) {
    throw new AppError("", "Invalid Body", "custom", 200, [
      {
        column: "password",
        message: "New password cannot be same as previous password",
      },
    ]);
  }
  findUser.password = await bcrypt.hash(newPassword, 10);
  await findUser.save();
  return;
};

const forgotPasswordOtp = async (data) => {
  if (!data.mobileNumber) {
    throw new AppError("", "Invalid Body", "custom", 200, [
      {
        column: "mobileNumber",
        message: "Please enter mobile number",
      },
    ]);
  }
  const user = await getUser({ mobileNumber: data.mobileNumber });
  if (!user) {
    throw new AppError("sendOTP", "Invalid Body", "custom", 200, [
      {
        column: "mobileNumber",
        message: "Mobile Number does not exist",
      },
    ]);
  }
  await sendOTP(data);
};

/**
 * @async
 * @function signupUser
 * @param {import("../types").IUserSignup} data
 * @returns {Promise<{id: string}>}
 */
const signupUser = async (data) => {
  const reference = "signupUser";
  const [
    { isSignupApprovalRequired, approvalDetails, propertyId },
    exitingUserForFlat,
    userFromEmail,
    userFromMobileNumber,
    flatLease,
  ] = await Promise.all([
    getPropertyFeatureFromFlat(data.flatId),
    getUser({ flatId: data.flatId }),
    getUser({ email: data.email }),
    getUser({ mobileNumber: data.mobileNumber }),
    getLeaseWithLatestStatus({ flatId: data.flatId }),
  ]);

  if (userFromEmail) {
    throw new AppError(reference, "Email already exists");
  }

  if (userFromMobileNumber) {
    throw new AppError(reference, "Mobile Number already exists");
  }

  if (exitingUserForFlat) {
    throw new AppError(reference, "Invalid Body", "custom", 200, [
      {
        column: "flatId",
        message: "Please select another Flat, it is already taken!",
      },
    ]);
  }

  if (
    flatLease &&
    new Array(LEASE_STATUSES.ACTIVE, LEASE_STATUSES.DRAFT).includes(
      flatLease["statuses"][0]["status"]
    )
  ) {
    throw new AppError(reference, "An ongoing/pending lease exists");
  }

  if (
    isSignupApprovalRequired &&
    (await getUser({
      requestedFlat: data.flatId,
      mobileNumber: data.mobileNumber,
      flatId: null,
    }))
  ) {
    throw new AppError(
      reference,
      "Your signup request is pending. Please try after some time"
    );
  }

  if (isSignupApprovalRequired) {
    data["requestedFlat"] = data.flatId;
    delete data.flatId;
  }

  let user = null;
  const transaction = await db.sequelize.transaction();
  try {
    user = await User.create(data, { transaction });
    await UserInformation.create({ userId: user.id }, { transaction });

    if (!isSignupApprovalRequired) {
      const mu = await findOrCreateMuForHomeTherapy(
        { mobileNumber: data.mobileNumber },
        {
          countryCode: data.countryCode,
          email: data.email,
          name: data.name,
          profilePicture: data.profilePicture,
        },
        propertyId,
        transaction
      );
      await createLeaseForHomeTherapy(
        approvalDetails,
        data.flatId,
        mu.id,
        transaction
      );
    } else {
    }
    await transaction.commit();
  } catch (error) {
    await transaction.rollback();
    throw error;
  }

  const userObjForEmail = {
    email: user.email,
    mobileNumber: user.mobileNumber,
    name: user.name,
  };
  if (isSignupApprovalRequired) {
    sendSignUpInitiatedEmail(
      userObjForEmail,
      data.flatId || data["requestedFlat"],
      user.createdAt
    );
  } else {
    sendSignUpEmailsToSobha(
      userObjForEmail,
      data.flatId || data["requestedFlat"],
      user.createdAt
    );
  }

  return {
    id: user.id,
  };
};

module.exports = {
  loginUser,
  createUser,
  verifyUserOtp,
  sendUserOTP,
  changePassword,
  forgotPassword,
  forgotPasswordOtp,
  signupUser,
  doVerifyTwilioOtp,
  verifySecretWithOtp,
  resetPassword,
};
