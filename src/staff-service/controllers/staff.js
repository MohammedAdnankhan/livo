const Staff = require("../models/Staff");
const {
  DEPARTMENT_TYPES,
  DESIGNATION_TYPES,
  APPOINTMENT_TYPES,
  TIMEZONES,
  STAFF_AVAILABILITY_STATUS,
} = require("../../config/constants");
const { AppError } = require("../../utils/errorHandler");
const StaffFlat = require("../models/StaffFlat");
const Flat = require("../../flat-service/models/Flat");
const {
  enableSearch,
  getDateTimeObjectFromTimezone,
  isValidDateTime,
  getFirstXDayOfMonth,
  extractAvailabilityFromTimings,
} = require("../../utils/utility");
const {
  getSlots,
  getSlot,
} = require("../../timeslot-service/controllers/timeslot");
const moment = require("moment-timezone");
const StaffTimeslot = require("../models/StaffTimeslot");
const Timeslot = require("../../timeslot-service/models/Timeslot");
const db = require("../../database");
const logger = require("../../utils/logger");
const { Op } = require("sequelize");
const MaintenanceRequest = require("../../maintenanceRequest-service/models/MaintenanceRequest");
const Building = require("../../building-service/models/Building");

//add new staff
const createStaff = async (data) => {
  if (!data.name || !data.email || !data.countryCode || !data.mobileNumber) {
    throw new AppError(
      "createStaff",
      "Required fields are empty",
      "custom",
      412
    );
  }
  if (!data.password) {
    throw new AppError("createStaff", "Password is required", "custom", 412);
  }
  if (
    !("workingDays" in data) ||
    !("breakStartHours" in data) ||
    !("breakEndHours" in data) ||
    !("workingHoursStart" in data) ||
    !("workingHoursEnd" in data)
  ) {
    throw new AppError(
      "createStaff",
      "Availability details are empty",
      "custom",
      412
    );
  }
  if (
    data.department &&
    !Object.keys(DEPARTMENT_TYPES).includes(data.department)
  ) {
    throw new AppError("createStaff", "Select valid department", "custom", 412);
  }
  if (
    data.designation &&
    !Object.keys(DESIGNATION_TYPES).includes(data.designation)
  ) {
    throw new AppError(
      "createStaff",
      "Select valid designation",
      "custom",
      412
    );
  }
  if (
    data.appointment &&
    !Object.keys(APPOINTMENT_TYPES).includes(data.appointment)
  ) {
    throw new AppError(
      "createStaff",
      "Select valid appointment",
      "custom",
      412
    );
  }

  const [staffFromEmail, staffFromMobileNo] = await Promise.all([
    getStaff({ email: data.email }),
    getStaff({ mobileNumber: data.mobileNumber }),
  ]);

  if (staffFromEmail) {
    throw new AppError("createStaff", "Email already exists", "custom", 409);
  }

  if (staffFromMobileNo) {
    throw new AppError(
      "createStaff",
      "Mobile Number already exists",
      "custom",
      409
    );
  }

  data.availability = extractAvailabilityFromTimings(
    data.workingDays,
    data.workingHoursStart,
    data.workingHoursEnd,
    data.breakStartHours,
    data.breakEndHours
  );

  delete data.workingDays;
  delete data.breakStartHours;
  delete data.breakEndHours;
  delete data.workingHoursStart;
  delete data.workingHoursEnd;

  let staff = null;

  try {
    staff = await Staff.create(data);
  } catch (error) {
    staff = await Staff.findOne({
      where: {
        [Op.or]: [{ email: data.email }, { mobileNumber: data.mobileNumber }],
        deletedAt: { [Op.ne]: null },
      },
      paranoid: false,
    });
    if (!staff) {
      throw error;
    }
    for (const key in staff.get({ plain: true })) {
      staff[key] = null;
    }
    for (const key in data) {
      staff[key] = data[key];
    }
    await Promise.all([staff.save(), staff.restore()]);
  }

  if (
    data.flatsAssociated &&
    Array.isArray(data.flatsAssociated) &&
    data.flatsAssociated.length
  ) {
    await addStaffFlats(data.flatsAssociated, staff.id);
  }
  if (staff && staff.availability) {
    // fill staff calender in background
    addStaffSlotsFromAvailability({
      staffId: staff.id,
      availability: staff.availability,
    });
  }
  return null;
};

