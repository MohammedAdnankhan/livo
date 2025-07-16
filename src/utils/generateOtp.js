exports.generateOTP = () => {
  let otp = "";
  for (let i = 0; i < 4; i++) {
    otp += `${Math.floor(Math.random() * 9 + 1)}`;
  }
  return otp;
};
