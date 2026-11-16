import mongoose from 'mongoose';
let cache=(globalThis as any).__mongo as {conn:typeof mongoose|null,promise:Promise<typeof mongoose>|null}|undefined;
if(!cache){cache={conn:null,promise:null};(globalThis as any).__mongo=cache;}
export async function db(){if(cache!.conn)return cache!.conn;if(!process.env.MONGODB_URI)throw Error('MONGODB_URI missing');if(!cache!.promise)cache!.promise=mongoose.connect(process.env.MONGODB_URI,{bufferCommands:false});cache!.conn=await cache!.promise;return cache!.conn;}
