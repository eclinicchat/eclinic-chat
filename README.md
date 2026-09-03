# eClinic Chat v1.2.1

Versiunea v1.2.1 păstrează explicit starea de recuperare în adresa aplicației, astfel încât linkul din email să deschidă întotdeauna formularul pentru alegerea parolei noi.

## Actualizare de securitate de la v1.1

1. Rulează integral, o singură dată, fișierul `supabase-security-v1.2.sql` în Supabase.
2. Publică fișierele actualizate ale aplicației prin GitHub și Vercel.

Versiunea v1.2 adaugă recuperarea parolei contului, fixează identitatea expeditorului pe server, validează imaginile și cere deblocarea grupului înaintea operațiilor administrative. De asemenea, adaugă antete de securitate pentru aplicația web.

## Actualizare de securitate de la v1.0

1. Rulează integral, o singură dată, fișierul `supabase-security-v1.1.sql` în Supabase: **SQL Editor → New query → Run**.
2. Încarcă în GitHub fișierele actualizate ale aplicației și publică prin Vercel.
3. Nu rula din nou scripturile SQL vechi.

Actualizarea v1.1 impune parola grupului și în baza de date pentru mesaje, reacții și imagini. Deblocarea expiră după 15 minute și se închide la schimbarea grupului sau la ieșirea din cont.

Versiunea 1.0 adaugă organizarea pe comunități și reguli clare pentru administratori, păstrând conversațiile private, imaginile, răspunsurile, reacțiile, mesajele fixate și contoarele de mesaje necitite.

## Actualizare de la v0.9 sau v0.9.1

1. Rulează integral, o singură dată, fișierul `supabase-communities-v1.0.sql` în Supabase: SQL Editor → New query → Run.
2. Încarcă în GitHub fișierele aplicației din această arhivă și publică prin Vercel.
3. Nu rula din nou scripturile SQL vechi.

Contul `cosmin@test.com` este introdus ca administrator general. Contul trebuie să existe deja în Supabase Authentication înainte de rularea scriptului v1.0.

## Instalare nouă

Rulează în această ordine:

1. `supabase-private-chat.sql`
2. `supabase-chat-images.sql`
3. `supabase-conversation-management.sql`
4. `supabase-messaging-v0.9.sql`
5. `supabase-communities-v1.0.sql`

În Vercel trebuie păstrate variabilele `NEXT_PUBLIC_SUPABASE_URL` și `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

## Reguli de acces

- Administratorul general creează și șterge comunități și desemnează administratorii lor.
- Administratorul unei comunități gestionează membrii și poate crea grupuri numai în comunitatea sa.
- Numai administratorii pot crea grupuri; creatorul devine proprietarul grupului.
- Numai proprietarul acordă sau retrage rolul de administrator al grupului și poate șterge grupul.
- Proprietarul și administratorii grupului pot redenumi grupul, gestiona membrii, schimba parola și fixa mesaje.
- Proprietarul nu poate fi eliminat din grup.
- Administratorul general nu intră automat într-un grup privat și nu îi vede mesajele dacă nu este membru.
- Acțiunile administrative importante sunt înregistrate în jurnalul aplicației.

Parola suplimentară este cerută numai după selectarea grupului protejat. Ea este stocată ca hash și se blochează temporar după cinci încercări greșite. Contoarele de mesaje necitite nu sunt afișate pentru grupurile protejate.

Versiune de test: nu folosi date medicale reale. Criptarea end-to-end și cerințele complete pentru o aplicație medicală nu sunt implementate.
