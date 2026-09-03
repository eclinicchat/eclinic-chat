# eClinic Chat v1.0

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
