const nodemailer = require('nodemailer');

async function sendMail({ to, subject, html }) {
  const BREVO_USER = 'adnan.khan@mindcrewtech.com'
  const transporter = nodemailer.createTransport({
    host: 'smtp-relay.brevo.com',
    port: 587,
    auth: {
      user: "90a2f5001@smtp-brevo.com",
      pass:"3Q0YyRmKtd2f4ZUx",
    },
  });

  return transporter.sendMail({
    from: `"Your App Name" <${BREVO_USER}>`,
    to,
    subject,
    html,
  });
}

module.exports = sendMail; 