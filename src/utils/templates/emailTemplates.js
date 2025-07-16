module.exports.serviceRequestForUser = ({ name, category, description }) => {
  return {
    subject: `${category} Request`,
    content: `Hey ${name}, 
    <br><br>
    Your Maintenance Request for ${category} - ${description} has been placed successfully.
    <br><br>
    Now all you have to do is sit back and relax, while we work our magic to get your request resolved ASAP! We will keep you posted on the status of your maintainance request.
    <br><br>
    For more details, please go to Maintenance request section of Resident App.
    <br><br>
    Regards <br>
    Team Livo`,
  };
};

module.exports.serviceRequestForAdmin = ({
  admin,
  flatName,
  floor,
  buildingName,
  serviceCategory,
  description,
}) => {
  return {
    subject: `${serviceCategory} Request for ${flatName}, floor ${floor}, ${buildingName}`,
    content: `
    Hey ${admin}, 
    <br><br>
    ${flatName}, floor ${floor}, ${buildingName} has requested for ${serviceCategory} - ${description}. Kindly Do the needful within 48hours.
    <br><br>
    If you need any assistance feel free to reach us at team@livo.ae OR contact us at +971-557821449. For more information visit our website  https://www.livo.ae/
    <br><br>
    Regards, <br>
    Team Livo`,
  };
};

module.exports.userApproved = ({ name }) => {
  return {
    subject: `Welcome aboard`,
    content: `Hello ${name},
    <br><br>
    Welcome to Livo! Thanks so much for signing-up.
    LIVO is a holistic community management platform that simplifies life for everyone in an organized community from residents to security guards and building management.
    For Any query or suggestions feel free to reach us at team@livo.ae
    <br><br>
    Regards, <br>
    Team Livo`,
  };
};

module.exports.userOnboardingInitiated = ({
  userName,
  flatName,
  floor,
  buildingName,
}) => {
  return {
    subject: `${userName} initiated onboarding process`,
    content: `Greetings of the Day,
    <br><br>
    One new user has initiated his onboarding process from the Resident App for ${flatName}, floor ${floor}, ${buildingName}.
    Kindly look into the Admin portal and do the needful.
    <br><br>
    If you need any assistance feel free to reach us at team@livo.ae OR contact us at +971-557821449.
    For more information visit our website  https://www.livo.ae
    <br><br>
    Regards, <br>
    Team Livo`,
  };
};