//get staff details
const getStaffDetails = async (params) => {
  const staff = await getStaff(params, {
    model: StaffFlat,
    as: "flatsAssociated",
    required: false,
    include: {
      model: Flat,
      as: "flat",
      required: false,
      attributes: ["id", "floor", "name_en", "name_ar"],
    },
  });
  if (!staff) {
    throw new AppError("getStaffDetails", "Staff not found", "custom", 404);
  }
  // staff.department && (staff.department = DEPARTMENT_TYPES[staff.department]);
  // staff.designation &&
  //   (staff.designation = DESIGNATION_TYPES[staff.designation]);
  // staff.appointment &&
  //   (staff.appointment = APPOINTMENT_TYPES[staff.appointment]);

  return staff;
};

const getAllStaffs = async (params, { offset, limit }) => {
  // enableSearch(params, "name");
  const reference = "getAllStaffs";
  if (params.search) {
    params[Op.or] = [
      { name: { [Op.iLike]: `%${params.search}%` } },
      { email: { [Op.iLike]: `%${params.search}%` } },
      { countryCode: { [Op.iLike]: `%${params.search}%` } },
      { mobileNumber: { [Op.iLike]: `%${params.search}%` } },
      { department: { [Op.iLike]: `%${params.search}%` } },
      { designation: { [Op.iLike]: `%${params.search}%` } },
      { appointment: { [Op.iLike]: `%${params.search}%` } },
      { nationality: { [Op.iLike]: `%${params.search}%` } },
    ];
  }
  delete params.search;
  if (
    params.designation &&
    !Object.keys(DESIGNATION_TYPES).includes(params.designation)
  ) {
    {
      throw new AppError(
        reference,
        `Designations can only be ${Object.keys(DESIGNATION_TYPES).join(", ")}`,
        "custom",
        412
      );
    }
  }
  if (
    params.department &&
    !Object.keys(DEPARTMENT_TYPES).includes(params.department)
  ) {
    {
      throw new AppError(
        reference,
        `Departments can only be ${Object.keys(DEPARTMENT_TYPES).join(", ")}`,
        "custom",
        412
      );
    }
  }
  const staffs = await Staff.findAndCountAll({
    where: params,
    order: [["updatedAt", "DESC"]],
    offset,
    limit,
  });

  for (let staff of staffs.rows) {
    staff.department && (staff.department = DEPARTMENT_TYPES[staff.department]);
    staff.designation &&
      (staff.designation = DESIGNATION_TYPES[staff.designation]);
    staff.appointment &&
      (staff.appointment = APPOINTMENT_TYPES[staff.appointment]);
  }
  return staffs;
};

//edit staff details
const editStaffDetails = async (data) => {
  if (!data.staffId) {
    throw new AppError(
      "editStaffDetails",
      "Staff ID is required",
      "custom",
      412
    );
  }
  let staff = await getStaff(
    { id: data.staffId },
    {
      model: StaffFlat,
      as: "flatsAssociated",
      required: false,
    }
  );
  if (!staff) {
    throw new AppError("editStaffDetails", "Staff not found", "custom", 412);
  }

  const existingStaffFlats = staff.flatsAssociated;
  const toUpdateStaffFlats = data.flatsAssociated;

  delete data.staffId;
  delete data.flatsAssociated;

  if (
    data.email &&
    (await getStaff({ email: data.email, id: { [Op.ne]: staff.id } }))
  ) {
    throw new AppError(
      "editStaffDetails",
      "Email already exists",
      "custom",
      409
    );
  }

  if (
    data.mobileNumber &&
    (await getStaff({
      mobileNumber: data.mobileNumber,
      id: { [Op.ne]: staff.id },
    }))
  ) {
    throw new AppError(
      "editStaffDetails",
      "Mobile number already exists",
      "custom",
      409
    );
  }

  for (let key in data) {
    staff[key] = data[key];
  }
  await staff.save();

  if (!toUpdateStaffFlats) {
    return "Staff updated successfully";
  }
  if (
    !existingStaffFlats.length &&
    toUpdateStaffFlats &&
    toUpdateStaffFlats.length
  ) {
    staff = JSON.parse(JSON.stringify(staff));
    staff.flatsAssociated = await addStaffFlats(toUpdateStaffFlats, staff.id);

    return staff;
  }
  let existingFlats = [];
  existingStaffFlats.map((flat) => {
    existingFlats.push(flat.flatId);
  });

  await editAssociatedFlats(staff.id, existingFlats, toUpdateStaffFlats);

  return null;
};

