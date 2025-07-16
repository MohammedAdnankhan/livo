module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('tenant_users_permission', {
      role_id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false
      },
      role_name: {
        type: Sequelize.STRING,
        allowNull: false
      },
      tenant_id: {
        type: Sequelize.UUID,
        allowNull: false
      },
      modules: {
        type: Sequelize.JSONB,
        allowNull: false
      }
    });
  },
  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('tenant_users_permission');
  }
}; 