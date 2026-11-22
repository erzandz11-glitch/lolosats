import test from 'node:test';
import assert from 'node:assert/strict';
import { blankResume, normalizeResume, esc } from '../src/utils/helpers.js';
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
  const resume = normalizeResume({ title: 'CV Uji', profile: { nama: 'Dina' }, experiences: [{ posisi: 'Intern' }], education: 'invalid', template: 'unknown' });
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

test('esc mengamankan karakter HTML', () => {
  assert.equal(esc('<script>"x" & \'y\'</script>'), '&lt;script&gt;&quot;x&quot; &amp; &#39;y&#39;&lt;/script&gt;');
});

test('tokens menormalkan teks dan membuang stopwords umum', () => {
  const result = tokens('The ANALISIS data dan JavaScript untuk tim!');
  assert.ok(result.includes('analisis'));
  assert.ok(result.includes('javascript'));
  assert.ok(!result.includes('the'));
  assert.ok(!result.includes('untuk'));
});

test('analyzeResume menghasilkan skor terbatas dan disclaimer', () => {
  const resume = blankResume();
  resume.profile = { ...resume.profile, nama: 'Dina', email: 'dina@example.com', telepon: '08123456789', jabatan: 'Frontend Developer', ringkasan: 'Frontend developer dengan pengalaman membangun aplikasi web menggunakan JavaScript dan React.' };
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