//get department types
const getDepartments = async () => {
  return Object.keys(DEPARTMENT_TYPES).map((department) => {
    return { key: department, value: DEPARTMENT_TYPES[department] };
  });
};

//get designation types
const getDesignations = async () => {
  return Object.keys(DESIGNATION_TYPES).map((designation) => {
    return { key: designation, value: DESIGNATION_TYPES[designation] };
  });
};

//get appointment types
const getAppointments = async () => {
  return Object.keys(APPOINTMENT_TYPES).map((appointment) => {
    return { key: appointment, value: APPOINTMENT_TYPES[appointment] };
  });
};

async function getStaff(params = {}, include, attributes = []) {
  return await Staff.findOne({
    where: params,
    attributes: attributes.length ? attributes : null,
    include: include ? include : undefined,
  });
}

async function addStaffFlats(flats, staffId) {
  let staffFlats = [];
  for (let flat of flats) {
    const staffFlatData = {
      staffId,
      flatId: flat,
    };
    const staffFlat = await StaffFlat.findOne({
      where: staffFlatData,
      paranoid: false,
    });
    if (!staffFlat) {
      const newStaffFlat = await StaffFlat.create(staffFlatData);
      staffFlats.push(newStaffFlat);
    } else if (staffFlat.deletedAt !== null) {
      const restoreStaffFlat = await staffFlat.restore();
      staffFlats.push(restoreStaffFlat);
    }
  }
  return staffFlats;
}

async function removeAssociatedFlats(flats, staffId) {
  if (!Array.isArray(flats)) {
    return;
  }
  for (let flat of flats) {
    const staffFlatData = {
      staffId,
      flatId: flat,
    };
    const staffFlat = await StaffFlat.findOne({ where: staffFlatData });
    await staffFlat.destroy();
  }
  return;
}

async function editAssociatedFlats(staffId, existingFlats, toUpdate = []) {
  if (!Array.isArray(toUpdate)) {
    return;
  }
  const newFlats = toUpdate.filter((flat) => !existingFlats.includes(flat));

  const flatsToRemove = existingFlats.filter(
    (flat) => !toUpdate.includes(flat)
  );

  if (flatsToRemove.length) {
    await removeAssociatedFlats(flatsToRemove, staffId);
  }
  if (newFlats.length) {
    await addStaffFlats(newFlats, staffId);
  }
  return;
}

//get staffs with department names
const getStaffWithDepartmentNames = async (params) => {
  enableSearch(params, "name");
  const staffs = await Staff.findAll({
    where: params,
  });
  const staffsInDepartments = {};
  for (let staff of staffs) {
    if (
      !staffsInDepartments.hasOwnProperty(DEPARTMENT_TYPES[staff.department])
    ) {
      staffsInDepartments[DEPARTMENT_TYPES[staff.department]] = [staff];
    } else {
      staffsInDepartments[DEPARTMENT_TYPES[staff.department]].push(staff);
    }
  }
  return staffsInDepartments;
};

