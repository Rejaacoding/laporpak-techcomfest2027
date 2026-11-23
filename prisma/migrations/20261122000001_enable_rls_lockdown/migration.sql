-- Tutup akses PostgREST publik (anon/authenticated) di Supabase untuk seluruh 6 tabel schema public.
-- Prisma terhubung langsung lewat pooler PostgreSQL (role postgres memiliki BYPASSRLS) sehingga tetap berjalan normal,
-- sementara hacker dengan SUPABASE_ANON_KEY dari browser ditolak total di /rest/v1/.

ALTER TABLE "Department" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Ticket" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TicketSupport" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TicketValidation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AuditLog" ENABLE ROW LEVEL SECURITY;
