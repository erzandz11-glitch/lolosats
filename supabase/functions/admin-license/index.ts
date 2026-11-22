import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...corsHeaders,'Content-Type':'application/json'}});
async function hash(value:string){const b=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value));return [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('');}
function makeCode(){const bytes=crypto.getRandomValues(new Uint8Array(18));return 'LA-'+[...bytes].map(x=>x.toString(16).padStart(2,'0')).join('').toUpperCase();}
Deno.serve(async(req)=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:corsHeaders});if(req.method!=='POST')return json({error:'Method not allowed'},405);
 const auth=req.headers.get('Authorization');if(!auth)return json({error:'Unauthorized'},401);
 const url=Deno.env.get('SUPABASE_URL')!,anon=Deno.env.get('SUPABASE_ANON_KEY')!,service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
 const userClient=createClient(url,anon,{global:{headers:{Authorization:auth}}});const {data:{user}}=await userClient.auth.getUser();if(!user)return json({error:'Unauthorized'},401);
 const admin=createClient(url,service);const {data:profile}=await admin.from('profiles').select('role').eq('id',user.id).maybeSingle();if(profile?.role!=='admin')return json({error:'Akses admin diperlukan.'},403);
 let body:any;try{body=await req.json()}catch{return json({error:'Invalid JSON'},400)}if(!body||typeof body!=='object')return json({error:'Invalid request body'},400)
 if(body.action==='create'){
  const rawDays=body.days;const days=rawDays===null||rawDays===undefined||rawDays===''?null:Number(rawDays);if(days!==null&&(!Number.isInteger(days)||days<1||days>3650))return json({error:'Masa berlaku harus 1–3650 hari.'},400);
  const code=makeCode();const expires_at=days?new Date(Date.now()+days*86400000).toISOString():null;
  const {error}=await admin.from('licenses').insert({code_hash:await hash(code),status:'unused',expires_at,created_by:user.id});if(error)return json({error:'Gagal membuat lisensi.'},500);
  return json({ok:true,code,expires_at});
 }
 if(body.action==='revoke'){if(typeof body.id!=='string'||!body.id.trim())return json({error:'ID lisensi diperlukan.'},400);const {data:license,error:findError}=await admin.from('licenses').select('id,status').eq('id',body.id).maybeSingle();if(findError)return json({error:'Gagal memeriksa lisensi.'},500);if(!license)return json({error:'Lisensi tidak ditemukan.'},404);if(license.status==='revoked')return json({ok:true});const {error}=await admin.from('licenses').update({status:'revoked'}).eq('id',body.id);if(error)return json({error:'Gagal mencabut lisensi.'},500);await admin.from('license_events').insert({license_id:body.id,user_id:user.id,event:'revoked'});return json({ok:true});}
 if(body.action==='list'){const {data,error}=await admin.from('licenses').select('id,status,user_id,expires_at,activated_at,created_at').order('created_at',{ascending:false}).limit(100);if(error)return json({error:'Gagal mengambil lisensi.'},500);return json({licenses:data});}
 return json({error:'Action tidak dikenal.'},400);
});