const addStaffSlotsForMonth = async (data, timezone = TIMEZONES.INDIA) => {
  const staff = await getStaff({
    id: data.staffId,
    propertyId: data.propertyId,
  });
  if (!staff) {
    throw new AppError(
      "addStaffSlotsForMonth",
      "Staff not found",
      "custom",
      "404"
    );
  }
  delete data.staffId;
  delete data.propertyId;
  if (!data.slots || !Array.isArray(data.slots)) {
    throw new AppError(
      "addStaffSlotsForMonth",
      "Time slots are required",
      "custom",
      412
    );
  }

  let timeSlots = await getSlots({ id: data.slots });

  if (!timeSlots.length) {
    throw new AppError(
      "addStaffSlotsForMonth",
      "No Time slots found",
      "custom",
      404
    );
  }

  timeSlots = JSON.parse(JSON.stringify(timeSlots));

  const totalDays = moment().daysInMonth();

  let staffTimeSlotData = [];

  for (let slot of timeSlots) {
    //push payload timeslot in staff timeslot array
    staffTimeSlotData.push({
      staffId: staff.id,
      timeSlotId: slot.id,
      status: STAFF_AVAILABILITY_STATUS.AVAILABLE,
    });

    let slotDate = moment(slot.startTime).date();

    //loop over for entire month and add respective slots in array
    let i = 1;

    while (slotDate <= totalDays) {
      let startTime = moment(slot.startTime).add(7 * i, "days");
      if (startTime > moment().endOf("month")) {
        break;
      }
      const timeSlot = await getSlot({ startTime });
      staffTimeSlotData.push({
        staffId: staff.id,
        timeSlotId: timeSlot.id,
        status: STAFF_AVAILABILITY_STATUS.AVAILABLE,
      });
      slotDate += 7;
      i++;
    }
  }
  await StaffTimeslot.bulkCreate(staffTimeSlotData);

  const nullRowsQuery = `
  select ts."id" as "timeSlotId"
  from time_slots ts left join staff_timeslots sts on sts."timeSlotId" = ts.id 
  and (sts."deletedAt" is null AND sts."staffId" = :staffId)
  where ts."deletedAt" is null and sts.id is null and ts."startTime" >= :startDate 
  and ts."startTime" <= :endDate order by ts."startTime" asc`;

  db.sequelize
    .query(nullRowsQuery, {
      raw: true,
      type: db.Sequelize.QueryTypes.SELECT,
      replacements: {
        staffId: staff.id,
        startDate: moment(timeSlots[0].startTime)
          .tz(timezone)
          .startOf("month")
          .utc()
          .format(),
        endDate: moment(timeSlots[0].startTime)
          .tz(timezone)
          .endOf("month")
          .utc()
          .format(),
      },
      nest: true,
    })
    .then(async (nullSlots) => {
      nullSlots.map((slot) => {
        slot.staffId = staff.id;
        slot.status = STAFF_AVAILABILITY_STATUS.UNAVAILABLE;
      });
      await StaffTimeslot.bulkCreate(nullSlots);
    })
    .catch((err) => {
      logger.error(`Error in addStaffSlotsForMonth: ${JSON.stringify(err)}`);
    });

  return `Staff availability marked successfully`;
};

//add specific staff timeslots
const addStaffSlots = async (data, timezone = TIMEZONES.INDIA) => {
  const staff = await getStaff({
    id: data.staffId,
    propertyId: data.propertyId,
  });
  if (!staff) {
    throw new AppError("addStaffSlots", "Staff not found", "custom", 404);
  }
  delete data.staffId;
  delete data.propertyId;

  if (!data.slots || !Array.isArray(data.slots)) {
    throw new AppError(
      "addStaffSlots",
      "Time slots are required",
      "custom",
      412
    );
  }

  let timeSlots = await getSlots({ id: data.slots });

  if (!timeSlots.length) {
    throw new AppError(
      "addStaffSlotsForMonth",
      "No Time slots found",
      "custom",
      404
    );
  }

  await Promise.allSettled(
    timeSlots.map(async (slot) => {
      await StaffTimeslot.create({
        staffId: staff.id,
        timeSlotId: slot.id,
        status: STAFF_AVAILABILITY_STATUS.AVAILABLE,
      });
    })
  );
  return "Slots added successfully";
};

//change staff timeslots status
const changeStaffSlotStatus = async (params, data) => {
  if (!data.staffSlots || !Array.isArray(data.staffSlots)) {
    throw new AppError(
      "changeStaffSlotStatus",
      "Staff time slot Ids are required",
      "custom",
      412
    );
  }
  if (!data.status) {
    throw new AppError(
      "changeStaffSlotStatus",
      "Status is required",
      "custom",
      412
    );
  }
  if (!Object.values(STAFF_AVAILABILITY_STATUS).includes(data.status)) {
    throw new AppError(
      "changeStaffSlotStatus",
      `Status can only be ${Object.values(STAFF_AVAILABILITY_STATUS).join(
        ", "
      )}`,
      "custom",
      412
    );
  }

  const staff = await getStaff(params);
  if (!staff) {
    throw new AppError(
      "changeStaffSlotStatus",
      "Staff not found",
      "custom",
      "404"
    );
  }

  await StaffTimeslot.update(
    { status: data.status },
    {
      where: { id: data.staffSlots },
    }
  );

  return `Mentioned slots marked as ${data.status}`;
};

