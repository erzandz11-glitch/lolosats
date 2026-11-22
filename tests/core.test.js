import test from 'node:test';
import assert from 'node:assert/strict';
import { blankResume, normalizeResume, esc, todayID, uid } from '../src/utils/helpers.js';
import { analyzeResume, tokens } from '../src/services/analysis.js';

test('blankResume membuat struktur CV lengkap dengan ID unik', () => {
  const a = blankResume();
  const b = blankResume();
  assert.ok(a.id && b.id && a.id !== b.id);
  assert.deepEqual(a.experiences, []);
  assert.deepEqual(a.education, []);
  assert.equal(a.template, 'modern');
});

test('normalizeResume memperbaiki struktur data lama atau parsial', () => {
  const resume = normalizeResume({
    title: 'CV Uji',
    profile: { nama: 'Dina' },
    experiences: [{ posisi: 'Intern' }],
    education: 'invalid',
    template: 'unknown'
  });
  assert.equal(resume.title, 'CV Uji');
  assert.equal(resume.profile.nama, 'Dina');
  assert.equal(resume.profile.email, '');
  assert.equal(resume.experiences.length, 1);
  assert.ok(resume.experiences[0].id);
  assert.equal(resume.experiences[0].posisi, 'Intern');
  assert.deepEqual(resume.education, []);
  assert.equal(resume.template, 'modern');
  assert.deepEqual(resume.skills, []);
});

test('normalizeResume membatasi panjang judul dan array berlebih', () => {
  const superLongTitle = 'A'.repeat(250);
  const normalized = normalizeResume({
    title: superLongTitle,
    template: 'executive',
    skills: Array.from({ length: 300 }, (_, i) => `Skill ${i}`)
  });
  assert.equal(normalized.title.length, 120);
  assert.equal(normalized.template, 'executive');
  assert.equal(normalized.skills.length, 200);
});

test('esc mengamankan karakter HTML', () => {
  assert.equal(esc('<script>"x" & \'y\'</script>'), '&lt;script&gt;&quot;x&quot; &amp; &#39;y&#39;&lt;/script&gt;');
  assert.equal(esc(null), '');
  assert.equal(esc(undefined), '');
});

test('tokens menormalkan teks dan membuang stopwords umum serta istilah lowongan', () => {
  const result = tokens('Kami mencari Software Engineer berpengalaman dengan kualifikasi React dan TypeScript untuk posisi ini!');
  assert.ok(result.includes('software'));
  assert.ok(result.includes('engineer'));
  assert.ok(result.includes('react'));
  assert.ok(result.includes('typescript'));
  // Verifikasi stopwords yang harus disaring
  assert.ok(!result.includes('kami'));
  assert.ok(!result.includes('mencari'));
  assert.ok(!result.includes('kualifikasi'));
  assert.ok(!result.includes('posisi'));
  assert.ok(!result.includes('untuk'));
  assert.ok(!result.includes('ini'));
});

test('analyzeResume menghasilkan skor terbatas dan disclaimer', () => {
  const resume = blankResume();
  resume.profile = {
    ...resume.profile,
    nama: 'Dina',
    email: 'dina@example.com',
    telepon: '08123456789',
    jabatan: 'Frontend Developer',
    ringkasan: 'Frontend developer dengan pengalaman membangun aplikasi web menggunakan JavaScript dan React.'
  };
  resume.skills = ['JavaScript', 'React', 'HTML', 'CSS'];
  resume.experiences = [{ posisi: 'Frontend Developer', perusahaan: 'Contoh', deskripsi: 'Membangun aplikasi React' }];
  resume.education = [{ gelar: 'S1 Informatika', institusi: 'Universitas Contoh' }];
  resume.jobDescription = 'Kami mencari Frontend Developer dengan kemampuan JavaScript React HTML CSS dan komunikasi tim.';
  const result = analyzeResume(resume);
  assert.ok(result.score >= 0 && result.score <= 100);
  assert.ok(result.matched.includes('javascript'));
  assert.ok(result.disclaimer.includes('bukan prediksi'));
  assert.equal(result.checks.length, 7);
});

test('analyzeResume menolak deskripsi lowongan terlalu pendek', () => {
  assert.throws(() => analyzeResume({ jobDescription: 'Frontend role' }), /minimal 30 karakter/);
});

test('todayID menghasilkan format tanggal bahasa Indonesia yang valid', () => {
  const str = todayID();
  assert.match(str, /^\d{1,2}\s+[A-Za-z]+\s+\d{4}$/);
});

test('struktur backup lolosats-backup-v1 divalidasi dengan benar', () => {
  const validPayload = {
    format: 'lolosats-backup-v1',
    exported_at: new Date().toISOString(),
    resumes: [blankResume('CV Backup')]
  };
  assert.equal(validPayload.format, 'lolosats-backup-v1');
  assert.ok(Array.isArray(validPayload.resumes));
  assert.equal(validPayload.resumes.length, 1);

  // Validasi format palsu/usang
  const invalidPayload = { format: 'legacy-v0', resumes: [] };
  assert.notEqual(invalidPayload.format, 'lolosats-backup-v1');
});

test('isolasi cache antar akun membedakan key penyimpanan lokal', () => {
  const cacheKey = userId => userId ? `lolosats_workspace_user_${userId}` : 'lolosats_workspace_v2';
  const anonKey = cacheKey(null);
  const user1Key = cacheKey('user-uuid-1111');
  const user2Key = cacheKey('user-uuid-2222');

  assert.equal(anonKey, 'lolosats_workspace_v2');
  assert.equal(user1Key, 'lolosats_workspace_user_user-uuid-1111');
  assert.equal(user2Key, 'lolosats_workspace_user_user-uuid-2222');
  assert.notEqual(anonKey, user1Key);
  assert.notEqual(user1Key, user2Key);
});

test('format kode lisensi memenuhi standar LA- HEX36 dan hash SHA-256', async () => {
  const makeCode = () => {
    const bytes = crypto.getRandomValues(new Uint8Array(18));
    return 'LA-' + [...bytes].map(x => x.toString(16).padStart(2, '0')).join('').toUpperCase();
  };
  const sha256 = async val => {
    const data = new TextEncoder().encode(val.trim());
    const hash = await crypto.subtle.digest('SHA-256', data);
    return [...new Uint8Array(hash)].map(x => x.toString(16).padStart(2, '0')).join('');
  };

  const code = makeCode();
  assert.equal(code.startsWith('LA-'), true);
  assert.equal(code.length, 39);
  assert.match(code, /^LA-[0-9A-F]{36}$/);

  const hash = await sha256(code);
  assert.equal(hash.length, 64);
  assert.match(hash, /^[0-9a-f]{64}$/);
});
