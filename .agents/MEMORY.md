# 🏛️ LolosATS Sovereign Institutional Memory

> **Proyek:** LolosATS (SaaS Builder CV ATS & Karir Profesional)  
> **Status:** Deployed & Production-Ready  
> **Domain Publik:** `https://lolosats.vercel.app` (Vercel CDN Edge)  
> **Backend Remote:** Supabase `lolosats-prod` (`uxiqklvnjtgscaulutld` — Singapore `ap-southeast-1`)  
> **Repository:** `https://github.com/erzandz11-glitch/lolosats` (Branch: `main`)  
> **Owner & Lead:** Rafif Ersan Dzaky ("Sir")  
> **Terakhir Diperbarui:** 25 November 2026  

---

## 1. Topologi Arsitektur & Kredensial Lingkungan

### A. Frontend (Vercel Edge)
- **Framework:** Vite + Vanilla Modular JavaScript (Zero heavy dependencies, ultra-lightweight)
- **Deployment ID:** `dpl_4RiXGR7fmbXnpvNWnoFYMAt8HJEv`
- **Environment Variables:**
  - `VITE_SUPABASE_URL`: `https://uxiqklvnjtgscaulutld.supabase.co`
  - `VITE_SUPABASE_ANON_KEY`: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` (Role: `anon`)
- **Security Audit:** **0 Secret Leaks**. `service_role` key dan database password 100% terisolasi dari bundle.

### B. Backend & Database (Supabase PostgreSQL 17)
- **Project Ref:** `uxiqklvnjtgscaulutld`
- **Tabel & RLS:**
  1. `public.profiles`: Profil pengguna, role (`user` / `admin`). RLS enabled.
  2. `public.resumes`: Data CV pengguna (JSONB + metadata). RLS enabled, terisolasi per `auth.uid() = user_id`.
  3. `public.licenses`: Lisensi komersial. RLS enabled, direct write dilarang untuk publik (`anon` & `authenticated`).
  4. `public.license_events`: Audit trail aktivasi & pencabutan lisensi. RLS enabled, direct write dilarang.
- **Edge Functions (Deno Runtime):**
  - `activate-license`: Mengonversi kode masukan pengguna ke SHA-256 hash, memverifikasi status `unused` dan tanggal kedaluwarsa, lalu mengikat lisensi ke `auth.uid()`.
  - `admin-license`: Memverifikasi role admin pengguna pemanggil, menghasilkan kode lisensi acak `LA-XXXXX`, menyimpan hash ke tabel `licenses`, serta menyediakan fungsi `revoke` dan `list`.

---

## 2. Invariant Keamanan & Pelajaran Teknis (Root-Cause Archive)

1. **Supabase GoTrue Schema Invariant:**
   - GoTrue driver memetakan kolom token (`confirmation_token`, `recovery_token`, `email_change_token_new`, dll.) ke tipe `string` murni (bukan `NullString`).
   - *Pencegahan:* Dilarang melakukan insert manual `NULL` pada kolom-kolom token `auth.users`. Selalu sediakan string kosong `''`.
   - Setiap pengguna email wajib memiliki baris koresponden di `auth.identities` dengan `provider = 'email'`.
2. **Supabase Free Tier Built-in SMTP Limit (3-4 email/jam):**
   - Built-in SMTP Supabase rentan terhadap error `HTTP 429: email rate limit exceeded`.
   - *Solusi Baku:* Gunakan Custom SMTP (Resend / SendGrid) pada dashboard Supabase untuk platform komersial.
3. **Penyimpanan Lisensi Komersial:**
   - Kode lisensi mentah HANYA dikembalikan satu kali saat admin membuat lisensi (`admin-license: create`).
   - Database hanya menyimpan digest satu arah `SHA-256(code)`. Bahkan jika database dibaca oleh pihak ketiga, kode mentah tidak dapat direkonstruksi.
4. **Isolasi RLS Multi-User:**
   - Seluruh query PostgREST pada tabel `resumes` disaring ketat melalui `auth.uid() = user_id`. Percobaan query langsung `SELECT`, `UPDATE`, `DELETE` antarpengguna diverifikasi mengembalikan 0 baris.

---

## 3. Direktori File & Test Suite

- **App Source:** `src/main.js`, `src/styles.css`, `src/lib/supabase.js`, `src/lib/docx.js`
- **Automated Tests:**
  - `tests/resume.test.mjs`: Unit test core schema CV & format.
  - `tests/cloud.integration.test.mjs`: Integrasi API Supabase lokal.
  - `tests/prod_functional_qa.mjs`: 20-point live production contract test suite.
- **Dokumentasi & Panduan:**
  - `README.md`: Dokumentasi instalasi dan arsitektur umum.
  - `docs/DEPLOYMENT_GUIDE.md`: Prosedur deployment ke Vercel & Supabase.
