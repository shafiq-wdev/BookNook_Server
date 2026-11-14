import { Router } from "express";

import { booksCollection, borrowsCollection } from "../db.js";
import {
  isBookOwner,
  isBorrowOwner,
  requireAuth,
} from "../middleware/auth.js";
import { parseObjectId, serializeBorrow } from "../utils/serialize.js";
import { BORROW_DAYS } from "../utils/validation.js";

const DAY_IN_MS = 24 * 60 * 60 * 1000;

export const borrowsRouter = Router();

// GET /borrows — the signed-in user's borrows. Active borrows are returned by
// default; pass ?status=all to include returned history. Pass ?bookId=<id> to
// check one book on the details page.
borrowsRouter.get("/", requireAuth, async (req, res, next) => {
  try {
    const filter = {
      $or: [{ userId: req.user.id }, { userEmail: req.user.email }],
    };

    if (req.query.status !== "all") {
      filter.status = "borrowed";
      filter.returnedAt = null;
    }

    if (req.query.bookId) {
      const bookId = parseObjectId(req.query.bookId);

      if (!bookId) {
        return res.status(400).json({ message: "Invalid book id." });
      }

      filter.bookId = bookId;
    }

    const borrows = await borrowsCollection()
      .find(filter)
      .sort({ borrowedAt: -1, _id: -1 })
      .toArray();

    return res.json(borrows.map(serializeBorrow));
  } catch (error) {
    next(error);
  }
});

// POST /borrows — borrow a book for the signed-in user.
borrowsRouter.post("/", requireAuth, async (req, res, next) => {
  try {
    const bookId = parseObjectId(req.body?.bookId);

    if (!bookId) {
      return res.status(400).json({ message: "Invalid book id." });
    }

    const book = await booksCollection().findOne({ _id: bookId });

    if (!book) {
      return res.status(404).json({ message: "This book could not be found." });
    }

    if (isBookOwner(book, req.user)) {
      return res
        .status(400)
        .json({ message: "You cannot borrow a book you added yourself." });
    }

    const existing = await borrowsCollection().findOne({
      bookId,
      $or: [{ userId: req.user.id }, { userEmail: req.user.email }],
      status: "borrowed",
      returnedAt: null,
    });

    if (existing) {
      return res.status(409).json({
        message: "You have already borrowed this book.",
        borrow: serializeBorrow(existing),
      });
    }

    const borrowedAt = new Date();
    const dueAt = new Date(borrowedAt.getTime() + BORROW_DAYS * DAY_IN_MS);

    const borrow = {
      bookId,
      bookTitle: book.title || "Untitled",
      bookImage: book.image || "",
      userId: req.user.id,
      userName: req.user.name,
      userEmail: req.user.email,
      status: "borrowed",
      borrowedAt,
      dueAt,
      borrowDate: borrowedAt,
      returnDate: dueAt,
      returnedAt: null,
    };

    const result = await borrowsCollection().insertOne(borrow);

    return res.status(201).json({
      success: true,
      message: "Book borrowed successfully!",
      borrow: serializeBorrow({ ...borrow, _id: result.insertedId }),
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /borrows/:id — return a book. The record is kept for history.
borrowsRouter.delete("/:id", requireAuth, async (req, res, next) => {
  try {
    const id = parseObjectId(req.params.id);

    if (!id) {
      return res.status(400).json({ message: "Invalid borrow id." });
    }

    const borrow = await borrowsCollection().findOne({ _id: id });

    if (!borrow) {
      return res.status(404).json({ message: "This borrow record was not found." });
    }

    if (!isBorrowOwner(borrow, req.user)) {
      return res
        .status(403)
        .json({ message: "You can only return your own borrowed books." });
    }

    if (borrow.status === "returned" || borrow.returnedAt) {
      return res.status(409).json({
        message: "This book has already been returned.",
        borrow: serializeBorrow(borrow),
      });
    }

    const returnedAt = new Date();

    await borrowsCollection().updateOne(
      { _id: id },
      { $set: { status: "returned", returnedAt } }
    );

    const updated = await borrowsCollection().findOne({ _id: id });

    return res.json({
      success: true,
      message: "Book returned successfully!",
      borrow: serializeBorrow(updated),
    });
  } catch (error) {
    next(error);
  }
});