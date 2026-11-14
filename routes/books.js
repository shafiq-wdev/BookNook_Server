import { Router } from "express";

import { booksCollection, borrowsCollection } from "../db.js";
import {
  getSessionUser,
  isBookOwner,
  requireAuth,
} from "../middleware/auth.js";
import { parseObjectId, serializeBook } from "../utils/serialize.js";
import { firstError, validateBookPayload } from "../utils/validation.js";

export const booksRouter = Router();

// GET /books — public list. Pass ?mine=true to receive only the signed-in
// user's books (used by the private /my-books page).
booksRouter.get("/", async (req, res, next) => {
  try {
    const filter = {};

    if (req.query.mine === "true" || req.query.mine === "1") {
      const user = await getSessionUser(req);

      if (!user) {
        return res.status(401).json({ message: "Please log in to continue." });
      }

      filter.$or = [{ userId: user.id }, { userEmail: user.email }];
    }

    const books = await booksCollection()
      .find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .toArray();

    return res.json(books.map(serializeBook));
  } catch (error) {
    next(error);
  }
});

// GET /books/:id — public single book.
booksRouter.get("/:id", async (req, res, next) => {
  try {
    const id = parseObjectId(req.params.id);

    if (!id) {
      return res.status(400).json({ message: "Invalid book id." });
    }

    const book = await booksCollection().findOne({ _id: id });

    if (!book) {
      return res.status(404).json({ message: "This book could not be found." });
    }

    return res.json(serializeBook(book));
  } catch (error) {
    next(error);
  }
});

// POST /books — add a book for the signed-in user.
booksRouter.post("/", requireAuth, async (req, res, next) => {
  try {
    const { values, errors, hasErrors } = validateBookPayload(req.body);

    if (hasErrors) {
      return res.status(400).json({ message: firstError(errors), errors });
    }

    const now = new Date();
    const book = {
      ...values,
      userId: req.user.id,
      userName: req.user.name,
      userEmail: req.user.email,
      createdAt: now,
      updatedAt: now,
    };

    const result = await booksCollection().insertOne(book);

    return res.status(201).json({
      success: true,
      message: "Book added successfully!",
      book: serializeBook({ ...book, _id: result.insertedId }),
    });
  } catch (error) {
    next(error);
  }
});

// PATCH /books/:id — update a book owned by the signed-in user.
booksRouter.patch("/:id", requireAuth, async (req, res, next) => {
  try {
    const id = parseObjectId(req.params.id);

    if (!id) {
      return res.status(400).json({ message: "Invalid book id." });
    }

    const existing = await booksCollection().findOne({ _id: id });

    if (!existing) {
      return res.status(404).json({ message: "This book could not be found." });
    }

    if (!isBookOwner(existing, req.user)) {
      return res
        .status(403)
        .json({ message: "You can only edit books that you added." });
    }

    const { values, errors, hasErrors } = validateBookPayload(req.body, {
      partial: true,
    });

    if (hasErrors) {
      return res.status(400).json({ message: firstError(errors), errors });
    }

    if (Object.keys(values).length === 0) {
      return res.status(400).json({ message: "No changes were provided." });
    }

    values.updatedAt = new Date();

    await booksCollection().updateOne({ _id: id }, { $set: values });

    const updated = await booksCollection().findOne({ _id: id });

    return res.json({
      success: true,
      message: "Book updated successfully!",
      book: serializeBook(updated),
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /books/:id — delete a book owned by the signed-in user.
booksRouter.delete("/:id", requireAuth, async (req, res, next) => {
  try {
    const id = parseObjectId(req.params.id);

    if (!id) {
      return res.status(400).json({ message: "Invalid book id." });
    }

    const existing = await booksCollection().findOne({ _id: id });

    if (!existing) {
      return res.status(404).json({ message: "This book could not be found." });
    }

    if (!isBookOwner(existing, req.user)) {
      return res
        .status(403)
        .json({ message: "You can only delete books that you added." });
    }

    await booksCollection().deleteOne({ _id: id });
    await borrowsCollection().deleteMany({ bookId: id });

    return res.json({
      success: true,
      message: "Book deleted successfully!",
      id: id.toString(),
    });
  } catch (error) {
    next(error);
  }
});