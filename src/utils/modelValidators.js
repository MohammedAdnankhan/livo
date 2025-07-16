function minLength(len) {
  return {
    len: {
      args: [len],
      msg: `Length should be more than ${len}`,
    },
  };
}

function maxLength(len) {
  return {
    len: {
      args: [0, len],
      msg: `Length should be less than ${len}`,
    },
  };
}

function isPhoneNumber() {
  return {
    isNumeric: true,
    len: {
      args: [4, 12],
      msg: `Invalid Mobile Number`,
    },
  };
}

function acceptedValues(valueArray, msg) {
  return {
    isIn: {
      args: [valueArray],
      msg,
    },
  };
}

module.exports = {
  minLength,
  isPhoneNumber,
  acceptedValues,
  maxLength,
};
