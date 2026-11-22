# LolosATS

LolosATS adalah aplikasi workspace karier untuk menyusun CV, membandingkan CV dengan deskripsi lowongan, dan menyiapkan surat lamaran. Frontend menggunakan Vite + JavaScript modular. Supabase dapat digunakan untuk autentikasi, penyimpanan cloud, Row Level Security (RLS), dan aktivasi lisensi.

## Fitur dalam paket

- Multi-dokumen CV: buat, pilih, ubah nama, dan hapus dokumen.
- Editor profil, pengalaman, pendidikan, keahlian, bahasa, sertifikasi, dan penghargaan.
- Preview CV langsung dengan template Modern, Minimalis, dan Eksekutif.
- Analisis kata kunci lowongan dan checklist struktur CV dengan skor heuristik yang transparan.
- Generator surat lamaran berdasarkan informasi yang dimasukkan pengguna; hasil dapat diedit.
- Export PDF melalui dialog print browser dan export DOCX.
- Backup dan import workspace dalam format JSON.
- Penyimpanan lokal otomatis; Supabase menyediakan login dan sinkronisasi cloud setelah dikonfigurasi.
- Cache lokal dipisahkan per akun agar workspace lokal anonim tidak otomatis disalin ke akun lain pada perangkat yang sama.
- Skema PostgreSQL + RLS, Edge Function aktivasi lisensi, serta UI admin untuk membuat, melihat, dan mencabut lisensi.

## Persyaratan

- Node.js versi LTS (disarankan 20 atau lebih baru).
- npm.
- Akun Supabase untuk fitur akun dan sinkronisasi cloud.
- Akun Vercel untuk deployment.

## Menjalankan lokal

```bash
npm install
npm run dev
```

Buka alamat lokal yang ditampilkan Vite. Aplikasi dapat dicoba tanpa Supabase; data tersimpan di browser/perangkat yang sama.

## Pemeriksaan otomatis

```bash
npm test
```

Tes saat ini memeriksa struktur data CV, normalisasi data, escaping HTML, tokenisasi, dan perilaku dasar analisis ATS. Tes ini bukan pengganti pengujian browser, database, atau end-to-end.

## Mengaktifkan Supabase

1. Buat project Supabase.
2. Salin `.env.example` menjadi `.env.local`.
3. Isi `VITE_SUPABASE_URL` dan `VITE_SUPABASE_ANON_KEY` dari Project Settings → API.
4. Jalankan `supabase/migrations/001_initial_schema.sql` melalui SQL Editor atau Supabase CLI.
5. Deploy Edge Functions `activate-license` dan `admin-license`.
6. Set secret Edge Function `SUPABASE_URL`, `SUPABASE_ANON_KEY`, dan `SUPABASE_SERVICE_ROLE_KEY` melalui Supabase CLI / dashboard secrets. **Service role key hanya boleh berada di server, jangan pernah dimasukkan ke frontend.**
7. Buat akun admin, verifikasi UUID-nya, lalu tetapkan role melalui SQL Editor sesuai `docs/ADMIN_LICENSE_NOTES.md`.

Jika Supabase belum dikonfigurasi, fitur lokal tetap dapat digunakan tetapi login dan sinkronisasi cloud tidak tersedia. Data lokal tidak otomatis dipindahkan ke akun cloud; gunakan backup/import untuk memindahkan data secara sadar.

## Deployment Vercel

- Import repository Git ke Vercel.
- Framework preset: Vite.
- Build command: `npm run build`.
- Output directory: `dist`.
- Tambahkan `VITE_SUPABASE_URL` dan `VITE_SUPABASE_ANON_KEY` sebagai environment variables.
- Setelah deployment, uji login, isolasi data antar akun, CRUD CV, export, backup/import, dan tampilan di beberapa ukuran layar.

## Struktur proyek

```text
src/
  main.js                 UI, editor, preview, event handling
  styles.css              responsive design dan print layout
  services/supabase.js    konfigurasi Supabase client
  services/store.js       penyimpanan lokal/cloud dan autentikasi
  services/analysis.js    analisis kata kunci dan checklist ATS
  utils/helpers.js        helper dan normalisasi data CV
supabase/
  migrations/             skema PostgreSQL + RLS
  functions/              Edge Functions lisensi
  functions/_shared/      helper CORS
 tests/                   tes otomatis fungsi inti
```

## Batasan yang harus diselesaikan sebelum rilis komersial

- Belum dilakukan build produksi Vite karena pengunduhan dependency npm pada lingkungan pemeriksaan tidak selesai. Jalankan `npm install`, `npm test`, dan `npm run build` di laptop.
- Belum dilakukan pengujian browser end-to-end atau pengujian pada project Supabase/Vercel nyata.
- Sinkronisasi cloud membutuhkan konfigurasi Supabase yang benar. Konflik edit bersamaan dari beberapa perangkat belum memiliki mekanisme merge.
- Pemulihan password mengirim email reset; konfigurasi redirect dan alur penggantian password perlu diuji pada project Supabase produksi.
- PDF memakai fitur print browser; periksa ukuran A4, page break, dan warna pada Chrome/Edge.
- DOCX export sudah mencakup data utama, tetapi layout dan page break tetap perlu diuji di Microsoft Word dan LibreOffice.
- Analisis ATS adalah heuristik kata kunci dan struktur, bukan parser ATS perusahaan, bukan prediksi rekrutmen, dan bukan jaminan lolos seleksi.
- Surat lamaran adalah draf berbasis data yang dimasukkan pengguna. Pengguna harus memeriksa ulang agar tidak memuat klaim yang tidak benar.
- Aktivasi lisensi adalah alur manual terpisah dari pembayaran. Aplikasi tidak mengintegrasikan payment gateway dan tidak memproses transaksi toko.
- Belum ada kebijakan privasi, syarat layanan, halaman dukungan, proses penghapusan akun end-to-end, monitoring, atau backup database produksi.

## Checklist sebelum menerima pembayaran

- [ ] `npm install`, `npm test`, dan `npm run build` berhasil di laptop.
- [ ] Supabase migration dan kedua Edge Functions berhasil dipasang.
- [ ] Uji RLS memakai dua akun berbeda; pastikan data antar akun tidak dapat dibaca atau diubah.
- [ ] Uji pendaftaran, verifikasi email, login, logout, reset password, dan sesi kedaluwarsa.
- [ ] Uji aktivasi, penggunaan ulang, kedaluwarsa, dan pencabutan lisensi.
- [ ] Uji CRUD CV, backup/import, PDF A4, dan DOCX dengan data panjang serta karakter khusus.
- [ ] Uji Chrome desktop dan beberapa ukuran layar mobile.
- [ ] Siapkan kebijakan privasi, syarat layanan, dukungan pelanggan, dan prosedur penghapusan akun.
- [ ] Deploy ke Vercel, pasang domain, HTTPS, dan lakukan smoke test produksi.
