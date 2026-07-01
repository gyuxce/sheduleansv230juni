# Nihongo Class SaaS

Fondasi SaaS multi-tenant untuk manajemen kelas bahasa Jepang menggunakan Next.js dan Supabase.

## Menjalankan aplikasi

1. Salin `.env.example` menjadi `.env.local`.
2. Isi URL dan publishable key dari project Supabase.
3. Jalankan migration pada `supabase/migrations` melalui Supabase CLI atau dashboard SQL Editor.
4. Instal dependency dan jalankan aplikasi:

```bash
npm install
npm run dev
```

Nama key yang direkomendasikan adalah `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
Untuk kompatibilitas dengan project Supabase lama, aplikasi juga menerima
`NEXT_PUBLIC_SUPABASE_ANON_KEY`.

## Pemeriksaan kualitas

```bash
npm run typecheck
npm run lint
npm run build
```

Integration test untuk alur booking dapat dijalankan pada Supabase lokal atau
project staging yang terisolasi:

```bash
npm run test:integration
```

Test membuat data sementara lalu membersihkannya. Target remote hanya diizinkan
jika `ALLOW_REMOTE_INTEGRATION_TESTS=true`; jangan arahkan variabel `TEST_*` ke
production.

Detail keputusan teknis tersedia di [ARSITEKTUR-SAAS.md](./ARSITEKTUR-SAAS.md).

## Modul yang tersedia

- Login dan routing berdasarkan role tenant.
- Onboarding organisasi pertama.
- Kalender kelas FullCalendar dengan pembaruan realtime.
- Availability sensei dan pemecahan slot otomatis.
- Booking slot oleh murid dan approval admin.
- Input booking manual untuk sensei yang memiliki izin.
- Blok jadwal eksternal sensei.
- RLS, audit log, notifikasi, optimistic locking, dan pencegahan overlap.
- Notification bell realtime dan dashboard statistik/utilisasi admin.

## Pembuatan akun sensei dan murid

Untuk fase pengujian, admin membuat akun secara langsung dengan email dan
password sementara. Akun langsung dikonfirmasi dan tidak mengirim email.
Fitur ini memakai Supabase Admin API hanya di server. Tambahkan
`SUPABASE_SERVICE_ROLE_KEY` ke environment Vercel tanpa awalan `NEXT_PUBLIC_`.
Setelah menambahkan environment variable, lakukan redeploy. Jangan pernah
memasukkan service-role key ke source code atau mengirimkannya ke browser.
