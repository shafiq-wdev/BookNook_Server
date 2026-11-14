import { createRemoteJWKSet, jwtVerify } from "jose";

const CLIENT_URL = (process.env.CLIENT_URL || "http://localhost:3000").replace(
  /\/+$/,
  ""
);

const SESSION_URL = `${CLIENT_URL}/api/auth/get-session`;
const JWKS_URL = new URL(`${CLIENT_URL}/api/auth/jwks`);

const JWT_ISSUER = process.env.JWT_ISSUER || CLIENT_URL;
const JWT_AUDIENCE = process.env.JWT_AUDIENCE || CLIENT_URL;

const jwks = createRemoteJWKSet(JWKS_URL, {
  timeoutDuration: 5000,
  cooldownDuration: 30000,
  cacheMaxAge: 10 * 60 * 1000,
});

function normalizeUser(user) {
  if (!user?.email) return null;

  const email = user.email.trim().toLowerCase();
  const name =
    user.name?.trim() || email.split("@")[0] || "BookNook reader";

  return {
    id: user.id ? String(user.id) : email,
    name,
    email,
  };
}

function userFromPayload(payload) {
  if (!payload) return null;

  return normalizeUser({
    id: payload.sub ?? payload.id,
    name: payload.name,
    email: payload.email,
  });
}

function readBearerToken(req) {
  const header = req.headers.authorization;

  if (!header) return "";

  const [scheme, token] = header.split(/\s+/, 2);

  if (!token || scheme.toLowerCase() !== "bearer") return "";

  return token.trim();
}

/**
 * Validate the JWT that better-auth issues for the signed-in user. The public
 * keys are fetched from the client's JWKS endpoint, so the Express API never
 * needs the better-auth secret and keys can rotate without a redeploy.
 */
export async function verifyAccessToken(token) {
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, jwks, {
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    });

    return userFromPayload(payload);
  } catch (error) {
    console.error(
      "JWT verification failed:",
      error?.code || error?.name || "unknown error"
    );
    return null;
  }
}

/**
 * Fallback for requests that only carry the better-auth session cookie. The
 * browser still sends it on credentialed requests, and the token endpoint uses
 * the same session, so both paths resolve to the same user.
 */
export async function getSessionUser(req) {
  const cookie = req.headers.cookie;

  if (!cookie) return null;

  try {
    const response = await fetch(SESSION_URL, {
      method: "GET",
      headers: {
        accept: "application/json",
        cookie,
      },
      cache: "no-store",
    });

    if (!response.ok) return null;

    const data = await response.json();

    return normalizeUser(data?.user);
  } catch (error) {
    console.error("Unable to verify the session with the auth server:", error);
    return null;
  }
}

/**
 * Resolve a user for routes that are public but personalise their response.
 * A malformed or expired bearer token never grants access.
 */
export async function getRequestUser(req) {
  const token = readBearerToken(req);

  if (token) {
    return verifyAccessToken(token);
  }

  return getSessionUser(req);
}

/**
 * Protected routes require a valid JWT. A request that sends a bearer token
 * gets no cookie fallback: an expired token is a 401, not a silent downgrade.
 */
export async function requireAuth(req, res, next) {
  const token = readBearerToken(req);

  if (token) {
    const user = await verifyAccessToken(token);

    if (!user) {
      return res.status(401).json({
        message: "Your session token is invalid or has expired. Please log in again.",
      });
    }

    req.user = user;
    req.authMethod = "jwt";
    return next();
  }

  const user = await getSessionUser(req);

  if (!user) {
    return res.status(401).json({
      message: "Please log in to continue.",
    });
  }

  req.user = user;
  req.authMethod = "session";
  return next();
}

export function isBookOwner(book, user) {
  if (!book || !user) return false;

  if (book.userId && String(book.userId) === user.id) {
    return true;
  }

  return Boolean(
    book.userEmail &&
      user.email &&
      book.userEmail.trim().toLowerCase() === user.email
  );
}

export function isBorrowOwner(borrow, user) {
  if (!borrow || !user) return false;

  if (borrow.userId && String(borrow.userId) === user.id) {
    return true;
  }

  return Boolean(
    borrow.userEmail &&
      user.email &&
      borrow.userEmail.trim().toLowerCase() === user.email
  );
}
