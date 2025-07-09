const jwt = require('jsonwebtoken');

const SECRET = process.env.JWT_SECRET || 'supersecret';

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Expecting 'Bearer <token>'
  if (!token) {
    const err = new Error('Authentication token missing');
    err.statusCode = 401;
    return next(err);
  }
  jwt.verify(token, SECRET, (err, user) => {
    if (err) {
      const error = new Error('Invalid or expired token');
      error.statusCode = 403;
      return next(error);
    }
    req.user = user;
    // console.log(user,"TokenDATA ---->")

    next();
  });
}

module.exports = authenticateToken; 