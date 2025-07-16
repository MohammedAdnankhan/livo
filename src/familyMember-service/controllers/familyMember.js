const { Op } = require("sequelize");
const db = require("../../database");
const { deleteUser } = require("../../user-service/controllers/user");
const { AppError } = require("../../utils/errorHandler");
const FamilyMember = require("../models/FamilyMember");

//get all members
const getAllMembers = async (params, { offset, limit }) => {
  const getMembers = FamilyMember.findAll({
    where: params,
    offset,
    limit,
    order: [["createdAt", "DESC"]],
  });
  return getMembers;
};

const getFamilyMember = async (params) => {
  return FamilyMember.findOne({
    where: params,
  });
};

//add new member
const addMember = async (data) => {
  if (data.residentMobileNumber === data.mobileNumber) {
    throw new AppError("", "Invalid Body", "custom", 200, [
      {
        column: "mobileNumber",
        message: "You can't add your own Mobile Number",
      },
    ]);
  }

  if (!data.name) {
    throw new AppError("", "Invalid Body", "custom", 200, [
      { column: "name", message: "Name is required" },
    ]);
  }
  if (!data.mobileNumber) {
    throw new AppError("", "Invalid Body", "custom", 200, [
      { column: "mobileNumber", message: "Mobile number is required" },
    ]);
  }
  let createMember;
  try {
    createMember = await FamilyMember.create(data);
  } catch (error) {
    createMember = await FamilyMember.findOne({
      where: {
        mobileNumber: data.mobileNumber,
        residentId: data.residentId,
        deletedAt: { [Op.ne]: null },
      },
      paranoid: false,
    });

    if (!createMember) {
      throw error;
    }

    for (const key in JSON.parse(JSON.stringify(createMember))) {
      createMember[key] = null;
    }

    for (const key in data) {
      createMember[key] = data[key];
    }
    await createMember.save();
    await createMember.restore();
  }
  return createMember;
};

//update member
const updateMember = async (params, data) => {
  if (params.residentMobileNumber === data.mobileNumber) {
    throw new AppError("", "Invalid Body", "custom", 200, [
      {
        column: "mobileNumber",
        message: "You can't add your own Mobile Number",
      },
    ]);
  }

  delete params.residentMobileNumber;

  const findMember = await FamilyMember.findOne({ where: params });
  if (!findMember) {
    throw new AppError("", "Member not found");
  }

  delete data.mobileNumber;
  for (const key in data) {
    findMember[key] = data[key];
  }

  await findMember.save();
  return findMember;
};

//delete member
const deleteMember = async (params) => {
  const transaction = await db.sequelize.transaction();
  try {
    const member = await FamilyMember.findOne({ where: params, transaction });

    if (!member) throw new AppError("deleteMember", "Member not found");

    await member.destroy({ transaction });
    await deleteUser({ familyMemberId: member.id }, transaction);

    await transaction.commit();

    return;
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

module.exports = {
  getAllMembers,
  addMember,
  updateMember,
  deleteMember,
  getFamilyMember,
};
