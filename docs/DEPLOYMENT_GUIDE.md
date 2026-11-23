# Panduan Deployment & Rollback Produksi LolosATS

Dokumen ini memuat panduan komprehensif untuk mempublikasikan LolosATS ke Vercel secara aman, memverifikasi fungsi di domain publik, dan menjalankan rollback darurat jika diperlukan.

---

## 1. Arsitektur Produksi

* **Frontend:** Single Page Application (Vite 6 + Vanilla JS modular)
* **Hosting Frontend:** Vercel (Edge Network / Global CDN)
* **Backend Database:** Supabase PostgreSQL 17 (`ap-southeast-1` Singapore)
* **Autentikasi & Penyimpanan:** Supabase Auth + Row Level Security (RLS)
* **Serverless Logic:** Supabase Edge Functions (`activate-license`, `admin-license`)

---

## 2. Environment Variables Produksi (Vercel)

Masukkan variabel berikut pada menu **Project Settings → Environment Variables** di Vercel:

| Nama Variabel | Nilai Produksi | Lingkungan | Keterangan |
| :--- | :--- | :--- | :--- |
| `VITE_SUPABASE_URL` | `https://uxiqklvnjtgscaulutld.supabase.co` | Production, Preview, Development | Project API URL resmi Supabase |
| `VITE_SUPABASE_ANON_KEY` | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV4aXFrbHZuanRnc2NhdWx1dGxkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTU0MTMzOTksImV4cCI6MjExMDk4OTM5OX0.RPNjsMbxGceFk1lFdoA33-gw4hiBY89CCXSkMamivSM` | Production, Preview, Development | Anon/Publishable Client Key (aman untuk publik) |

> ⚠️ **Catatan Keamanan:** Jangan pernah menambahkan `SUPABASE_SERVICE_ROLE_KEY` ke Vercel frontend. Service role key hanya berada di Supabase runtime untuk Edge Functions.

---

## 3. Konfigurasi Vercel

* **Framework Preset:** `Vite`
* **Root Directory:** `./`
* **Build Command:** `npm run build`
* **Output Directory:** `dist`
* **Install Command:** `npm install`
* **Routing:** `vercel.json` sudah mengatur rewrite otomatis ke `/index.html` dan security headers (HSTS, CSP-friendly headers, no-sniff, deny iframing).

---

## 4. Konfigurasi URL Autentikasi Supabase

Sebelum membuka akses ke publik, sesuaikan URL pada **Supabase Dashboard → Authentication → URL Configuration**:

1. **Site URL:**
   `https://lolosats.vercel.app` (atau nama domain produksi Vercel yang didapatkan).
2. **Redirect URLs (Tambahkan satu per satu):**
   * `http://localhost:5173`
   * `http://localhost:5180`
   * `https://*.vercel.app`
   * `https://*.vercel.app/**`

Ini memastikan tautan pemulihan kata sandi (*password reset*) dan konfirmasi email dapat dialihkan kembali ke peramban pengguna secara benar.

---

## 5. Menetapkan Akun Admin Pertama di Produksi

Setelah LolosATS aktif di Vercel:
1. Buka aplikasi di domain Vercel.
2. Klik tombol **Masuk / Daftar**, lalu daftarkan akun email pemilik/admin.
3. Buka **Supabase Dashboard → SQL Editor** pada project `lolosats-prod`, lalu jalankan query:
   ```sql
   update public.profiles
   set role = 'admin'
   where id = (
     select id from auth.users where email = 'EMAIL_ADMIN_PEMILIK@DOMAIN.COM'
   );
   ```
4. Muat ulang aplikasi; menu **Admin lisensi** akan langsung terbuka dan aktif.

---

## 6. Prosedur Rollback Darurat (Rollback Strategy)

Jika terjadi kendala kritis pada rilis produksi baru:

### A. Instant Rollback via Vercel Dashboard (Rekomendasi - 5 Detik)
1. Buka dashboard proyek LolosATS di Vercel.
2. Buka tab **Deployments**.
3. Temukan deployment stabil sebelumnya yang berstatus *Ready*.
4. Klik menu elipsis (`...`) di kanan baris deployment tersebut, lalu pilih **Instant Rollback / Promote to Production**.
5. Vercel akan langsung mengarahkan traffic DNS publik ke build stabil sebelumnya tanpa perlu build ulang.

### B. Rollback via Git
1. Periksa riwayat commit: `git log --oneline -n 5`
2. Kembalikan ke commit checkpoint stabil:
   ```bash
   git revert HEAD
   git push origin main
   ```
3. Vercel akan otomatis mendeteksi push dan mendeploy versi rollback.
