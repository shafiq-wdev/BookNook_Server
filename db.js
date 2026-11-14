import { MongoClient } from "mongodb";

let client = null;
let database = null;

const CONNECTION_OPTIONS = {
  serverSelectionTimeoutMS: 5000,
  connectTimeoutMS: 5000,
};

export async function connectToMongoDB() {
  if (database) return database;

  const uri = process.env.MONGODB_URI;

  if (!uri) {
    throw new Error("MONGODB_URI is missing from the server environment.");
  }

  client = new MongoClient(uri, CONNECTION_OPTIONS);
  await client.connect();

  database = client.db(process.env.MONGODB_DB || "booknook");

  console.log(`Connected to MongoDB database "${database.databaseName}".`);

  await ensureBorrowingSchema();

  return database;
}

export function getDb() {
  if (!database) {
    throw new Error("MongoDB has not been connected yet.");
  }

  return database;
}

export function booksCollection() {
  return getDb().collection("books");
}

export function borrowsCollection() {
  return getDb().collection("borrows");
}

/**
 * Backfill books created before copy tracking, then enforce one active borrow
 * per reader and book at the database level. The unique partial index makes a
 * double borrow impossible even when two requests arrive at the same instant.
 */
export async function ensureBorrowingSchema() {
  const db = getDb();

  await db.collection("books").updateMany(
    {
      $or: [
        { totalCopies: { $exists: false } },
        { availableCopies: { $exists: false } },
      ],
    },
    [
      {
        $set: {
          totalCopies: { $ifNull: ["$totalCopies", 1] },
          availableCopies: {
            $ifNull: ["$availableCopies", { $ifNull: ["$totalCopies", 1] }],
          },
        },
      },
    ]
  );

  try {
    await db.collection("borrows").createIndex(
      { bookId: 1, userId: 1 },
      {
        name: "unique_active_borrow_per_reader",
        unique: true,
        partialFilterExpression: { status: "borrowed" },
      }
    );
  } catch (error) {
    console.error(
      "Unable to create the active borrow index. Check for duplicate active borrows:",
      error.message
    );
  }
}

export async function closeMongoDB() {
  if (client) {
    await client.close();
    client = null;
    database = null;
  }
}