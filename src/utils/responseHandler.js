const sendResponse = (res, data = null, message = null, statusCode = 200) => {
  return res.status(statusCode).json({
    status: "success",
    msg: message,
    data,
  });
};

module.exports = { sendResponse };
