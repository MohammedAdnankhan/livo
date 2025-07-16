const moment = require("moment-timezone");
const { Op } = require("sequelize");
const {
  COMMON_DATE_FORMAT,
  PPM_FREQUENCIES,
  MONTHS,
  WEEK_DAYS,
} = require("../config/constants");
const { AppError } = require("./errorHandler");
const bcrypt = require("bcryptjs");
const logger = require("./logger");

function enableSearch(params, field, language) {
  field = language ? `${field}_${language}` : field;
  if (params.search) {
    params[field] = {
      [Op.iLike]: `%${params.search}%`,
    };
    delete params.search;
  }
}
function enableDateSearch(params, field, timezone) {
  if (params.date) {
    params[field] = {
      [Op.gt]: moment.tz(params.date, timezone).startOf("day").format(),
      [Op.lt]: moment.tz(params.date, timezone).endOf("day").format(),
    };
    delete params.date;
  }
}

function getDateTimeObject(dateTimeStr) {
  try {
    if (dateTimeStr && moment(dateTimeStr).isValid()) {
      return moment(dateTimeStr).toDate();
    } else {
      throw new AppError("getDateTimeObject", "Invalid Date Format");
    }
  } catch (error) {
    throw error;
  }
}

function getDateTimeObjectFromTimezone(dateTimeStr, timezone, identifier = 0) {
  try {
    if (!timezone || !dateTimeStr) {
      throw new AppError(
        "getDateTimeObjectFromTimezone",
        "timezone and date-time string both are required"
      );
    }

    if (
      dateTimeStr &&
      moment.tz(dateTimeStr, COMMON_DATE_FORMAT, timezone).isValid()
    ) {
      const time = moment.tz(dateTimeStr, COMMON_DATE_FORMAT, timezone);
      if (identifier && identifier === 1) {
        time.startOf("day");
      }
      if (identifier && identifier === 2) {
        time.endOf("day");
      }
      return time.toDate();
    } else {
      throw new AppError(
        "getDateTimeObjectFromTimezone",
        "Invalid Date Format"
      );
    }
  } catch (error) {
    throw error;
  }
}

function generateVisitoCode() {
  let code = `${Math.floor(Math.random() * 9 + 1)}`;
  for (let i = 1; i < 4; i++) {
    code += `${Math.floor(Math.random() * 10)}`;
  }
  return code;
}

function swap(arr, x, y) {
  const temp = arr[x];
  arr[x] = arr[y];
  arr[y] = temp;
}

function isValidPhoneNumber(number) {
  if (!isNaN(number) && number && number.length >= 4 && number.length <= 12) {
    return true;
  }

  return false;
}

function calucatePercent(number, percent) {
  return (number * percent) / 100;
}

function isValidDateTime(date) {
  const format = "DD-MM-YYYY";

  if (!moment(date, format, true).isValid()) {
    throw new AppError("isValidDateTime", "Enter valid timings", "custom", 422);
  }

  return moment(date, COMMON_DATE_FORMAT).toDate();
}

function getFirstXDayOfMonth(date, day, timezone) {
  let result = moment(date).tz(timezone).startOf("month");
  while (result.day() !== day) {
    result.add(1, "day");
  }

  if (moment(date).subtract(1, "day").isBefore(result)) return result;

  while (result.day() !== day) {
    result.add(1, "day");
  }
  return result;
}

function extractAvailabilityFromTimings(
  days,
  workStart,
  workEnd,
  breakStart,
  breakEnd
) {
  if (
    !days.length ||
    workStart > workEnd ||
    breakStart > breakEnd ||
    breakStart == breakEnd
  ) {
    throw new AppError(
      "extractAvailabilityFromTimings",
      "Enter valid availability",
      "custom",
      422
    );
  }
  let availability = {};
  const hours = Array.from(Array(24).keys());
  const breakHours = hours.slice(breakStart, breakEnd);
  const workingHours = hours
    .slice(workStart, workEnd)
    .filter((time) => !breakHours.includes(time));

  days.map((day) => {
    if (!availability.hasOwnProperty(day)) {
      availability[day] = workingHours;
    }
  });
  return availability;
}

