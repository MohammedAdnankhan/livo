const CryptoJS = require("crypto-js");
const env = process.env.NODE_ENV || "development";
const encryptionConfig = require("../config/encryption.json")[env];

const { SECRET_KEY } = encryptionConfig;

const key = CryptoJS.SHA256("LIVO-" + SECRET_KEY).toString();

function encrypt(plainText) {
  return CryptoJS.AES.encrypt(plainText, key).toString();
}

function decrypt(encryptedText) {
  const bytes = CryptoJS.AES.decrypt(encryptedText, key);
  return bytes.toString(CryptoJS.enc.Utf8);
}

function compareCipher(plainText, encryptedText) {
  return plainText === decrypt(encryptedText);
}

module.exports = {
  encrypt,
  decrypt,
  compareCipher,
};
