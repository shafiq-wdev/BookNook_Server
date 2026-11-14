const CLIENT_URL = (process.env.CLIENT_URL || "http://localhost:3000").replace(
  /\/+$/,
  ""
);

const SESSION_URL = `${CLIENT_URL}/api/auth/get-session`;

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

/**
 * Validate the better-auth session that the browser holds. The client and the
 * API share the same site in development, so the browser sends its session
 * cookie with credentialed cross-origin requests. We forward that cookie to
 * the Next.js auth endpoint instead of trusting a client-supplied email.
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

export async function requireAuth(req, res, next) {
  const user = await getSessionUser(req);

  if (!user) {
    return res.status(401).json({
      message: "Please log in to continue.",
    });
  }

  req.user = user;
  next();
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