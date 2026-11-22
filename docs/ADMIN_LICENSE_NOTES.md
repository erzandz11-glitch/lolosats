# Operasional lisensi LolosATS

## Alur yang disiapkan

1. Pembeli menyelesaikan transaksi di toko eksternal milik penjual.
2. Admin membuat kode lisensi dari menu **Admin lisensi** di aplikasi.
3. Admin mengirim kode tersebut kepada pembeli melalui kanal toko.
4. Pembeli membuat akun / masuk ke LolosATS, lalu memilih **Aktifkan lisensi**.
5. Edge Function memverifikasi kode di server, menyimpan hash SHA-256, dan mengikat lisensi ke akun pertama yang mengaktifkannya.

LolosATS tidak memproses pembayaran dan tidak terhubung ke payment gateway. Distribusi file dan pembayaran tetap ditangani toko eksternal.

## Keamanan

- `SUPABASE_SERVICE_ROLE_KEY` hanya boleh disimpan sebagai secret Edge Function. Jangan menaruhnya di `.env` frontend, Git, atau mengirimkannya melalui chat.
- Frontend hanya menggunakan Project URL dan anon/publishable key.
- Kode lisensi mentah tidak disimpan di database; yang disimpan adalah hash SHA-256.
- Aktivasi memakai update bersyarat agar satu kode tidak dapat diklaim bersamaan oleh dua akun.
- RLS membatasi data CV berdasarkan `user_id`.
- Role admin ditetapkan manual melalui SQL Editor setelah memeriksa UUID akun yang benar.

## Membuat admin pertama

Setelah akun admin dibuat dan email dikonfirmasi, jalankan SQL berikut dengan UUID akun yang sudah diverifikasi:

```sql
update public.profiles
set role = 'admin'
where id = 'UUID_AKUN_ADMIN';
```

Jangan menebak atau memakai UUID milik akun lain.

## Catatan operasional

- Kode yang baru dibuat hanya ditampilkan sekali. Salin dan simpan di sistem penjualan yang aman.
- Masa berlaku dihitung sejak kode dibuat, bukan sejak pertama diaktifkan.
- Admin dapat melihat daftar lisensi dan mencabut lisensi dari menu admin.
- Pencabutan tidak dapat dibatalkan dari UI saat ini.
- Aktivasi lisensi saat ini merupakan verifikasi akses dasar, bukan sistem pembayaran, anti-pembajakan sempurna, atau jaminan bahwa file aplikasi tidak dapat disalin.