const getStaffAvailability = async (params, timezone = TIMEZONES.INDIA) => {
  let date = params.date,
    startDate = moment().tz(timezone).startOf("week").utc().format(),
    endDate = moment().tz(timezone).endOf("week").utc().format();

  if (date) {
    date = isValidDateTime(date);
    if (params.isWeekly) {
      startDate = moment(date).tz(timezone).startOf("week").utc().format();
      endDate = moment(date).tz(timezone).endOf("week").utc().format();
    } else {
      startDate = moment(date).tz(timezone).startOf("day").utc().format();
      endDate = moment(date).tz(timezone).endOf("day").utc().format();
    }
  }
  delete params.date;
  delete params.isWeekly;

  const staff = await getStaff(params);
  if (!staff) {
    throw new AppError(
      "getStaffAvailability",
      "Staff not found",
      "custom",
      404
    );
  }

  const query = `
  select sts.id as "staffTimeSlotId", ts."startTime", ts."endTime", sts.status from staff_timeslots sts 
  join time_slots ts on ts.id = sts."timeSlotId" AND (ts."deletedAt" is null)
  where (sts."staffId" = :staffId AND 
  sts.status = :status AND
  ts."startTime" >= :startDate AND
  ts."startTime" <= :endDate AND
  sts."deletedAt" is null)
  order by ts."startTime" asc`;

  const availability = await db.sequelize.query(query, {
    raw: true,
    type: db.Sequelize.QueryTypes.SELECT,
    replacements: {
      staffId: staff.id,
      startDate,
      endDate,
      status: STAFF_AVAILABILITY_STATUS.AVAILABLE,
    },
    nest: true,
  });
  // availability.map((itr) => {
  //   itr.startTime = moment(itr.startTime).tz(timezone).format("LLLL");
  //   itr.endTime = moment(itr.endTime).tz(timezone).format("LLLL");
  // });
  return availability;
};

//get staff calender
const getStaffCalender = async (params, timezone = TIMEZONES.INDIA) => {
  let date = params.date,
    status = params.status,
    startDate = moment().tz(timezone).startOf("week").utc().format(),
    endDate = moment().tz(timezone).endOf("week").utc().format();

  if (date) {
    date = isValidDateTime(date);

    startDate = moment(date).tz(timezone).startOf("week").utc().format();
    endDate = moment(date).tz(timezone).endOf("week").utc().format();
  }

  if (status && !Object.values(STAFF_AVAILABILITY_STATUS).includes(status)) {
    throw new AppError(
      "getStaffAvailability",
      `Status can only be ${Object.values(STAFF_AVAILABILITY_STATUS).join(
        ", "
      )}`,
      "custom",
      412
    );
  }

  delete params.date;
  delete params.status;

  const staff = await getStaff(params);
  if (!staff) {
    throw new AppError(
      "getStaffAvailability",
      "Staff not found",
      "custom",
      404
    );
  }

  const query = `
  select sts.id as "staffTimeSlotId", ts."startTime", ts."endTime", sts.status
  from time_slots ts join staff_timeslots sts on sts."timeSlotId" = ts.id 
  and (sts."deletedAt" is null AND sts."staffId" = :staffId AND sts.status = any (Array [:status]))
  where (
    ts."deletedAt" is null
    AND ts."startTime" >= :startDate 
    AND ts."startTime" <= :endDate
    )
  order by ts."startTime" asc`;

  const calender = await db.sequelize.query(query, {
    raw: true,
    type: db.Sequelize.QueryTypes.SELECT,
    replacements: {
      staffId: staff.id,
      startDate,
      endDate,
      status: status ? [status] : Object.values(STAFF_AVAILABILITY_STATUS),
    },
    nest: true,
  });
  calender.map((itr) => {
    itr.startTime = moment(itr.startTime).tz(timezone).format("LLLL");
    itr.endTime = moment(itr.endTime).tz(timezone).format("LLLL");
  });
  return calender;
};

async function getStaffSlotsWithTime(params = {}) {
  return await StaffTimeslot.findAll({
    where: params,
    include: {
      model: Timeslot,
      required: true,
      as: "timeSlot",
    },
  });
}

