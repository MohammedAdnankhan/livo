"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    /**
     * Add seed commands here.
     *
     * Example:
     * await queryInterface.bulkInsert('People', [{
     *   name: 'John Doe',
     *   isBetaMember: false
     * }], {});
     */
    await queryInterface.bulkInsert(
      "cities",
      [
        {
          id: "2d654f20-9881-11ec-9127-c9fb6879ad72",
          name_en: "Dubai",
          name_ar: "دبي",
          country_en: "United Arab Emirates",
          country_ar: "الإمارات العربية المتحدة",
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null,
        },
        {
          id: "4bdecdd0-8f19-11ec-81c4-9d6872640837",
          name_en: "Abu Dhabi",
          name_ar: "Abu Dhabi",
          country_en: "United Arab Emirates",
          country_ar: "الإمارات العربية المتحدة",
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null,
        },
      ],
      {}
    );
  },

  async down(queryInterface, Sequelize) {
    /**
     * Add commands to revert seed here.
     *
     * Example:
     * await queryInterface.bulkDelete('People', null, {});
     */
  },
};
