import mongoose from 'mongoose';

type MongoCache = { conn: typeof mongoose | null; promise: Promise<typeof mongoose> | null };
let cache = (globalThis as any).__mongo as MongoCache | undefined;
if (!cache) {
  cache = { conn: null, promise: null };
  (globalThis as any).__mongo = cache;
}

export async function db() {
  if (cache!.conn && mongoose.connection.readyState === 1) return cache!.conn;
  if (cache!.conn) {
    cache!.conn = null;
    cache!.promise = null;
  }
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI missing');
  if (!cache!.promise) {
    cache!.promise = mongoose.connect(process.env.MONGODB_URI, {
      bufferCommands: false,
      serverSelectionTimeoutMS: 10000,
    });
  }
  try {
    cache!.conn = await cache!.promise;
    return cache!.conn;
  } catch (error) {
    // A failed connection must not poison all later requests in this instance.
    cache!.promise = null;
    cache!.conn = null;
    throw error;
  }
}
