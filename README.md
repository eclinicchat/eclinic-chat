# eClinic Chat v0.8

MVP cu autentificare Supabase, conversații private și trimitere de imagini de maximum 10 MB, vizibile numai membrilor. Include delogare manuală și automată după 15 minute de inactivitate, administratori multipli și parolă suplimentară opțională pentru fiecare grup.

1. Pentru actualizarea de la v0.7, rulează numai `supabase-conversation-management.sql` în Supabase SQL Editor.
2. Pentru o instalare nouă, rulează în ordine `supabase-private-chat.sql`, `supabase-chat-images.sql` și `supabase-conversation-management.sql`.
3. În Vercel păstrează `NEXT_PUBLIC_SUPABASE_URL` și `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
4. Publică această versiune prin GitHub/Vercel.

Creatorul este proprietarul conversației și poate acorda sau retrage rolul de administrator. Administratorii pot redenumi grupul și gestiona membrii; numai proprietarul poate modifica administratorii, parola grupului și poate șterge conversația. Ceilalți membri pot părăsi conversația.

Parola suplimentară este cerută la fiecare redeschidere a grupului, este stocată numai ca hash și se blochează timp de 5 minute după 5 încercări greșite. Aceasta este o protecție suplimentară a interfeței, nu criptare end-to-end.

Un utilizator trebuie să aibă deja cont înainte să fie adăugat după email.

Versiune de test: nu folosi date medicale reale. Criptarea end-to-end și cerințele complete pentru o aplicație medicală nu sunt implementate.
