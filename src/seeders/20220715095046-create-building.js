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
      "buildings",
      [
        {
          id: "5b138480-b511-11ec-a58d-7980e53a0e68",
          name_en: "Omar Apartment",
          name_ar: "Omar Apartment",
          localityId: "2e941190-b511-11ec-a58d-7980e53a0e68",
          address_en: null,
          address_ar: null,
          pinCode: null,
          location: null,
          buildingType: null,
          governmentPropertyId: null,
          url: null,
          documents: null,
          images: null,
          description_en: null,
          description_ar: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null,
        },
        {
          id: "08ec1a70-8f1c-11ec-9718-677b08ade66c",
          name_en: "Emaar Apartment",
          name_ar: "شقق إعمار",
          localityId: "a2b11480-9881-11ec-9127-c9fb6879ad72",
          address_en: null,
          address_ar: null,
          pinCode: null,
          location: null,
          buildingType: null,
          governmentPropertyId: null,
          url: null,
          documents: null,
          images: null,
          description_en: null,
          description_ar: null,
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
