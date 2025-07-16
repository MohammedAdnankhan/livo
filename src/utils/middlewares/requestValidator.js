const { AppError } = require("../errorHandler");
const { sanitisePayload } = require("../utility");

exports.validatePayload = ({ body = null, query = null, params = null }) => {
  return async (req, res, next) => {
    try {
      const reference = "validationError";
      if (body) {
        const { error, value } = body.validate(req.body);

        if (error) {
          throw new AppError(
            reference,
            error.message.replace(/\"/g, ""),
            "custom",
            412
          );
        }

        req.validatedBody = value;
      }

      if (params) {
        const { error, value } = params.validate(req.params);
        if (error) {
          throw new AppError(
            reference,
            error.message.replace(/\"/g, ""),
            "custom",
            412
          );
        }

        req.validatedParams = value;
      }
      if (query) {
        const { error, value } = query.validate(sanitisePayload(req.query));
        if (error) {
          throw new AppError(
            reference,
            error.message.replace(/\"/g, ""),
            "custom",
            412
          );
        }

        req.validatedQuery = value;
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};
