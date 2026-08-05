# eClinic Chat v0.6

MVP cu autentificare Supabase și conversații private vizibile numai membrilor. Include delogare manuală vizibilă pe desktop și mobil și delogare automată după 15 minute de inactivitate.

1. Rulează integral `supabase-private-chat.sql` în Supabase SQL Editor.
2. În Vercel păstrează `NEXT_PUBLIC_SUPABASE_URL` și `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
3. Publică această versiune prin GitHub/Vercel.

Un utilizator trebuie să aibă deja cont înainte să fie adăugat după email.

Versiune de test: nu folosi date medicale reale. Criptarea end-to-end și cerințele complete pentru o aplicație medicală nu sunt implementate.
