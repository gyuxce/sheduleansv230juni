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
