/**
 * @function calculateSuccessAndFailures
 * @param {Array} requests
 * @returns {string}
 * @description Function to return the no of success and no of failure messages
 */
exports.calculateSuccessAndFailures = (result, value) => {
  const { success, failure } = result.reduce(
    (acc, data) => {
      if (data.success) {
        acc.success++;
      } else {
        acc.failure++;
      }
      return acc;
    },
    { success: 0, failure: 0 }
  );

  let message = `${value} created successfully`;
  if (failure) {
    if (success) {
      message = `${success} succeeded , ${failure} failed`;
    } else if (!success && failure > 1) {
      message = `All ${value} creation failed`;
    } else if (!success && failure === 1) {
      message = `${value} creation failed`;
    } else {
      message = `${failure} failed`;
    }
  }
  if (success > 1) {
    message = `${value}s created successfully`;
  }
  return message;
};
