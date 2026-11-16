import {db} from '@/lib/db';import {Order} from '@/lib/models';import {isAdmin,adminDenied} from '@/lib/security';
export async function GET(){if(!(await isAdmin()))return adminDenied();try{await db();return Response.json({orders:await Order.find().sort({createdAt:-1}).limit(300).lean()})}catch{return Response.json({error:'Unavailable'},{status:503})}}
