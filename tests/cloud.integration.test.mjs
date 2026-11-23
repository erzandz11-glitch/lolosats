import test from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';

const url = 'https://uxiqklvnjtgscaulutld.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV4aXFrbHZuanRnc2NhdWx1dGxkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTU0MTMzOTksImV4cCI6MjExMDk4OTM5OX0.RPNjsMbxGceFk1lFdoA33-gw4hiBY89CCXSkMamivSM';

test('1. Supabase Cloud Configuration & Client Contract', () => {
  assert.ok(url.startsWith('https://'), 'Project URL harus berprotokol HTTPS');
  assert.ok(url.includes('supabase.co'), 'Project URL harus mengarah ke supabase.co');
  assert.equal(key.split('.').length, 3, 'Anon key harus berformat valid JWT 3 bagian');

  const client = createClient(url, key);
  assert.ok(client.auth, 'Client auth service harus tersedia');
  assert.ok(client.from, 'Client database query builder harus tersedia');
  assert.ok(client.functions, 'Client functions service harus tersedia');
});

test('2. Edge Function Security: Menolak Permintaan Anonim Tanpa Auth (401)', async () => {
  const client = createClient(url, key);

  // activate-license tanpa login/token harus ditolak 401 Unauthorized
  const resActivate = await client.functions.invoke('activate-license', {
    body: { code: 'LA-111122223333444455556666777788889999' }
  });
  assert.equal(resActivate.error?.context?.status, 401, 'activate-license anonim harus ditolak 401');

  // admin-license tanpa login/token harus ditolak 401 Unauthorized
  const resAdmin = await client.functions.invoke('admin-license', {
    body: { action: 'list' }
  });
  assert.equal(resAdmin.error?.context?.status, 401, 'admin-license anonim harus ditolak 401');
});

test('3. Row Level Security: Menolak Akses Anonim ke Tabel Resumes & Profiles', async () => {
  const client = createClient(url, key);

  // Akses select resumes oleh anonim
  const { data: resumesData, error: resumesErr } = await client.from('resumes').select('*');
  assert.equal((resumesData || []).length, 0, 'Pengguna anonim tidak boleh bisa membaca tabel resumes');

  // Akses insert resumes oleh anonim
  const { error: insErr } = await client.from('resumes').insert({
    id: crypto.randomUUID(),
    title: 'Anon CV',
    content: {}
  });
  assert.ok(insErr, 'Insert resumes oleh anonim harus ditolak oleh RLS');
});

test('4. Edge Function Error Parsing Utility Contract', async () => {
  async function parseFunctionError(error, defaultMsg = 'Terjadi kesalahan pada server.') {
    if (!error) return defaultMsg;
    try {
      if (error.context && typeof error.context.json === 'function') {
        const body = await error.context.json();
        if (body?.error) return body.error;
      }
    } catch (_) {}
    return error.message || defaultMsg;
  }

  // Skenario error dengan response json
  const fakeErrorWithJson = {
    message: 'Edge Function returned a non-2xx status code',
    context: {
      json: async () => ({ error: 'Akses admin diperlukan.' })
    }
  };
  const parsed = await parseFunctionError(fakeErrorWithJson);
  assert.equal(parsed, 'Akses admin diperlukan.');

  // Skenario error standar
  const fakeErrorGeneric = { message: 'Network offline' };
  const parsedGeneric = await parseFunctionError(fakeErrorGeneric);
  assert.equal(parsedGeneric, 'Network offline');
});

test('5. Validasi Aturan Hashing Lisensi Kriptografis', async () => {
  const sha256 = async val => {
    const data = new TextEncoder().encode(val.trim());
    const hash = await crypto.subtle.digest('SHA-256', data);
    return [...new Uint8Array(hash)].map(x => x.toString(16).padStart(2, '0')).join('');
  };

  const sampleCode = 'LA-A1B2C3D4E5F60123456789ABCDEF01234567';
  const hash1 = await sha256(sampleCode);
  const hash2 = await sha256(sampleCode);

  assert.equal(hash1, hash2, 'Hash harus deterministik');
  assert.equal(hash1.length, 64, 'Hash SHA-256 harus 64 karakter');
  assert.notEqual(hash1, sampleCode, 'Hash tidak boleh menyamai kode mentah');
});
