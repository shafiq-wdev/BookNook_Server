import { ObjectId } from "mongodb";

const OBJECT_ID_PATTERN = /^[a-f0-9]{24}$/i;

export function parseObjectId(value) {
  if (typeof value !== "string" || !OBJECT_ID_PATTERN.test(value.trim())) {
    return null;
  }

  return new ObjectId(value.trim());
}

export function toIso(value) {
  if (!value) return null;

  const date = value instanceof Date ? value : new Date(value);

  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function serializeBook(book) {
  if (!book) return null;

  return {
    id: book._id ? book._id.toString() : String(book.id ?? ""),
    title: book.title || "Untitled",
    author: book.author || "Unknown author",
    category: book.category || "Uncategorized",
    image: book.image || book.coverImage || book.imageUrl || "",
    description: book.description || "",
    userId: book.userId ?? null,
    userName: book.userName || "",
    userEmail: book.userEmail || "",
    createdAt: toIso(book.createdAt),
    updatedAt: toIso(book.updatedAt),
  };
}

export function serializeBorrow(borrow) {
  if (!borrow) return null;

  const borrowedAt = toIso(borrow.borrowedAt ?? borrow.borrowDate);
  const dueAt = toIso(borrow.dueAt ?? borrow.returnDate);
  const returnedAt = toIso(borrow.returnedAt);

  return {
    id: borrow._id ? borrow._id.toString() : String(borrow.id ?? ""),
    bookId: borrow.bookId ? borrow.bookId.toString() : null,
    bookTitle: borrow.bookTitle || "Untitled",
    bookImage: borrow.bookImage || "",
    userId: borrow.userId ?? null,
    userName: borrow.userName || "",
    userEmail: borrow.userEmail || "",
    status: borrow.status || (returnedAt ? "returned" : "borrowed"),
    borrowedAt,
    dueAt,
    returnedAt,
    // Friendly aliases that match the assignment wording.
    borrowDate: borrowedAt,
    returnDate: dueAt,
  };
}