async function updateStaffTimeSlots(data, params, transaction = null) {
  return await StaffTimeslot.update(data, { where: params, transaction });
}

async function getStaffs(params = {}, attributes = []) {
  return await Staff.findAll({
    where: params,
    attributes: attributes.length ? attributes : null,
  });
}

async function addStaffSlotsFromAvailability(
  { staffId, availability },
  timezone = TIMEZONES.INDIA
) {
  let staffTimeSlotData = [],
    momentObj = moment().tz(timezone);

  let weekCounter = 0;
  while (weekCounter < 7) {
    if (availability.hasOwnProperty(weekCounter)) {
      const firstXDayObj = getFirstXDayOfMonth(
        momentObj,
        weekCounter,
        timezone
      ).utc();
      let i = 0;

      while (
        moment(firstXDayObj)
          .tz(timezone)
          .add(7 * i, "days") < momentObj.endOf("month")
      ) {
        for (let hour of Array.from(Array(24).keys())) {
          const timeSlot = await getSlot({
            startTime: moment(firstXDayObj)
              .tz(timezone)
              .utc()
              .add(hour, "hour")
              .add(7 * i, "days")
              .format(),
          });

          if (!timeSlot) {
            break;
          }

          if (availability[weekCounter].includes(hour)) {
            staffTimeSlotData.push({
              staffId,
              timeSlotId: timeSlot.id,
              status: STAFF_AVAILABILITY_STATUS.AVAILABLE,
            });
          } else {
            staffTimeSlotData.push({
              staffId,
              timeSlotId: timeSlot.id,
              status: STAFF_AVAILABILITY_STATUS.UNAVAILABLE,
            });
          }
        }
        i++;
      }
    } else {
      const firstXDayObj = getFirstXDayOfMonth(
        momentObj,
        weekCounter,
        timezone
      ).utc();

      let i = 0;
      while (
        moment(firstXDayObj)
          .tz(timezone)
          .add(7 * i, "days") < momentObj.endOf("month")
      ) {
        for (let hour of Array.from(Array(24).keys())) {
          const timeSlot = await getSlot({
            startTime: moment(firstXDayObj)
              .tz(timezone)
              .utc()
              .add(hour, "hour")
              .add(7 * i, "days")
              .format(),
          });

          if (!timeSlot) {
            break;
          }

          staffTimeSlotData.push({
            staffId,
            timeSlotId: timeSlot.id,
            status: STAFF_AVAILABILITY_STATUS.UNAVAILABLE,
          });
        }
        i++;
      }
    }
    weekCounter++;
  }
  await StaffTimeslot.bulkCreate(staffTimeSlotData);
  return;
}

