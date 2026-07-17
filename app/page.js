"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

const demoMessages = [
  { id: 1, mine: false, text: "Bună dimineața. Ai disponibilitate pentru o a doua opinie?", time: "10:36" },
  { id: 2, mine: true, text: "Da. Trimite-mi, te rog, imaginile anonimizate.", time: "10:38" },
];

function Login() {
  const [mode, setMode] = useState("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setInfo("");

    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        if (!data.session) {
          setInfo("Cont creat. Verifică emailul, apoi conectează-te.");
          setMode("signin");
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err) {
      setError(err?.message || "Autentificarea nu a reușit.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="loginShell">
      <section className="loginCard">
        <div className="logo">eC</div>
        <p className="eyebrow">eClinic Chat</p>
        <h1>{mode === "signin" ? "Conectare securizată" : "Creează cont"}</h1>
        <p className="muted">Autentificare reală prin Supabase. Folosește doar date de test.</p>

        <form onSubmit={submit} className="form">
          <label>Email<input type="email" required value={email} onChange={e=>setEmail(e.target.value)} /></label>
          <label>Parolă<input type="password" required minLength={8} value={password} onChange={e=>setPassword(e.target.value)} /></label>
          {error && <p className="error">{error}</p>}
          {info && <p className="success">{info}</p>}
          <button disabled={busy} className="primary">
            {busy ? "Se procesează..." : mode === "signin" ? "Intră în aplicație" : "Creează cont"}
          </button>
        </form>

        <button className="linkBtn" onClick={()=>{setMode(mode==="signin"?"signup":"signin");setError("");setInfo("");}}>
          {mode === "signin" ? "Nu ai cont? Creează unul" : "Ai deja cont? Conectează-te"}
        </button>

        <p className="note">Mesajele sunt încă demonstrative. Nu introduce date medicale reale.</p>
      </section>
    </main>
  );
}

function Chat({ session }) {
  const [messages, setMessages] = useState(demoMessages);
  const [draft, setDraft] = useState("");

  async function logout() {
    await supabase.auth.signOut();
  }

  function send(e) {
    e.preventDefault();
    if (!draft.trim()) return;
    setMessages([...messages, {
      id: Date.now(),
      mine: true,
      text: draft.trim(),
      time: new Date().toLocaleTimeString("ro-RO",{hour:"2-digit",minute:"2-digit"})
    }]);
    setDraft("");
  }

  return (
    <main className="app">
      <aside className="side">
        <div className="brandRow"><div><p className="eyebrow">eClinic</p><h2>Chat</h2></div><button onClick={logout}>Ieșire</button></div>
        <input className="search" placeholder="Caută conversații" />
        {["Garda CT","Echipa RM","Intervențional"].map((n,i)=><div className={"conv "+(i===0?"active":"")} key={n}><span>{["CT","RM","IR"][i]}</span><div><strong>{n}</strong><small>{i===0?"Am încărcat imaginile.":"Caz de test"}</small></div></div>)}
        <div className="user"><strong>{session.user.email}</strong><small>Conectat prin Supabase</small></div>
      </aside>

      <section className="chat">
        <header><div><strong>Garda CT</strong><small>3 participanți · online</small></div><b>🔐 Sesiune autenticată</b></header>
        <div className="warning">Autentificarea este reală. Mesajele sunt încă locale.</div>
        <div className="msgs">
          {messages.map(m=><div key={m.id} className={"bubble "+(m.mine?"mine":"")}><p>{m.text}</p><small>{m.time}</small></div>)}
        </div>
        <form className="composer" onSubmit={send}>
          <input value={draft} onChange={e=>setDraft(e.target.value)} placeholder="Scrie un mesaj..." />
          <button className="primary">Trimite</button>
        </form>
      </section>
    </main>
  );
}

export default function Home() {
  const [session, setSession] = useState(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setChecking(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setChecking(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (checking) return <main className="center">Se verifică sesiunea...</main>;
  return session ? <Chat session={session} /> : <Login />;
}
