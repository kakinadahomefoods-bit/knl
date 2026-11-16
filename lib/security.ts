import crypto from 'node:crypto';import {cookies} from 'next/headers';
const secret=()=>{if(!process.env.ADMIN_SESSION_SECRET)throw Error('ADMIN_SESSION_SECRET missing');return process.env.ADMIN_SESSION_SECRET};
export function hashPassword(password:string,salt=crypto.randomBytes(16).toString('hex')){return salt+':'+crypto.scryptSync(password,salt,64).toString('hex')}
export function verifyPassword(password:string,stored:string){const [salt]=stored.split(':');const actual=Buffer.from(hashPassword(password,salt).split(':')[1],'hex'),expected=Buffer.from(stored.split(':')[1],'hex');return actual.length===expected.length&&crypto.timingSafeEqual(actual,expected)}
export function sign(data:string){return crypto.createHmac('sha256',secret()).update(data).digest('hex')}
export async function isAdmin(){const cookie=(await cookies()).get('cruvita_admin')?.value;if(!cookie)return false;const [payload,sig]=cookie.split('.');if(!payload||!sig)return false;const expected=sign(payload);if(sig.length!==expected.length||!crypto.timingSafeEqual(Buffer.from(sig),Buffer.from(expected)))return false;try{const obj=JSON.parse(Buffer.from(payload,'base64url').toString());return obj.exp>Date.now()}catch{return false}}
export function adminDenied(){return Response.json({error:'Unauthorized'},{status:401})}
export function clean(s:unknown,max=200){return typeof s==='string'?s.trim().slice(0,max):''}
