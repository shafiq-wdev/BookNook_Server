export const BOOK_CATEGORIES = ["Fiction", "Science", "History", "Kids", "Others"];

export const BOOK_LIMITS = {
  title: 150,
  author: 100,
  description: 1000,
  image: 2048,
};

export const COPY_LIMITS = {
  min: 1,
  max: 99,
  default: 1,
};

export const BORROW_DAYS = 14;

const LOCAL_IMAGE_PATH = /^\/api\/images\/[a-f0-9]{24}$/i;

export function readText(value) {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Copies arrive as JSON numbers from the form, but accept numeric strings so
 * direct API calls behave the same way.
 */
export function readCopies(value) {
  if (value === null || value === undefined || value === "") return NaN;

  const copies = typeof value === "number" ? value : Number(value);

  return Number.isInteger(copies) ? copies : NaN;
}

export function validateCopies(value, errors) {
  const copies = readCopies(value);

  if (
    !Number.isInteger(copies) ||
    copies < COPY_LIMITS.min ||
    copies > COPY_LIMITS.max
  ) {
    errors.totalCopies = `Total copies must be a whole number between ${COPY_LIMITS.min} and ${COPY_LIMITS.max}.`;
    return null;
  }

  return copies;
}

export function isValidImageUrl(value) {
  if (LOCAL_IMAGE_PATH.test(value)) return true;

  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function validateField(field, value, errors) {
  if (field === "title") {
    if (!value) {
      errors.title = "Book title is required.";
    } else if (value.length > BOOK_LIMITS.title) {
      errors.title = `Book title must be ${BOOK_LIMITS.title} characters or less.`;
    }
  }

  if (field === "author") {
    if (!value) {
      errors.author = "Author name is required.";
    } else if (value.length > BOOK_LIMITS.author) {
      errors.author = `Author name must be ${BOOK_LIMITS.author} characters or less.`;
    }
  }

  if (field === "category") {
    if (!BOOK_CATEGORIES.includes(value)) {
      errors.category = "Please choose a valid category.";
    }
  }

  if (field === "image") {
    if (!value) {
      errors.image = "Book image is required.";
    } else if (
      value.length > BOOK_LIMITS.image ||
      !isValidImageUrl(value)
    ) {
      errors.image = "Book image URL is not valid.";
    }
  }

  if (field === "description") {
    if (!value) {
      errors.description = "Short description is required.";
    } else if (value.length > BOOK_LIMITS.description) {
      errors.description = `Short description must be ${BOOK_LIMITS.description} characters or less.`;
    }
  }
}

/**
 * Validate a book payload. When `partial` is true only the fields that are
 * present are validated, which is what PATCH needs.
 */
export function validateBookPayload(payload, { partial = false } = {}) {
  const source = payload && typeof payload === "object" ? payload : {};
  const fields = ["title", "author", "category", "image", "description"];
  const values = {};
  const errors = {};

  for (const field of fields) {
    const present = Object.prototype.hasOwnProperty.call(source, field);

    if (!present) {
      if (!partial) {
        const value = "";
        values[field] = value;
        validateField(field, value, errors);
      }

      continue;
    }

    const value = readText(source[field]);

    values[field] = value;
    validateField(field, value, errors);
  }

  const hasCopies = Object.prototype.hasOwnProperty.call(source, "totalCopies");

  if (hasCopies) {
    const copies = validateCopies(source.totalCopies, errors);

    if (copies !== null) {
      values.totalCopies = copies;
    }
  } else if (!partial) {
    // Keep older clients working: books created without a copies field can
    // still be borrowed once.
    values.totalCopies = COPY_LIMITS.default;
  }

  return {
    values,
    errors,
    hasErrors: Object.keys(errors).length > 0,
  };
}

export function firstError(errors) {
  return Object.values(errors)[0] || "Invalid request data.";
}