async function addStaffSlotsCron(timezone = TIMEZONES.INDIA) {
  const staffs = await Staff.findAll({});
  if (!staffs.length) {
    return "No Staffs found";
  }
  for (let staff of staffs) {
    let staffTimeSlotData = [];
    if (!staff.availability) {
      logger.warn(`Availability not found for ${staff.name}`);
      continue;
    }
    const availability = JSON.parse(JSON.stringify(staff.availability));

    const query = `
    select sts.id, ts."startTime" from staff_timeslots sts 
    join time_slots ts on ts.id = sts."timeSlotId" and (ts."deletedAt" is null) 
    where sts."deletedAt" is null and 
    (sts."staffId" = :staffId) 
    order by ts."startTime" desc limit 1`;

    const lastStaffSlot = (
      await db.sequelize.query(query, {
        raw: true,
        type: db.Sequelize.QueryTypes.SELECT,
        replacements: {
          staffId: staff.id,
        },
      })
    )[0];

    let totalDays, momentObj;

    if (lastStaffSlot) {
      totalDays = moment(lastStaffSlot.startTime)
        .tz(timezone)
        .add(5, "days")
        .daysInMonth();
      momentObj = moment(lastStaffSlot.startTime).tz(timezone).add(5, "days");
    } else {
      totalDays = moment().tz(timezone).daysInMonth();
      momentObj = moment().tz(timezone);
    }

    let weekCounter = 0;
    while (weekCounter < 7) {
      if (availability.hasOwnProperty(weekCounter)) {
        const firstXDayObj = getFirstXDayOfMonth(
          momentObj,
          weekCounter,
          timezone
        ).utc();
        let i = 0;

        while (
          moment(firstXDayObj)
            .tz(timezone)
            .add(7 * i, "days") < momentObj.endOf("month")
        ) {
          for (let hour of Array.from(Array(24).keys())) {
            const timeSlot = await getSlot({
              startTime: moment(firstXDayObj)
                .tz(timezone)
                .utc()
                .add(hour, "hour")
                .add(7 * i, "days")
                .format(),
            });

            if (!timeSlot) {
              break;
            }

            if (availability[weekCounter].includes(hour)) {
              staffTimeSlotData.push({
                staffId: staff.id,
                timeSlotId: timeSlot.id,
                status: STAFF_AVAILABILITY_STATUS.AVAILABLE,
              });
            } else {
              staffTimeSlotData.push({
                staffId: staff.id,
                timeSlotId: timeSlot.id,
                status: STAFF_AVAILABILITY_STATUS.UNAVAILABLE,
              });
            }
          }
          i++;
        }
      } else {
        const firstXDayObj = getFirstXDayOfMonth(
          momentObj,
          weekCounter,
          timezone
        ).utc();

        let i = 0;
        while (
          moment(firstXDayObj)
            .tz(timezone)
            .add(7 * i, "days") < momentObj.endOf("month")
        ) {
          for (let hour of Array.from(Array(24).keys())) {
            const timeSlot = await getSlot({
              startTime: moment(firstXDayObj)
                .tz(timezone)
                .utc()
                .add(hour, "hour")
                .add(7 * i, "days")
                .format(),
            });

            if (!timeSlot) {
              break;
            }

            staffTimeSlotData.push({
              staffId: staff.id,
              timeSlotId: timeSlot.id,
              status: STAFF_AVAILABILITY_STATUS.UNAVAILABLE,
            });
          }
          i++;
        }
      }
      weekCounter++;
    }
    await StaffTimeslot.bulkCreate(staffTimeSlotData);
    logger.info(
      `Added slots for the month of ${momentObj.format("MMMM")} for ${
        staff.name
      }`
    );
  }
  return "Staff slots added successfully";
}

async function deleteStaff(params) {
  const reference = "deleteStaff";
  const staff = await Staff.findOne({
    where: params,
    attributes: {
      include: [
        [
          db.sequelize.cast(
            db.sequelize.literal(`COUNT("assignedRequests".id)`),
            "INTEGER"
          ),
          "requestsCount",
        ],
      ],
    },
    include: [
      {
        model: MaintenanceRequest,
        as: "assignedRequests",
        required: false,
        attributes: [],
      },
    ],
    group: "Staff.id",
  });

  if (!staff) {
    throw new AppError(reference, "Staff not found", "custom", 404);
  }

  if (staff.get("requestsCount")) {
    throw new AppError(
      reference,
      "Request(s) exist for the staff",
      "custom",
      412
    );
  }
  await staff.destroy();
}

const getStaffForExport = async (params) => {
  const reference = "getStaffForExport";
  if (
    params.designation &&
    !Object.keys(DESIGNATION_TYPES).includes(params.designation)
  ) {
    {
      throw new AppError(
        reference,
        `Designations can only be ${Object.keys(DESIGNATION_TYPES).join(", ")}`,
        "custom",
        412
      );
    }
  }
  if (
    params.department &&
    !Object.keys(DEPARTMENT_TYPES).includes(params.department)
  ) {
    {
      throw new AppError(
        reference,
        `Departments can only be ${Object.keys(DEPARTMENT_TYPES).join(", ")}`,
        "custom",
        412
      );
    }
  }

  const staffs = await Staff.findAll({
    where: params,
    attributes: [
      "name",
      "countryCode",
      "mobileNumber",
      "department",
      "designation",
      "appointment",
      "availability",
    ],
  });
  return staffs;
};

module.exports = {
  getDepartments,
  getDesignations,
  getAppointments,
  createStaff,
  getStaffDetails,
  getAllStaffs,
  editStaffDetails,
  getStaff,
  getStaffWithDepartmentNames,
  addStaffSlotsForMonth,
  getStaffAvailability,
  getStaffSlotsWithTime,
  updateStaffTimeSlots,
  addStaffSlots,
  getStaffCalender,
  changeStaffSlotStatus,
  getStaffs,
  addStaffSlotsCron,
  deleteStaff,
  getStaffForExport,
};
