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
      "administrators",
      [
        {
          id: "d24ed6d3-eaba-4331-ac66-b65ef6287323",
          password:
            "$2a$10$M1BxIZq5yV7jOb9Yiw3ZXeayEHMIm1.9z.dAm.WQnnIVvGT3u2vpe", // Livo@5578
          email: "radhikasingh051989@gmail.com",
          countryCode: "971",
          mobileNumber: "971557821449",
          name: "Radhika Singh",
          buildingId: null,
          role: "Master Admin",
          profilePicture: null,
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
