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

export async function closeMongoDB() {
  if (client) {
    await client.close();
    client = null;
    database = null;
  }
}