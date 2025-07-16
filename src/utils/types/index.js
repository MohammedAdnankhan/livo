/**
 * @typedef {Object} IDocument
 * @property {string} name - Name of File
 * @property {string} type - Mime type of file
 * @property {string} url - URL of file
 * @property {string} uid - uid associated to the file
 */

/**
 * @typedef {Object} IPagination
 * @property {number} offset - Offset for data
 * @property {number} limit -  Total data to be shown
 */

/**
 * @typedef {Object} IJwtPayload
 * @property {string} id
 * @property {"admin" | "owner" | "user" | "guard"} type
 * @property {number} iat
 * @property {number} exp
 */

module.exports = {};
