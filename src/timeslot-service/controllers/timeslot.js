const Timeslot = require("../models/Timeslot");
const moment = require("moment-timezone");
const { TIMEZONES } = require("../../config/constants");
const {
  getDateTimeObjectFromTimezone,
  isValidDateTime,
} = require("../../utils/utility");
const db = require("../../database");

async function getTimeSlots(params = {}, timezone = TIMEZONES.INDIA) {
  let startDate = moment().startOf("week").utc().format(),
    endDate = moment().endOf("week").utc().format();

  if (params.date) {
    params.date = isValidDateTime(params.date);

    startDate = moment(params.date).startOf("week").utc().format();
    endDate = moment(params.date).endOf("week").utc().format();
  }

  const query = `
  SELECT id, "startTime", "endTime" FROM time_slots
  where ("deletedAt" IS NULL AND ("startTime" >= :startDate AND "startTime" <= :endDate))
  order by "startTime" ASC`;

  const timeSlots = await db.sequelize.query(query, {
    raw: true,
    type: db.Sequelize.QueryTypes.SELECT,
    replacements: {
      startDate,
      endDate,
    },
  });
  timeSlots.map((itr) => {
    itr.startTime = moment.utc(itr.startTime).tz(timezone).format("LLLL");
    itr.endTime = moment.utc(itr.endTime).tz(timezone).format("LLLL");
  });
  return timeSlots;
}

// async function addTimeSlots() {
//   const totalDays = moment().add(25, "days").daysInMonth();
//   const startDate = moment().add(25, "days");

//   let data = [];

//   //loop over total/remaining days in current month
//   for (let i = 0; i < totalDays; i++) {
//     const hoursArray = Array.from(Array(24).keys());

//     //loop over the timeslots in a day
//     for (const hour of hoursArray) {
//       const start = moment(startDate).startOf("month");
//       const obj = {
//         startTime: moment(start).add(hour, "hours").add(i, "days").format(),
//         endTime: moment(start)
//           .add(hour + 1, "hours")
//           .add(i, "days")
//           .format(),
//       };
//       data.push(obj);
//     }
//   }
//   return { one: data[0], two: data[1], three: data[2] };
//   // const timeSlots = await Timeslot.bulkCreate(data);
//   return `Created ${timeSlots.length} rows for the month of ${moment()
//     .add(25, "days")
//     .format("MMMM")}`;
// }

async function getSlots(params = {}) {
  return await Timeslot.findAll({
    where: params,
    order: [["startTime", "ASC"]],
  });
}

async function getSlot(params = {}) {
  return await Timeslot.findOne({
    where: params,
  });
}

async function addTimeSlots(timezone = TIMEZONES.INDIA) {
  const { startTime } =
    (
      await Timeslot.findAll({ order: [["startTime", "DESC"]], limit: 1 })
    )?.[0] || {};

  let data = [],
    month;

  if (startTime) {
    const totalDays = moment().add(25, "days").daysInMonth();
    let slotsArray = Array.from(Array(totalDays * 24).keys());
    slotsArray.map((slot, index) => {
      data.push({
        startTime: moment(startTime)
          .add(index + 1, "hours")
          .utc()
          .format(),
        endTime: moment(startTime)
          .add(index + 2, "hours")
          .utc()
          .format(),
      });
    });
    month = moment().add(25, "days").format("MMMM");
  } else {
    const startDate = moment().startOf("month").utc();
    const totalDays = moment().daysInMonth();
    let slotsArray = Array.from(Array(totalDays * 24).keys());
    slotsArray.map((slot, index) => {
      data.push({
        startTime: moment(startDate).add(index, "hours").utc().format(),
        endTime: moment(startDate)
          .add(index + 1, "hours")
          .utc()
          .format(),
      });
    });
    month = moment().format("MMMM");
  }
  const timeSlots = await Timeslot.bulkCreate(data);
  return `Created ${timeSlots.length} rows for the month of ${month}`;
}

module.exports = {
  addTimeSlots,
  getTimeSlots,
  getSlots,
  getSlot,
};
