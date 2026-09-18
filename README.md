# eClinTalk v1.7.0

Versiunea v1.7 redenumește aplicația în **eClinTalk**, simplifică meniul și pagina de început, adaugă interfață română/engleză, profil cu nume afișat și menționări prin `@nume`. Logo-ul și pictograma existente rămân neschimbate, iar mențiunea „Creat de eClinic Hub” apare discret.

## Actualizare de la v1.6

1. Rulează integral, o singură dată, fișierul `supabase-eclintalk-v1.7.sql` în **Supabase → SQL Editor → New query → Run**.
2. Încarcă în GitHub toate fișierele aplicației din această versiune.
3. Așteaptă ca publicarea Vercel să ajungă la starea **Ready**.
4. După autentificare, deschide **Profil** pentru a alege numele afișat și limba interfeței.

Scriptul v1.7 trebuie rulat înainte de publicarea aplicației, deoarece mesajele noi salvează identificatorii persoanelor menționate. Pe iPhone, dacă numele de sub pictogramă nu se actualizează automat, elimină pictograma veche și adaugă din nou aplicația pe ecranul principal.

## Versiunea v1.6

Versiunea v1.6 adaugă notificări Web Push reale, instalare PWA pe Mac/iPhone și preferințe individuale pe grup. Notificarea afișează doar numele grupului și textul generic „Ai primit un mesaj nou”, fără conținutul conversației.

## Actualizare de la v1.5

1. Rulează integral, o singură dată, fișierul `supabase-push-notifications-v1.6.sql` în Supabase.
2. Încarcă în GitHub toate fișierele aplicației din această versiune.
3. În Vercel adaugă variabilele:
   - `SUPABASE_SERVICE_ROLE_KEY` — cheia `service_role` din Supabase; este secretă și nu se introduce în GitHub.
   - `NEXT_PUBLIC_VAPID_PUBLIC_KEY` — cheia publică Web Push.
   - `VAPID_PRIVATE_KEY` — cheia privată Web Push; este secretă și nu se introduce în GitHub.
4. După redeploy, deschide **Setări → Notificări → Activează notificările pe acest dispozitiv**.

Pe iPhone, notificările Web Push funcționează după instalarea aplicației pe ecranul principal: Safari → Partajare → Adaugă la ecranul principal. Apoi aplicația se deschide din pictograma eClinTalk, iar notificările se activează din meniul grupului.

La ieșirea explicită din cont, abonamentul push al dispozitivului este eliminat pentru protejarea confidențialității. Pentru a primi din nou notificări după autentificare, acestea se reactivează din meniul grupului.

## Versiunea v1.5

Versiunea v1.5 adaugă preferințe individuale pentru notificări pe grup: activare/dezactivare, sunet, numai mențiuni și suspendare temporară pentru 1 sau 8 ore.

## Versiunea v1.4.1

Versiunea v1.4.1 transformă automat adresele web `http://` și `https://` din mesaje în linkuri apăsabile, care se deschid într-o filă nouă. Actualizarea nu necesită niciun script SQL nou.

Pentru actualizarea de la v1.4 se publică numai fișierele aplicației prin GitHub și Vercel.

## Actualizare de la v1.3

Versiunea v1.4 adaugă ștergerea securizată a mesajelor. Autorul își poate șterge propriile mesaje, iar administratorii grupului pot elimina orice mesaj. Conținutul, imaginea, reacțiile și fixarea sunt eliminate, acțiunea este jurnalizată, iar în conversație rămâne marcajul neutru „Mesaj șters”.

Pentru actualizarea de la v1.3:

1. Rulează integral, o singură dată, fișierul `supabase-message-deletion-v1.4.sql` în Supabase.
2. Publică fișierele actualizate ale aplicației prin GitHub și Vercel.

## Actualizare de la v1.2.1

Versiunea v1.3 optimizează interfața pentru telefon: conversația folosește toată lățimea ecranului, lista de grupuri se deschide dintr-un meniu lateral, câmpurile nu mai declanșează mărirea automată pe iPhone, iar zona de scriere rămâne accesibilă în partea de jos.

Pentru actualizarea de la v1.2.1 se publică numai fișierele aplicației. Nu este necesar niciun script SQL nou.

## Actualizare de la v1.2

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
6. `supabase-security-v1.1.sql`
7. `supabase-security-v1.2.sql`
8. `supabase-message-deletion-v1.4.sql`
9. `supabase-push-notifications-v1.6.sql`
10. `supabase-eclintalk-v1.7.sql`

În Vercel trebuie configurate variabilele `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY` și `VAPID_PRIVATE_KEY`.

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
