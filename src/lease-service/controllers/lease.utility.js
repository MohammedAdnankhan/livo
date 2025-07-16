/**
 * @function calculateTimePeriodInDays
 * @param {Date} startDate
 * @param {Date} endDate
 * @returns {string}
 * @description Function to return difference between dates in days
 */
exports.calculateTimePeriodInDays = (startDate, endDate) => {
  const startUtc = Date.UTC(
    startDate.getFullYear(),
    startDate.getMonth(),
    startDate.getDate()
  );
  const endUtc = Date.UTC(
    endDate.getFullYear(),
    endDate.getMonth(),
    endDate.getDate()
  );

  const timeDifferenceInDays = Math.floor(
    (endUtc - startUtc) / (1000 * 60 * 60 * 24)
  );
  return `${timeDifferenceInDays} ${timeDifferenceInDays > 1 ? "days" : "day"}`;
};
