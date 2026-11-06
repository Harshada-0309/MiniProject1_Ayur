const crypto = require('crypto');
const config = require('../config/env');

// Secret key for signing tokens
const DEV_DEFAULT_SECRET = 'ayurdiet-clinical-secret-key-change-in-production-2026';
const JWT_SECRET = process.env.JWT_SECRET || DEV_DEFAULT_SECRET;
const TOKEN_EXPIRY_SECONDS = 24 * 60 * 60; // 24 hours

// In-memory set for revoked tokens (for logout invalidation)
const revokedTokens = new Set();

/**
 * Base64 URL encode a string or buffer
 */
function base64UrlEncode(data) {
  const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data);
  return buffer
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

/**
 * Base64 URL decode to string
 */
function base64UrlDecode(str) {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  return Buffer.from(base64, 'base64').toString('utf8');
}

/**
 * Hash a password using PBKDF2 with a cryptographic salt
 */
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

/**
 * Verify a password against a stored salt:hash string
 */
function verifyPassword(password, storedCombinedHash) {
  if (!storedCombinedHash || !storedCombinedHash.includes(':')) {
    return false;
  }
  const [salt, originalHash] = storedCombinedHash.split(':');
  const computedHash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');

  const originalBuf = Buffer.from(originalHash, 'hex');
  const computedBuf = Buffer.from(computedHash, 'hex');

  if (originalBuf.length !== computedBuf.length) {
    return false;
  }

  return crypto.timingSafeEqual(originalBuf, computedBuf);
}

/**
 * Generate a standard signed JWT token
 */
function generateToken(payload, expiresInSeconds = TOKEN_EXPIRY_SECONDS) {
  const now = Math.floor(Date.now() / 1000);
  const header = {
    alg: 'HS256',
    typ: 'JWT',
  };

  const fullPayload = {
    ...payload,
    jti: crypto.randomBytes(8).toString('hex'),
    iat: now,
    exp: now + expiresInSeconds,
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(fullPayload));

  const dataToSign = `${encodedHeader}.${encodedPayload}`;
  const signature = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(dataToSign)
    .digest();
  const encodedSignature = base64UrlEncode(signature);

  return `${dataToSign}.${encodedSignature}`;
}

/**
 * Verify and decode a JWT token
 */
function verifyToken(token) {
  if (!token || typeof token !== 'string') {
    throw new Error('Invalid token format');
  }

  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error('Malformed token structure');
  }

  const [encodedHeader, encodedPayload, encodedSignature] = parts;

  // Recreate signature
  const dataToSign = `${encodedHeader}.${encodedPayload}`;
  const expectedSignature = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(dataToSign)
    .digest();
  const expectedEncodedSignature = base64UrlEncode(expectedSignature);

  const sigBuf = Buffer.from(encodedSignature);
  const expectedBuf = Buffer.from(expectedEncodedSignature);

  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    throw new Error('Invalid token signature');
  }

  // Parse payload
  let payload;
  try {
    payload = JSON.parse(base64UrlDecode(encodedPayload));
  } catch (err) {
    throw new Error('Invalid token payload JSON');
  }

  // Check expiration
  const now = Math.floor(Date.now() / 1000);
  if (payload.exp && payload.exp < now) {
    throw new Error('Token has expired');
  }

  return payload;
}

/**
 * Revoke a token on logout
 */
function revokeToken(token) {
  if (token) {
    revokedTokens.add(token);
  }
}

/**
 * Check if a token has been revoked
 */
function isTokenRevoked(token) {
  return revokedTokens.has(token);
}

/**
 * Generate a secure, signed prescription access token for patients (e.g. from WhatsApp links)
 */
function generatePrescriptionAccessToken(planId, patientId, expiresInSeconds = 7 * 24 * 3600) {
  return generateToken({
    type: 'prescription_access',
    plan_id: parseInt(planId, 10),
    patient_id: parseInt(patientId, 10),
  }, expiresInSeconds);
}

/**
 * Validates JWT_SECRET configuration according to deployment environment.
 * In production:
 * - Fails safely at startup if missing, empty, or using the known development default.
 * - Requires a strong key (at least 32 characters).
 * In development / test:
 * - Falls back to development secret to preserve local workflows.
 */
function validateJwtSecret(env = process.env.NODE_ENV, secret = process.env.JWT_SECRET) {
  const isProd = env === 'production';
  if (!isProd) {
    return { valid: true, secret: secret || DEV_DEFAULT_SECRET };
  }

  if (!secret || typeof secret !== 'string' || !secret.trim()) {
    throw new Error(
      '[Security Fatal] Production startup aborted: JWT_SECRET must be explicitly configured in production environment.'
    );
  }

  const trimmed = secret.trim();
  if (
    trimmed === DEV_DEFAULT_SECRET ||
    trimmed.toLowerCase().includes('change-in-production') ||
    trimmed === 'secret' ||
    trimmed === 'changeme'
  ) {
    throw new Error(
      '[Security Fatal] Production startup aborted: JWT_SECRET cannot use the known development default secret.'
    );
  }

  if (trimmed.length < 32) {
    throw new Error(
      '[Security Fatal] Production startup aborted: JWT_SECRET in production must be a strong key of at least 32 characters.'
    );
  }

  return { valid: true, secret: trimmed };
}

module.exports = {
  hashPassword,
  verifyPassword,
  generateToken,
  generatePrescriptionAccessToken,
  verifyToken,
  revokeToken,
  isTokenRevoked,
  validateJwtSecret,
  DEV_DEFAULT_SECRET,
  JWT_SECRET,
};
