# eClinic Chat v0.9.1

MVP cu autentificare Supabase, conversații private și trimitere de imagini de maximum 10 MB, vizibile numai membrilor. Include administratori multipli, parolă suplimentară opțională, reply la text și imagini, emoticoane, reacții, pin și contoare de necitite.

Actualizarea v0.9.1 mărește comenzile pentru răspuns, reacții și pin, extinde selecția de emoticoane și permite alegerea oricărui mesaj din lista mesajelor fixate. Nu necesită un script SQL nou dacă v0.9 este deja instalată.

1. Pentru actualizarea de la v0.8.1, rulează numai `supabase-messaging-v0.9.sql` în Supabase SQL Editor.
2. Pentru o instalare nouă, rulează în ordine `supabase-private-chat.sql`, `supabase-chat-images.sql`, `supabase-conversation-management.sql` și `supabase-messaging-v0.9.sql`.
3. În Vercel păstrează `NEXT_PUBLIC_SUPABASE_URL` și `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
4. Publică această versiune prin GitHub/Vercel.

Creatorul este proprietarul conversației și poate acorda sau retrage rolul de administrator. Administratorii pot redenumi grupul și gestiona membrii; numai proprietarul poate modifica administratorii, parola grupului și poate șterge conversația. Ceilalți membri pot părăsi conversația.

Parola suplimentară este cerută la fiecare redeschidere a grupului, este stocată numai ca hash și se blochează timp de 5 minute după 5 încercări greșite. Aceasta este o protecție suplimentară a interfeței, nu criptare end-to-end.

La conectarea în aplicație nu se deschide automat niciun grup. Parola suplimentară este solicitată numai după ce utilizatorul apasă pe conversația protejată.

Grupurile pot fi fixate individual în partea de sus. Administratorii pot fixa mesaje importante. Contoarele de mesaje necitite nu sunt afișate pentru grupurile protejate cu parolă.

Un utilizator trebuie să aibă deja cont înainte să fie adăugat după email.

Versiune de test: nu folosi date medicale reale. Criptarea end-to-end și cerințele complete pentru o aplicație medicală nu sunt implementate.
