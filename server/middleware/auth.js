import jwt from 'jsonwebtoken';

/**
 * Authentication middleware that verifies JWT bearer token
 * and attaches decoded userId to req.userId.
 */
export const requireAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({
      error: 'Authentication required. No token provided.',
    });
  }

  // Handle formats: "Bearer <token>", "Bearer Bearer <token>", extra spaces, or quoted strings
  let token = authHeader.replace(/^Bearer\s+/i, '').trim();

  // If a tool like Postman added "Bearer " and the user also pasted "Bearer <token>"
  if (token.toLowerCase().startsWith('bearer ')) {
    token = token.slice(7).trim();
  }

  // Strip wrapping quotes if user copied token with quotes from JSON: "eyJ..." -> eyJ...
  if (
    (token.startsWith('"') && token.endsWith('"')) ||
    (token.startsWith("'") && token.endsWith("'"))
  ) {
    token = token.slice(1, -1).trim();
  }

  if (!token) {
    return res.status(401).json({
      error: 'Authentication required. No token provided.',
    });
  }

  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    console.error('JWT_SECRET is not configured in environment variables.');
    return res.status(500).json({
      error: 'Server configuration error: JWT_SECRET missing.',
    });
  }

  try {
    const decoded = jwt.verify(token, jwtSecret);
    req.userId = decoded.userId || decoded.id;
    req.user = decoded;
    next();
  } catch (err) {
    console.warn(`⚠️  JWT verification failed (${err.name}): ${err.message}`);
    return res.status(401).json({
      error: 'Invalid or expired token.',
    });
  }
};

export default requireAuth;
