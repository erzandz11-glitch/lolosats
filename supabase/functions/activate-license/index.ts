import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...corsHeaders,'Content-Type':'application/json'}});
async function sha256(value:string){const data=new TextEncoder().encode(value.trim());const hash=await crypto.subtle.digest('SHA-256',data);return [...new Uint8Array(hash)].map(x=>x.toString(16).padStart(2,'0')).join('');}
Deno.serve(async(req)=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:corsHeaders});
  if(req.method!=='POST')return json({error:'Method not allowed'},405);
  const auth=req.headers.get('Authorization');if(!auth)return json({error:'Unauthorized'},401);
  const url=Deno.env.get('SUPABASE_URL')!,anon=Deno.env.get('SUPABASE_ANON_KEY')!,service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const userClient=createClient(url,anon,{global:{headers:{Authorization:auth}}});
  const {data:{user},error:userErr}=await userClient.auth.getUser();if(userErr||!user)return json({error:'Unauthorized'},401);
  let body:{code?:string};try{body=await req.json()}catch{return json({error:'Invalid JSON'},400)}
  if(!body||typeof body!=='object')return json({error:'Invalid request body'},400);
  const code=String(body.code||'').trim().toUpperCase();if(code.length<8||code.length>100)return json({error:'Kode lisensi tidak valid.'},400);
  const admin=createClient(url,service);const hash=await sha256(code);
  const {data:license,error}=await admin.from('licenses').select('id,status,user_id,expires_at').eq('code_hash',hash).maybeSingle();
  if(error)return json({error:'Gagal memeriksa lisensi.'},500);if(!license)return json({error:'Kode lisensi tidak ditemukan.'},404);
  if(license.status==='revoked'||license.status==='expired')return json({error:'Lisensi tidak aktif.'},403);
  if(license.status==='active'&&license.user_id===user.id)return json({ok:true,message:'Lisensi sudah aktif di akun ini.'});
  if(license.status!=='unused')return json({error:'Lisensi tidak tersedia untuk aktivasi.'},409);
  if(license.expires_at&&new Date(license.expires_at)<new Date())return json({error:'Lisensi sudah kedaluwarsa.'},403);
  if(license.user_id&&license.user_id!==user.id)return json({error:'Lisensi sudah digunakan akun lain.'},409);
  const {data:claimed,error:updateErr}=await admin.from('licenses').update({user_id:user.id,status:'active',activated_at:new Date().toISOString()}).eq('id',license.id).eq('status','unused').is('user_id',null).select('id').maybeSingle();
  if(updateErr)return json({error:'Aktivasi gagal.'},500);
  if(!claimed)return json({error:'Lisensi baru saja digunakan oleh akun lain. Coba kode lain.'},409);
  await admin.from('license_events').insert({license_id:license.id,user_id:user.id,event:'activated'});
  return json({ok:true,message:'Lisensi berhasil diaktifkan.'});
});
