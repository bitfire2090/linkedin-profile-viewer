import { MongoClient, Collection, Db } from "mongodb";
import {
  ApifyTokenRecord,
  AppSettingsRecord,
  RocketReachRecord,
  SearchEventRecord,
  SearchRecord,
  SessionRecord,
  UserRecord,
} from "./models";

const options = {};
let client: MongoClient | undefined;
let clientPromise: Promise<MongoClient> | undefined;

declare global {
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}

function getUri() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("MONGODB_URI is required to use the database.");
  }
  return uri;
}

function initClient() {
  const uri = getUri();
  if (process.env.NODE_ENV === "development") {
    if (!global._mongoClientPromise) {
      client = new MongoClient(uri, options);
      global._mongoClientPromise = client.connect();
    }
    clientPromise = global._mongoClientPromise;
  } else {
    client = new MongoClient(uri, options);
    clientPromise = client.connect();
  }
}

export async function getMongoClient() {
  if (!clientPromise) {
    initClient();
  }
  return clientPromise!;
}

export async function getDb(): Promise<Db> {
  const client = await getMongoClient();
  return client.db();
}

export async function getSearchCollection(): Promise<Collection<SearchRecord>> {
  const db = await getDb();
  const collection = db.collection<SearchRecord>("searches");

  // Ensure indexes are present for quick lookups and ordering.
  await collection.createIndex({ url: 1 }, { unique: true });
  await collection.createIndex({ createdAt: -1 });
  await collection.createIndex({ updatedAt: -1 });

  return collection;
}

export async function getUserCollection(): Promise<Collection<UserRecord>> {
  const db = await getDb();
  const collection = db.collection<UserRecord>("users");

  await collection.createIndex({ username: 1 }, { unique: true });
  await collection.createIndex({ role: 1, approved: 1 });
  await collection.createIndex({ disabledAt: 1 });
  await collection.createIndex({ createdAt: -1 });

  return collection;
}

export async function getSessionCollection(): Promise<Collection<SessionRecord>> {
  const db = await getDb();
  const collection = db.collection<SessionRecord>("sessions");

  await collection.createIndex({ tokenHash: 1 }, { unique: true });
  await collection.createIndex({ userId: 1 });
  await collection.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });

  return collection;
}

export async function getSearchEventCollection(): Promise<Collection<SearchEventRecord>> {
  const db = await getDb();
  const collection = db.collection<SearchEventRecord>("searchEvents");

  await collection.createIndex({ userId: 1, createdAt: -1 });
  await collection.createIndex({ createdAt: -1 });
  await collection.createIndex({ source: 1, createdAt: -1 });

  return collection;
}

export async function getApifyTokenCollection(): Promise<Collection<ApifyTokenRecord>> {
  const db = await getDb();
  const collection = db.collection<ApifyTokenRecord>("apifyTokens");

  await collection.createIndex({ isActive: 1 }, { unique: true, partialFilterExpression: { isActive: true } });
  await collection.createIndex({ updatedAt: -1 });
  await collection.createIndex({ createdAt: -1 });

  return collection;
}

export async function getAppSettingsCollection(): Promise<Collection<AppSettingsRecord>> {
  const db = await getDb();
  const collection = db.collection<AppSettingsRecord>("appSettings");

  await collection.createIndex({ key: 1 }, { unique: true });
  await collection.createIndex({ updatedAt: -1 });

  return collection;
}

export async function getRocketReachCollection(): Promise<Collection<RocketReachRecord>> {
  const db = await getDb();
  const collection = db.collection<RocketReachRecord>("rocketreaches");

  await collection.createIndex({ emails: 1 });
  await collection.createIndex({ profileId: 1 });
  await collection.createIndex({ createdAt: -1 });
  await collection.createIndex({ updatedAt: -1 });

  return collection;
}
