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
      "localities",
      [
        {
          id: "a2b11480-9881-11ec-9127-c9fb6879ad72",
          name_en: "Al Ain",
          name_ar: "أل أين",
          cityId: "2d654f20-9881-11ec-9127-c9fb6879ad72",
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null,
        },
        {
          id: "d2ae8aa0-9881-11ec-9127-c9fb6879ad72",
          name_en: "Kalba",
          name_ar: "كلباء",
          cityId: "2d654f20-9881-11ec-9127-c9fb6879ad72",
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null,
        },
        {
          id: "e6649f80-9881-11ec-9127-c9fb6879ad72",
          name_en: "Liwa",
          name_ar: "ليوا",
          cityId: "2d654f20-9881-11ec-9127-c9fb6879ad72",
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null,
        },
        {
          id: "2e941190-b511-11ec-a58d-7980e53a0e68",
          name_en: "Al-Baraha",
          name_ar: "Al-Baraha",
          cityId: "2d654f20-9881-11ec-9127-c9fb6879ad72",
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
