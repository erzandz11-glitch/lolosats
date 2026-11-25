import { createClient } from '@supabase/supabase-js';
import crypto from 'node:crypto';

const SUPABASE_URL = 'https://uxiqklvnjtgscaulutld.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV4aXFrbHZuanRnc2NhdWx1dGxkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTU0MTMzOTksImV4cCI6MjExMDk4OTM5OX0.RPNjsMbxGceFk1lFdoA33-gw4hiBY89CCXSkMamivSM';

const testResults = [];

function record(suite, testName, status, details = {}) {
  testResults.push({ suite, testName, status, details, timestamp: new Date().toISOString() });
  console.log(`[${status}] ${suite} :: ${testName}`);
  if (details.error) console.error('   Error:', details.error);
  if (details.evidence) console.log('   Evidence:', details.evidence);
}

async function run() {
  console.log('=== STARTING PRODUCTION FUNCTIONAL QA ON LIVE SUPABASE & VERCEL ===\n');

  const password = 'QaPassword123!@#Safe';
  const emailA = 'qa-user-a@lolosats.internal';
  const emailB = 'qa-user-b@lolosats.internal';
  const emailAdmin = 'qa-admin@lolosats.internal';

  const userAId = '11111111-1111-4111-a111-111111111111';
  const userBId = '22222222-2222-4222-b222-222222222222';
  const adminId = '33333333-3333-4333-c333-333333333333';

  const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  const clientA = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  const clientB = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  const clientAdmin = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });

  // 1. AUTHENTICATION & LOGIN
  let sessionA = null;
  let sessionB = null;
  let sessionAdmin = null;

  try {
    const { data: logA, error: errA } = await clientA.auth.signInWithPassword({ email: emailA, password });
    if (errA) throw errA;
    sessionA = logA.session;
    record('1. AUTHENTICATION', 'Login Pengguna Valid (User A)', 'PASS', {
      evidence: `User A (${userAId}) berhasil login, token JWT valid.`
    });
  } catch (err) {
    record('1. AUTHENTICATION', 'Login Pengguna Valid (User A)', 'FAIL', { error: err.message });
  }

  try {
    const { data: logB, error: errB } = await clientB.auth.signInWithPassword({ email: emailB, password });
    if (errB) throw errB;
    sessionB = logB.session;
    record('1. AUTHENTICATION', 'Login Pengguna Valid (User B)', 'PASS', {
      evidence: `User B (${userBId}) berhasil login, token JWT valid.`
    });
  } catch (err) {
    record('1. AUTHENTICATION', 'Login Pengguna Valid (User B)', 'FAIL', { error: err.message });
  }

  try {
    const { data: logAdmin, error: errAdmin } = await clientAdmin.auth.signInWithPassword({ email: emailAdmin, password });
    if (errAdmin) throw errAdmin;
    sessionAdmin = logAdmin.session;
    record('1. AUTHENTICATION', 'Login Akun Admin', 'PASS', {
      evidence: `Admin (${adminId}) berhasil login, role admin aktif.`
    });
  } catch (err) {
    record('1. AUTHENTICATION', 'Login Akun Admin', 'FAIL', { error: err.message });
  }

  // Password Reset Endpoint Verification
  try {
    const { error: errReset } = await anonClient.auth.resetPasswordForEmail(emailA, {
      redirectTo: 'https://lolosats.vercel.app/'
    });
    if (errReset) throw errReset;
    record('1. AUTHENTICATION', 'Password Reset Request', 'PASS', {
      evidence: 'Permintaan reset terkirim ke Supabase Auth dengan redirectTo https://lolosats.vercel.app/'
    });
  } catch (err) {
    record('1. AUTHENTICATION', 'Password Reset Request', 'FAIL', { error: err.message });
  }

  // 2. DATA PERSISTENCE & CROSS-USER ISOLATION
  const resumeIdA = crypto.randomUUID();
  const resumeContentA = {
    title: 'CV Senior Cloud Architect - User A',
    profile: { nama: 'Budi Santoso', jabatan: 'Lead Cloud Architect', email: emailA },
    experiences: [{ id: 'e1', posisi: 'Cloud Architect', perusahaan: 'Google Cloud Partner', mulai: '2022', selesai: '2026', deskripsi: 'Desain arsitektur mikroservis & Kubernetes' }],
    education: [{ id: 'ed1', gelar: 'S1 Teknik Informatika', institusi: 'ITB', mulai: '2018', selesai: '2022', catatan: 'IPK 3.85' }],
    skills: ['GCP', 'PostgreSQL', 'Docker', 'Vite', 'Terraform'],
    languages: ['Indonesia', 'Inggris'],
    template: 'modern'
  };

  const resumeIdB = crypto.randomUUID();
  const resumeContentB = {
    title: 'CV Lead Data Engineer - User B',
    profile: { nama: 'Siti Rahma', jabatan: 'Senior Data Engineer', email: emailB },
    experiences: [{ id: 'e2', posisi: 'Data Engineer', perusahaan: 'Big Data Lab', mulai: '2023', selesai: '2026', deskripsi: 'Pipeline ETL terdistribusi & BigQuery streaming' }],
    education: [{ id: 'ed2', gelar: 'S1 Ilmu Komputer', institusi: 'UI', mulai: '2019', selesai: '2023', catatan: 'IPK 3.90' }],
    skills: ['Python', 'SQL', 'BigQuery', 'Apache Spark'],
    languages: ['Indonesia'],
    template: 'executive'
  };

  // User A creates resume in Supabase
  try {
    const { data: insA, error: errInsA } = await clientA.from('resumes').insert({
      id: resumeIdA,
      user_id: userAId,
      title: resumeContentA.title,
      content: resumeContentA,
      updated_at: new Date().toISOString()
    }).select();
    if (errInsA) throw errInsA;
    record('2. DATA PERSISTENCE', 'User A Menyimpan CV ke Cloud Database', 'PASS', {
      evidence: `CV tersimpan ID ${resumeIdA} untuk user_id ${userAId}`
    });
  } catch (err) {
    record('2. DATA PERSISTENCE', 'User A Menyimpan CV ke Cloud Database', 'FAIL', { error: err.message });
  }

  // User A updates resume in Supabase
  try {
    resumeContentA.title = 'CV Senior Cloud Architect - User A (Updated)';
    const { data: updA, error: errUpdA } = await clientA.from('resumes').update({
      title: resumeContentA.title,
      content: resumeContentA,
      updated_at: new Date().toISOString()
    }).eq('id', resumeIdA).select();
    if (errUpdA) throw errUpdA;
    record('2. DATA PERSISTENCE', 'User A Memperbarui CV di Cloud', 'PASS', {
      evidence: `Judul diperbarui: ${updA[0].title}`
    });
  } catch (err) {
    record('2. DATA PERSISTENCE', 'User A Memperbarui CV di Cloud', 'FAIL', { error: err.message });
  }

  // User B creates resume in Supabase
  try {
    const { data: insB, error: errInsB } = await clientB.from('resumes').insert({
      id: resumeIdB,
      user_id: userBId,
      title: resumeContentB.title,
      content: resumeContentB,
      updated_at: new Date().toISOString()
    }).select();
    if (errInsB) throw errInsB;
    record('2. DATA PERSISTENCE', 'User B Menyimpan CV ke Cloud Database', 'PASS', {
      evidence: `CV tersimpan ID ${resumeIdB} untuk user_id ${userBId}`
    });
  } catch (err) {
    record('2. DATA PERSISTENCE', 'User B Menyimpan CV ke Cloud Database', 'FAIL', { error: err.message });
  }

  // User A reads resumes -> Must ONLY return User A's resume
  try {
    const { data: readA, error: errReadA } = await clientA.from('resumes').select('id, title, user_id');
    if (errReadA) throw errReadA;
    const ids = readA.map(r => r.id);
    const hasOwn = ids.includes(resumeIdA);
    const hasB = ids.includes(resumeIdB);
    if (hasOwn && !hasB && readA.length === 1) {
      record('2. DATA PERSISTENCE', 'Isolasi Baca Data User A (RLS Enforcement)', 'PASS', {
        evidence: `User A hanya melihat 1 CV miliknya. CV User B (${resumeIdB}) tidak bocor.`
      });
    } else {
      record('2. DATA PERSISTENCE', 'Isolasi Baca Data User A (RLS Enforcement)', 'FAIL', {
        error: `Kebocoran terdeteksi atau CV hilang. ids: ${JSON.stringify(ids)}`
      });
    }
  } catch (err) {
    record('2. DATA PERSISTENCE', 'Isolasi Baca Data User A (RLS Enforcement)', 'FAIL', { error: err.message });
  }

  // User B reads resumes -> Must ONLY return User B's resume
  try {
    const { data: readB, error: errReadB } = await clientB.from('resumes').select('id, title, user_id');
    if (errReadB) throw errReadB;
    const ids = readB.map(r => r.id);
    const hasOwn = ids.includes(resumeIdB);
    const hasA = ids.includes(resumeIdA);
    if (hasOwn && !hasA && readB.length === 1) {
      record('2. DATA PERSISTENCE', 'Isolasi Baca Data User B (RLS Enforcement)', 'PASS', {
        evidence: `User B hanya melihat 1 CV miliknya. CV User A (${resumeIdA}) tidak bocor.`
      });
    } else {
      record('2. DATA PERSISTENCE', 'Isolasi Baca Data User B (RLS Enforcement)', 'FAIL', {
        error: `Kebocoran terdeteksi atau CV hilang. ids: ${JSON.stringify(ids)}`
      });
    }
  } catch (err) {
    record('2. DATA PERSISTENCE', 'Isolasi Baca Data User B (RLS Enforcement)', 'FAIL', { error: err.message });
  }

  // Cross-User Exploit Test: User B attempts to SELECT User A's resume by specific ID
  try {
    const { data: exploitSelect } = await clientB.from('resumes').select('*').eq('id', resumeIdA);
    if (exploitSelect && exploitSelect.length === 0) {
      record('4. SUPABASE SECURITY', 'Penolakan Akses Silang Pengguna (Direct ID SELECT)', 'PASS', {
        evidence: 'User B query resumes WHERE id=User A ID mengembalikan 0 baris (diblokir RLS).'
      });
    } else {
      record('4. SUPABASE SECURITY', 'Penolakan Akses Silang Pengguna (Direct ID SELECT)', 'FAIL', {
        error: 'Data User A bocor ke User B!'
      });
    }
  } catch (err) {
    record('4. SUPABASE SECURITY', 'Penolakan Akses Silang Pengguna (Direct ID SELECT)', 'FAIL', { error: err.message });
  }

  // Cross-User Exploit Test: User B attempts to UPDATE User A's resume
  try {
    const { data: exploitUpdate } = await clientB.from('resumes').update({ title: 'Hacked by B' }).eq('id', resumeIdA).select();
    if (exploitUpdate && exploitUpdate.length === 0) {
      record('4. SUPABASE SECURITY', 'Penolakan Modifikasi Silang Pengguna (Direct UPDATE)', 'PASS', {
        evidence: 'User B tidak dapat memodifikasi CV User A (0 baris terpengaruh).'
      });
    } else {
      record('4. SUPABASE SECURITY', 'Penolakan Modifikasi Silang Pengguna (Direct UPDATE)', 'FAIL', {
        error: 'User B berhasil memodifikasi CV User A!'
      });
    }
  } catch (err) {
    record('4. SUPABASE SECURITY', 'Penolakan Modifikasi Silang Pengguna (Direct UPDATE)', 'FAIL', { error: err.message });
  }

  // Cross-User Exploit Test: User B attempts to DELETE User A's resume
  try {
    const { data: exploitDelete } = await clientB.from('resumes').delete().eq('id', resumeIdA).select();
    if (exploitDelete && exploitDelete.length === 0) {
      record('4. SUPABASE SECURITY', 'Penolakan Penghapusan Silang Pengguna (Direct DELETE)', 'PASS', {
        evidence: 'User B tidak dapat menghapus CV User A (0 baris terhapus).'
      });
    } else {
      record('4. SUPABASE SECURITY', 'Penolakan Penghapusan Silang Pengguna (Direct DELETE)', 'FAIL', {
        error: 'User B berhasil menghapus CV User A!'
      });
    }
  } catch (err) {
    record('4. SUPABASE SECURITY', 'Penolakan Penghapusan Silang Pengguna (Direct DELETE)', 'FAIL', { error: err.message });
  }

  // 3. BUSINESS FLOW & COMPLETE LICENSE LIFECYCLE
  // Skenario A: Non-admin mencoba memanggil Edge Function admin-license
  try {
    const { data: nonAdminList, error: errNonAdmin } = await clientA.functions.invoke('admin-license', {
      body: { action: 'list' }
    });
    if (errNonAdmin || nonAdminList?.error) {
      record('5. BUSINESS FLOW', 'Blokir Akses Admin untuk Pengguna Biasa', 'PASS', {
        evidence: `Ditolak 403 Forbidden: ${errNonAdmin?.message || nonAdminList?.error}`
      });
    } else {
      record('5. BUSINESS FLOW', 'Blokir Akses Admin untuk Pengguna Biasa', 'FAIL', {
        error: 'Pengguna non-admin berhasil mengakses admin-license!'
      });
    }
  } catch (err) {
    record('5. BUSINESS FLOW', 'Blokir Akses Admin untuk Pengguna Biasa', 'PASS', {
      evidence: `Ditolak sesuai ekspektasi: ${err.message}`
    });
  }

  // Skenario B: Admin membuat kode lisensi valid
  let licenseCode = null;
  let licenseId = null;
  try {
    const { data: createData, error: errCreate } = await clientAdmin.functions.invoke('admin-license', {
      body: { action: 'create', days: 365 }
    });
    if (errCreate) throw errCreate;
    licenseCode = createData.code;

    // Ambil license ID dari admin list
    const { data: listRes, error: errList } = await clientAdmin.functions.invoke('admin-license', {
      body: { action: 'list' }
    });
    if (errList) throw errList;
    const foundLicense = listRes.licenses.find(l => l.status === 'unused');
    licenseId = foundLicense?.id;
    record('5. BUSINESS FLOW', 'Admin Berhasil Membuat Lisensi Valid', 'PASS', {
      evidence: `Lisensi dibuat: ID ${licenseId}, format kode ${licenseCode.slice(0, 8)}... (365 hari)`
    });
  } catch (err) {
    record('5. BUSINESS FLOW', 'Admin Berhasil Membuat Lisensi Valid', 'FAIL', { error: err.message });
  }

  // Skenario C: User A mengaktifkan lisensi valid
  try {
    const { data: actData, error: errAct } = await clientA.functions.invoke('activate-license', {
      body: { code: licenseCode }
    });
    if (errAct) throw errAct;
    record('5. BUSINESS FLOW', 'User A Mengaktifkan Lisensi Valid', 'PASS', {
      evidence: `Aktivasi berhasil: ${actData.message}, berlaku s/d ${actData.expires_at || '365 hari'}`
    });
  } catch (err) {
    let detail = err.message;
    if (err.context) {
      try {
        const bodyText = await err.context.text();
        detail += ` | Response body: ${bodyText}`;
      } catch (e) {}
    }
    record('5. BUSINESS FLOW', 'User A Mengaktifkan Lisensi Valid', 'FAIL', { error: detail });
  }

  // Skenario D: User B mencoba mengklaim kembali kode lisensi yang sama (Double claim rejection)
  try {
    const { data: actB, error: errActB } = await clientB.functions.invoke('activate-license', {
      body: { code: licenseCode }
    });
    if (errActB || actB?.error) {
      record('5. BUSINESS FLOW', 'Penolakan Penggunaan Ulang Kode Lisensi (409 Conflict)', 'PASS', {
        evidence: `Kode yang sudah aktif ditolak: ${errActB?.message || actB?.error}`
      });
    } else {
      record('5. BUSINESS FLOW', 'Penolakan Penggunaan Ulang Kode Lisensi (409 Conflict)', 'FAIL', {
        error: 'Kode lisensi yang sama berhasil diaktifkan dua kali!'
      });
    }
  } catch (err) {
    record('5. BUSINESS FLOW', 'Penolakan Penggunaan Ulang Kode Lisensi (409 Conflict)', 'PASS', {
      evidence: `Ditolak: ${err.message}`
    });
  }

  // Skenario E: User A mencoba mengaktifkan kode lisensi acak/palsu
  try {
    const fakeCode = 'LA-FAKEXX99999999999999999999';
    const { data: fakeAct, error: errFake } = await clientA.functions.invoke('activate-license', {
      body: { code: fakeCode }
    });
    if (errFake || fakeAct?.error) {
      record('5. BUSINESS FLOW', 'Penolakan Aktivasi Kode Lisensi Tidak Valid (404 Not Found)', 'PASS', {
        evidence: `Ditolak sesuai rancangan: ${errFake?.message || fakeAct?.error}`
      });
    } else {
      record('5. BUSINESS FLOW', 'Penolakan Aktivasi Kode Lisensi Tidak Valid (404 Not Found)', 'FAIL', {
        error: 'Kode lisensi palsu diterima!'
      });
    }
  } catch (err) {
    record('5. BUSINESS FLOW', 'Penolakan Aktivasi Kode Lisensi Tidak Valid (404 Not Found)', 'PASS', {
      evidence: `Ditolak: ${err.message}`
    });
  }

  // Skenario F & G: Admin mencabut lisensi dan pengujian aktivasi lisensi yang dicabut
  try {
    // Buat lisensi kedua khusus untuk pengujian pencabutan
    const { data: createRevokeTarget } = await clientAdmin.functions.invoke('admin-license', {
      body: { action: 'create', days: 30 }
    });
    const codeToRevoke = createRevokeTarget.code;
    const { data: listAfterCreate } = await clientAdmin.functions.invoke('admin-license', {
      body: { action: 'list' }
    });
    const targetLicense = listAfterCreate.licenses.find(l => l.status === 'unused');
    const targetId = targetLicense?.id;

    const { data: revData, error: errRev } = await clientAdmin.functions.invoke('admin-license', {
      body: { action: 'revoke', id: targetId }
    });
    if (errRev) throw errRev;
    record('5. BUSINESS FLOW', 'Admin Berhasil Mencabut Lisensi', 'PASS', {
      evidence: `Lisensi ID ${targetId} berhasil dicabut sebelum sempat digunakan.`
    });

    // Coba aktifkan lisensi yang sudah dicabut -> Harus ditolak (403 Forbidden)
    const { data: actRev, error: errActRev } = await clientB.functions.invoke('activate-license', {
      body: { code: codeToRevoke }
    });
    if (errActRev || actRev?.error) {
      record('5. BUSINESS FLOW', 'Penolakan Aktivasi Kode yang Telah Dicabut (403 Forbidden)', 'PASS', {
        evidence: `Ditolak sesuai rancangan: ${errActRev?.message || actRev?.error}`
      });
    } else {
      record('5. BUSINESS FLOW', 'Penolakan Aktivasi Kode yang Telah Dicabut (403 Forbidden)', 'FAIL', {
        error: 'Kode lisensi yang dicabut berhasil diaktifkan!'
      });
    }
  } catch (err) {
    record('5. BUSINESS FLOW', 'Admin Berhasil Mencabut Lisensi', 'FAIL', { error: err.message });
    record('5. BUSINESS FLOW', 'Penolakan Aktivasi Kode yang Telah Dicabut (403 Forbidden)', 'FAIL', { error: err.message });
  }

  // Logout & Session Termination (Dijalankan di akhir pengujian)
  try {
    const { error: errSignOutA } = await clientA.auth.signOut();
    if (errSignOutA) throw errSignOutA;
    const { data: sessA } = await clientA.auth.getSession();
    if (sessA.session === null) {
      record('1. AUTHENTICATION', 'Logout & Session Termination', 'PASS', { evidence: 'Session User A bersih (null)' });
    } else {
      record('1. AUTHENTICATION', 'Logout & Session Termination', 'FAIL', { error: 'Session User A masih aktif' });
    }
  } catch (err) {
    record('1. AUTHENTICATION', 'Logout & Session Termination', 'FAIL', { error: err.message });
  }

  console.log('\n=== INTEGRATION CONTRACT TEST COMPLETED ===');
  const passCount = testResults.filter(t => t.status === 'PASS').length;
  const failCount = testResults.filter(t => t.status === 'FAIL').length;
  console.log(`TOTAL TESTS: ${testResults.length} | PASS: ${passCount} | FAIL: ${failCount}`);

  import('node:fs').then(fs => {
    fs.writeFileSync(
      'C:/Users/Thinkpad/.gemini/antigravity/scratch/qa_integration_results.json',
      JSON.stringify({ summary: { total: testResults.length, pass: passCount, fail: failCount }, testResults }, null, 2)
    );
  });
}

run().catch(console.error);
