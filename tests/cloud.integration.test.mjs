import test from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';

const url = 'https://uxiqklvnjtgscaulutld.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV4aXFrbHZuanRnc2NhdWx1dGxkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTU0MTMzOTksImV4cCI6MjExMDk4OTM5OX0.RPNjsMbxGceFk1lFdoA33-gw4hiBY89CCXSkMamivSM';

test('1. Supabase Cloud Connection & Authentication', async () => {
  const sbA = createClient(url, key);
  const { data, error } = await sbA.auth.signInWithPassword({
    email: 'test-alpha@lolosats.internal',
    password: 'TestPassword123!'
  });

  assert.equal(error, null, 'Login test-alpha harus sukses tanpa error');
  assert.ok(data.user?.id, 'User ID harus tersedia');
  assert.ok(data.session?.access_token, 'Access token JWT harus diterbitkan');
});

test('2. CV CRUD & Cloud Sync di public.resumes', async () => {
  const sbA = createClient(url, key);
  const { data: auth } = await sbA.auth.signInWithPassword({
    email: 'test-alpha@lolosats.internal',
    password: 'TestPassword123!'
  });

  const resumeId = crypto.randomUUID();
  // CREATE
  const { data: inserted, error: insErr } = await sbA.from('resumes').insert({
    id: resumeId,
    user_id: auth.user.id,
    title: 'CV Cloud Integration Test',
    content: { profile: { nama: 'Alpha Cloud User' } }
  }).select();

  assert.equal(insErr, null);
  assert.equal(inserted[0].id, resumeId);
  assert.equal(inserted[0].title, 'CV Cloud Integration Test');

  // UPDATE
  const { data: updated, error: updErr } = await sbA.from('resumes').update({
    title: 'CV Cloud Integration Test (Updated)'
  }).eq('id', resumeId).select();

  assert.equal(updErr, null);
  assert.equal(updated[0].title, 'CV Cloud Integration Test (Updated)');

  // READ
  const { data: fetched, error: fetchErr } = await sbA.from('resumes').select('id, title').eq('id', resumeId);
  assert.equal(fetchErr, null);
  assert.equal(fetched.length, 1);
  assert.equal(fetched[0].title, 'CV Cloud Integration Test (Updated)');

  // DELETE
  const { error: delErr } = await sbA.from('resumes').delete().eq('id', resumeId);
  assert.equal(delErr, null);

  const { data: afterDel } = await sbA.from('resumes').select('id').eq('id', resumeId);
  assert.equal(afterDel.length, 0);
});

test('3. Row Level Security: Isolasi Data Antar Akun (Alpha vs Beta)', async () => {
  const sbA = createClient(url, key);
  const sbB = createClient(url, key);

  const { data: authA } = await sbA.auth.signInWithPassword({
    email: 'test-alpha@lolosats.internal',
    password: 'TestPassword123!'
  });
  const { data: authB } = await sbB.auth.signInWithPassword({
    email: 'test-beta@lolosats.internal',
    password: 'TestPassword123!'
  });

  assert.notEqual(authA.user.id, authB.user.id);

  // Alpha membuat CV rahasia
  const alphaCvId = crypto.randomUUID();
  await sbA.from('resumes').insert({
    id: alphaCvId,
    user_id: authA.user.id,
    title: 'CV Rahasia Alpha',
    content: { confidential: true }
  });

  // Beta mencoba membaca CV Alpha
  const { data: betaRead } = await sbB.from('resumes').select('*').eq('id', alphaCvId);
  assert.equal(betaRead.length, 0, 'Beta tidak boleh bisa membaca CV Alpha via RLS');

  // Beta mencoba mengedit CV Alpha
  const { data: betaEdit } = await sbB.from('resumes').update({ title: 'Tampered by Beta' }).eq('id', alphaCvId).select();
  assert.equal((betaEdit || []).length, 0, 'Beta tidak boleh bisa memodifikasi CV Alpha via RLS');

  // Beta mencoba menghapus CV Alpha
  await sbB.from('resumes').delete().eq('id', alphaCvId);

  // Verifikasi CV Alpha tetap ada utuh
  const { data: verifyAlpha } = await sbA.from('resumes').select('title').eq('id', alphaCvId);
  assert.equal(verifyAlpha.length, 1);
  assert.equal(verifyAlpha[0].title, 'CV Rahasia Alpha');

  // Cleanup
  await sbA.from('resumes').delete().eq('id', alphaCvId);
});

test('4. Edge Function Security: Blokir Akses Non-Admin pada admin-license', async () => {
  const sbA = createClient(url, key);
  await sbA.auth.signInWithPassword({
    email: 'test-alpha@lolosats.internal',
    password: 'TestPassword123!'
  });

  const res = await sbA.functions.invoke('admin-license', {
    body: { action: 'list' }
  });

  assert.ok(res.error, 'Panggilan admin oleh user biasa harus gagal');
  assert.equal(res.error.context?.status, 403, 'Harus mengembalikan HTTP 403 Forbidden');
  const body = await res.error.context.json();
  assert.equal(body.error, 'Akses admin diperlukan.');
});

test('5. Edge Function: Skenario Validasi Lisensi di activate-license', async () => {
  const sbA = createClient(url, key);
  await sbA.auth.signInWithPassword({
    email: 'test-alpha@lolosats.internal',
    password: 'TestPassword123!'
  });

  // A. Kode terlalu pendek (< 8 karakter)
  const resShort = await sbA.functions.invoke('activate-license', {
    body: { code: 'ABC' }
  });
  assert.equal(resShort.error.context?.status, 400);
  const bodyShort = await resShort.error.context.json();
  assert.equal(bodyShort.error, 'Kode lisensi tidak valid.');

  // B. Kode tidak ditemukan
  const resNotFound = await sbA.functions.invoke('activate-license', {
    body: { code: 'LA-000000000000000000000000000000000000' }
  });
  assert.equal(resNotFound.error.context?.status, 404);
  const bodyNotFound = await resNotFound.error.context.json();
  assert.equal(bodyNotFound.error, 'Kode lisensi tidak ditemukan.');
});
