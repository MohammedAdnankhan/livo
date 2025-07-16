const { DataTypes } = require("sequelize");
const {
  DEPARTMENT_TYPES,
  DESIGNATION_TYPES,
  APPOINTMENT_TYPES,
} = require("../../config/constants");
const db = require("../../database");
const {
  isPhoneNumber,
  acceptedValues,
} = require("../../utils/modelValidators");
const Property = require("../../property-service/models/Property");
const StaffTimeslot = require("./StaffTimeslot");

const Staff = db.sequelize.define(
  "Staff",
  {
    id: {
      type: DataTypes.UUID,
      allowNull: false,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: {
        isEmail: {
          args: true,
          msg: "Please enter a valid Email.",
        },
      },
    },
    countryCode: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    mobileNumber: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: {
        ...isPhoneNumber(),
      },
    },
    password: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        len: {
          args: [6],
          msg: "Password should be at least 6 characters long.",
        },
      },
    },
    profilePicture: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    department: {
      type: DataTypes.STRING,
      validate: {
        ...acceptedValues(Object.keys(DEPARTMENT_TYPES), "Invalid department"),
      },
    },
    designation: {
      type: DataTypes.STRING,
      validate: {
        ...acceptedValues(
          Object.keys(DESIGNATION_TYPES),
          "Invalid designation"
        ),
      },
    },
    appointment: {
      type: DataTypes.STRING,
      validate: {
        ...acceptedValues(
          Object.keys(APPOINTMENT_TYPES),
          "Invalid appointment"
        ),
      },
    },
    nationality: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    emiratesId: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    passportDocument: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    passportNumber: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    buildingId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    propertyId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    visaDocument: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    offerLetterDocument: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    availability: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: {
        1: [10, 11, 12, 13, 15, 16, 17, 18, 19, 20, 21],
        2: [10, 11, 12, 13, 15, 16, 17, 18, 19, 20, 21],
        3: [10, 11, 12, 13, 15, 16, 17, 18, 19, 20, 21],
        4: [10, 11, 12, 13, 15, 16, 17, 18, 19, 20, 21],
        5: [10, 11, 12, 13, 15, 16, 17, 18, 19, 20, 21],
        6: [10, 11, 12, 13, 15, 16, 17, 18, 19, 20, 21],
      },
    },
  },
  {
    tableName: "staffs",
    paranoid: true,
    defaultScope: {
      attributes: {
        exclude: ["createdAt", "updatedAt", "deletedAt"],
      },
    },
    hooks: {
      afterDestroy: async function (instance, options) {
        await Promise.allSettled([
          db.sequelize.query(
            `DELETE FROM "staff_flats" WHERE "staffId" = :staffId`,
            {
              type: db.Sequelize.QueryTypes.DELETE,
              replacements: {
                staffId: instance.dataValues.id,
              },
            }
          ),
          StaffTimeslot.destroy({
            where: {
              staffId: instance.dataValues.id,
            },
            force: true,
          }),
        ]);
      },
    },
  }
);

Staff.belongsTo(Property, {
  foreignKey: "propertyId",
  as: "property",
});

// Staff.sync({ force: true });
// Staff.sync({ alter: true });

module.exports = Staff;
