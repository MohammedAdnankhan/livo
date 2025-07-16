module.exports.requestAssignment = ({
  staffName,
  category,
  flatName,
  floor,
  buildingName,
  staffTime,
}) => {
  return `A visit is scheduled between ${staffTime} at ${flatName}, floor ${floor}, ${buildingName} for ${category} request`;
};