function sanitisePayload(payload) {
  for (const key in payload) {
    !payload[key] && delete payload[key];

    if (key === "search" && payload[key]) {
      payload[key] = payload[key].replace(/'/g, "");
    }
  }
  return payload;
}

function markObjectAsNull(obj) {
  if (Object.keys(obj).every((key) => !obj[key])) {
    return null;
  } else {
    return obj;
  }
}

function getRandomChar(str) {
  return str.charAt(Math.floor(Math.random() * str.length));
}

function generatePassword() {
  const groups = [
    "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
    "abcdefghijklmnopqrstuvwxyz",
    "1234567890",
    "!@#$%^&*",
  ];
  let password = "";

  for (let i = 0; i < 2; i++) {
    groups.forEach((group) => {
      password += getRandomChar(group);
    });
  }
  return password;
}

async function hashPassword(password) {
  return await bcrypt.hash(password, 10);
}

/**
 * @function validatePassword
 * @param {string} plainString
 * @param {string} hashString
 * @returns {Promise<boolean>}
 * @description Function to validate plain and hashed string using bcryptjs
 */
async function validatePassword(plainString, hashString) {
  return await bcrypt.compare(plainString, hashString);
}

function isValidUUID(uuid) {
  const regex =
    /^[0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12}$/gi;
  return regex.test(uuid);
}

function validateCron(cron, frequency, reference = "validateCron") {
  if (!Array.isArray(cron) || cron?.length != 7) {
    throw new AppError(reference, "Enter valid pattern", "custom", 412);
  }
  if (+cron[0] || +cron[1] || +cron[2] || cron[6] !== "*") {
    throw new AppError(reference, "Invalid pattern", "custom", 412);
  }
  switch (frequency) {
    case PPM_FREQUENCIES.DAILY:
      if (cron[3] !== "?" || cron[4] !== "*" || cron[5] !== "*") {
        throw new AppError(
          reference,
          "Invalid pattern for daily frequency",
          "custom",
          412
        );
      }
      break;
    case PPM_FREQUENCIES.MONTHLY:
      if (
        +cron[3] < 1 ||
        +cron[3] > 28 ||
        !/\//.test(cron[4]) ||
        +cron[4].split("/")[0] !== 1 ||
        +cron[4].split("/")[1] < 1 ||
        +cron[4].split("/")[1] > 6 ||
        cron[5] !== "?"
      ) {
        throw new AppError(
          reference,
          "Invalid pattern for monthly frequency",
          "custom",
          412
        );
      }
      break;
    case PPM_FREQUENCIES.YEARLY:
      if (
        +cron[3] < 1 ||
        +cron[3] > 28 ||
        +cron[4] < 1 ||
        +cron[4] > 12 ||
        cron[5] !== "?"
      ) {
        throw new AppError(
          reference,
          "Invalid pattern for yearly frequency",
          "custom",
          412
        );
      }
      break;
    case PPM_FREQUENCIES.WEEKLY:
      if (
        cron[3] !== "?" ||
        cron[4] !== "*" ||
        !/^(?:[1-7],)*[1-7]$/.test(cron[5])
      ) {
        throw new AppError(reference, "Invalid pattern for weekly frequency");
      }
      break;
    default:
      logger.error(`No case matched for PPM frequency`);
      throw new AppError(
        reference,
        "Case invalid for PPM frequency",
        "custom",
        412
      );
  }
}

function describeCron(cron, frequency, reference = "describeCron") {
  let expression = "";
  switch (frequency) {
    case PPM_FREQUENCIES.DAILY:
      expression = "Everyday";
      break;
    case PPM_FREQUENCIES.MONTHLY:
      expression = `On day ${+cron[3]} of the month every ${+cron[4].split(
        "/"
      )[1]} month${+cron[4].split("/")[1] > 1 && "s"}`;
      break;
    case PPM_FREQUENCIES.YEARLY:
      expression = `On day ${+cron[3]} in ${MONTHS[+cron[4]]}`;
      break;
    case PPM_FREQUENCIES.WEEKLY:
      const weekArray = cron[5].split(",");
      expression = `On ${weekArray.map((week, index) => {
        if (index + 1 == weekArray.length) {
          return `and ${WEEK_DAYS[week]}`;
        } else {
          return `${WEEK_DAYS[week]}`;
        }
      })}`;
      break;
    default:
      logger.error(`No case matched for PPM frequency`);
      break;
  }
  return expression;
}

/**
 * @function isArrayEmpty
 * @param {any[]} arr
 * @description Utility function to check if an array is empty or not
 * @returns {boolean}
 */
function isArrayEmpty(arr) {
  for (const value of arr) {
    if (value) {
      return false;
    }
  }
  return true;
}

/**
 * @function isObjEmpty
 * @param {object} obj
 * @returns {boolean}
 * @description Function to check if an object is empty or not
 */
function isObjEmpty(obj) {
  for (const key in obj) {
    if (key in obj) {
      return false;
    }
  }
  return true;
}

module.exports = {
  enableSearch,
  getDateTimeObject,
  enableDateSearch,
  generateVisitoCode,
  getDateTimeObjectFromTimezone,
  swap,
  isValidPhoneNumber,
  calucatePercent,
  isValidDateTime,
  getFirstXDayOfMonth,
  extractAvailabilityFromTimings,
  sanitisePayload,
  markObjectAsNull,
  generatePassword,
  hashPassword,
  isValidUUID,
  validateCron,
  describeCron,
  isArrayEmpty,
  validatePassword,
  isObjEmpty,
};
