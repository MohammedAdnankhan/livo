module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Add modules JSONB column
    await queryInterface.addColumn('tenant_table', 'modules', {
      type: Sequelize.JSONB,
      allowNull: true,
      defaultValue: {},
    });
    // Remove old boolean fields if they exist
    await Promise.all([
      queryInterface.removeColumn('tenant_table', 'leasing').catch(() => {}),
      queryInterface.removeColumn('tenant_table', 'fm').catch(() => {}),
      queryInterface.removeColumn('tenant_table', 'visitor_management').catch(() => {}),
    ]);
  },
  down: async (queryInterface, Sequelize) => {
    // Remove modules column
    await queryInterface.removeColumn('tenant_table', 'modules');
    // Optionally, add back the old boolean fields
    await queryInterface.addColumn('tenant_table', 'leasing', {
      type: Sequelize.BOOLEAN,
      defaultValue: false,
    });
    await queryInterface.addColumn('tenant_table', 'fm', {
      type: Sequelize.BOOLEAN,
      defaultValue: false,
    });
    await queryInterface.addColumn('tenant_table', 'visitor_management', {
      type: Sequelize.BOOLEAN,
      defaultValue: false,
    });
  }
}; 