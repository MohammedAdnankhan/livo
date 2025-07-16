module.exports.formGroupOfIds = async (req, res, next) => {
  const ownerIdsString = req.query.ownerIds;
  const flatIdsString = req.query.flatIds;

  if (ownerIdsString && typeof ownerIdsString === "string") {
    const ownerIdsArray = ownerIdsString.split(",").map((uuid) => uuid.trim());
    req.query.ownerIds = ownerIdsArray;
  }

  if (flatIdsString && typeof flatIdsString === "string") {
    const flatIdsArray = flatIdsString.split(",").map((uuid) => uuid.trim());
    req.query.flatIds = flatIdsArray;
  }
  next();
};
