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
      "helpline_numbers",
      [
        {
          id: "998d7a2e-789c-4fad-aada-dff2a1a63496",
          name_en: "Reception",
          name_ar: "Reception",
          contactNumber: "971553336697",
          image:
            "https://livoprod.s3.us-east-2.amazonaws.com/Reception-1657900090679.png",
          buildingId: "5b138480-b511-11ec-a58d-7980e53a0e68",
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null,
        },
        {
          id: "b444c227-9c6b-4f95-b95b-513648d20fb5",
          name_en: "Reception",
          name_ar: "Reception",
          contactNumber: "971553336697",
          image:
            "https://livoprod.s3.us-east-2.amazonaws.com/Reception-1657900090679.png",
          buildingId: "08ec1a70-8f1c-11ec-9718-677b08ade66c",
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null,
        },
        {
          id: "6b222b76-c7e1-4cb8-bdf4-d2ce54bc7840",
          name_en: "Lifeguard",
          name_ar: "Lifeguard",
          contactNumber: "971553776720",
          image:
            "https://livoprod.s3.us-east-2.amazonaws.com/Lifeguard-1657900090679.png",
          buildingId: "08ec1a70-8f1c-11ec-9718-677b08ade66c",
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null,
        },
        {
          id: "2c974a02-e0b0-4c82-8874-f976aff9e821",
          name_en: "Lifeguard",
          name_ar: "Lifeguard",
          contactNumber: "971553776720",
          image:
            "https://livoprod.s3.us-east-2.amazonaws.com/Lifeguard-1657900090679.png",
          buildingId: "5b138480-b511-11ec-a58d-7980e53a0e68",
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null,
        },
        {
          id: "0b5f1682-1d6e-446e-a9c2-91da2e658765",
          name_en: "Helpdesk",
          name_ar: "Helpdesk",
          contactNumber: "971550013794",
          image:
            "https://livoprod.s3.us-east-2.amazonaws.com/Helpdesk-1657900090679.png",
          buildingId: "5b138480-b511-11ec-a58d-7980e53a0e68",
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null,
        },
        {
          id: "ecfc9f42-d398-4959-9bb7-2a8df4b20f56",
          name_en: "Helpdesk",
          name_ar: "Helpdesk",
          contactNumber: "971550013794",
          image:
            "https://livoprod.s3.us-east-2.amazonaws.com/Helpdesk-1657900090679.png",
          buildingId: "08ec1a70-8f1c-11ec-9718-677b08ade66c",
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null,
        },
        {
          id: "f8d9355b-b064-433a-b88f-b5a4eb8f9d52",
          name_en: "Electrician and Repair",
          name_ar: "Electrician and Repair ar",
          contactNumber: "971550712541",
          image:
            "https://livoprod.s3.us-east-2.amazonaws.com/Electrician-And-Repair-1657900090679.png",
          buildingId: "08ec1a70-8f1c-11ec-9718-677b08ade66c",
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null,
        },
        {
          id: "a6b6744b-32fd-4a2c-99bb-559a2d65ad9f",
          name_en: "Electrician and Repair",
          name_ar: "Electrician and Repair ar",
          contactNumber: "971550712541",
          image:
            "https://livoprod.s3.us-east-2.amazonaws.com/Electrician-And-Repair-1657900090679.png",
          buildingId: "5b138480-b511-11ec-a58d-7980e53a0e68",
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
