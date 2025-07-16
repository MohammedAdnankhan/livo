const logger = require("./logger");

class AppError extends Error {
  constructor(
    reference = "Anonymous",
    msg = "Invalid Body!",
    name = "custom",
    errorCode = 200,
    errors = []
  ) {
    super(msg);
    this.name = name;
    this.errors = errors;
    this.errorCode = errorCode;
    this.reference = reference;
  }
}

exports.AppError = AppError;

function errorHandler(error, res) {
  let errorCode = error.errorCode || 500;
  let msg = error.message || null;
  let errors = error.errors || [];
  let reference = error.reference || "Anonymous";

  if (
    error.name === "SequelizeValidationError" ||
    /^SequelizeValidationError/.test(error.message)
  ) {
    errorCode = 200;
    msg = "Invalid Body";
    errors = errors.map((err) => {
      return {
        column: err.path,
        message: err.message,
        type: err.type,
      };
    });
  } else if (error.name === "SequelizeUniqueConstraintError") {
    errorCode = 200;
    msg = "Duplicate Key Violates unique constraint";
    errors = errors.map((err) => {
      return {
        column: err.path,
        message: err.message,
        type: err.type,
      };
    });
  } else if (
    error.name === "SequelizeForeignKeyConstraintError" ||
    /^SequelizeForeignKeyConstraintError/.test(error.message)
  ) {
    errorCode = 500;
    msg = "Insert Or Update Violates the foreign key constraint";
  } else if (error.name === "SequelizeDatabaseError") {
    errorCode = 200;
    msg = "Invalid Body";
    errors = [];
  } else if (error.name === "custom") {
  } else {
    console.log(error, error.message);
    msg = "Server Error!";
  }

  logger.error(
    `Error: {reference: ${reference}, message: ${msg}, errorCode: ${errorCode}, errors: ${JSON.stringify(
      errors
    )}, error: ${error.message}}`
  );

  return res.status(errorCode).json({
    status: "fail",
    msg,
    errorCode,
    errors,
  });
}

exports.errorHandler = errorHandler;
