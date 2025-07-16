/**
 * @typedef {Object} IBaseSubFlat
 * @property {string} name_en - Name in English
 * @property {string} name_ar - Name in Arabic
 * @property {string} size - size
 * @property {string} flatId - flatId
 * @property {string[]} images - Images Array
 * @property {import("../../utils/types").IDocument[]} documents - Documents Array
 */

/**
 * @typedef {Object} ICreateSubFlats
 * @property {string} flatId
 * @property {IBaseSubFlat[]} subFlats
 */

module.exports = {};
