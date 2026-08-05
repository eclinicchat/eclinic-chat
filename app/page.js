"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";

const time = (value) => new Date(value).toLocaleTimeString("ro-RO", { hour: "2-digit", minute: "2-digit" });

function Login() {
  const [signup, setSignup] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setNotice(null);
    const result = signup
      ? await supabase.auth.signUp({ email, password })
      : await supabase.auth.signInWithPassword({ email, password });
    if (result.error) setNotice({ error: true, text: result.error.message });
    else if (signup && !result.data.session) {
      setNotice({ text: "Cont creat. Verifică emailul, apoi conectează-te." });
      setSignup(false);
    }
    setBusy(false);
  }

  return <main className="loginShell"><section className="loginCard">
    <div className="logo">eC</div><p className="eyebrow">eClinic Chat</p>
    <h1>{signup ? "Creează cont" : "Conectare securizată"}</h1>
    <p className="muted">Conversațiile sunt vizibile numai membrilor adăugați.</p>
    <form onSubmit={submit} className="form">
      <label>Email<input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></label>
      <label>Parolă<input type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} /></label>
      {notice && <p className={notice.error ? "error" : "success"}>{notice.text}</p>}
      <button disabled={busy} className="primary">{busy ? "Se procesează..." : signup ? "Creează cont" : "Intră în aplicație"}</button>
    </form>
    <button className="linkBtn" onClick={() => { setSignup(!signup); setNotice(null); }}>
      {signup ? "Ai deja cont? Conectează-te" : "Nu ai cont? Creează unul"}
    </button>
    <p className="note">Versiune de test. Nu introduce date medicale reale.</p>
  </section></main>;
}

function NewConversation({ close, created }) {
  const [title, setTitle] = useState("");
  const [emails, setEmails] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const memberEmails = emails.split(/[,\n;]/).map((x) => x.trim().toLowerCase()).filter(Boolean);
    const { data, error: rpcError } = await supabase.rpc("create_private_conversation", {
      conversation_title: title.trim(), member_emails: memberEmails,
    });
    if (rpcError) setError(rpcError.message);
    else created(data);
    setBusy(false);
  }

  return <div className="modalBackdrop" onMouseDown={close}><section className="modal" onMouseDown={(e) => e.stopPropagation()}>
    <div className="modalTitle"><div><p className="eyebrow">Conversație privată</p><h2>Conversație nouă</h2></div>
      <button className="iconBtn" onClick={close}>×</button></div>
    <form className="form" onSubmit={submit}>
      <label>Numele conversației<input required maxLength={80} value={title} onChange={(e) => setTitle(e.target.value)} /></label>
      <label>Emailurile membrilor<textarea rows={4} placeholder="medic1@exemplu.ro, medic2@exemplu.ro" value={emails} onChange={(e) => setEmails(e.target.value)} /></label>
      <p className="helper">Persoanele trebuie să aibă deja cont. Separă emailurile prin virgulă.</p>
      {error && <p className="error">{error}</p>}
      <div className="modalActions"><button type="button" onClick={close}>Renunță</button>
        <button className="primary" disabled={busy || !title.trim()}>{busy ? "Se creează..." : "Creează"}</button></div>
    </form>
  </section></div>;
}

function Chat({ session }) {
  const [rooms, setRooms] = useState([]);
  const [roomId, setRoomId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [modal, setModal] = useState(false);
  const bottom = useRef(null);
  const room = rooms.find((x) => x.id === roomId);

  async function loadRooms(preferredId) {
    const { data, error: loadError } = await supabase.from("my_conversations").select("*").order("updated_at", { ascending: false });
    if (loadError) setError("Conversațiile nu au putut fi încărcate. Rulează scriptul SQL v0.5.");
    else {
      const list = data || [];
      setRooms(list);
      setRoomId((current) => preferredId && list.some((x) => x.id === preferredId) ? preferredId : list.some((x) => x.id === current) ? current : list[0]?.id || null);
    }
    setLoading(false);
  }

  useEffect(() => { loadRooms(); }, []);
  useEffect(() => {
    if (!roomId) { setMessages([]); return; }
    let active = true;
    setMessages([]);
    setError("");
    supabase.from("private_messages").select("*").eq("conversation_id", roomId).order("created_at").limit(500)
      .then(({ data, error: loadError }) => {
        if (!active) return;
        if (loadError) setError("Mesajele nu au putut fi încărcate.");
        else setMessages(data || []);
      });
    const channel = supabase.channel(`private:${roomId}`).on("postgres_changes", {
      event: "INSERT", schema: "public", table: "private_messages", filter: `conversation_id=eq.${roomId}`,
    }, ({ new: item }) => setMessages((current) => current.some((x) => x.id === item.id) ? current : [...current, item])).subscribe();
    return () => { active = false; supabase.removeChannel(channel); };
  }, [roomId]);
  useEffect(() => { bottom.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  async function send(e) {
    e.preventDefault();
    const body = draft.trim();
    if (!body || !roomId || sending) return;
    setSending(true); setError("");
    const { data, error: sendError } = await supabase.from("private_messages").insert({
      conversation_id: roomId, user_id: session.user.id, sender_email: session.user.email, body,
    }).select().single();
    if (sendError) setError("Mesajul nu a fost trimis.");
    else {
      setDraft("");
      setMessages((current) => current.some((x) => x.id === data.id) ? current : [...current, data]);
      loadRooms(roomId);
    }
    setSending(false);
  }

  return <main className="app">
    <aside className="side">
      <div className="brandRow"><div><p className="eyebrow">eClinic</p><h2>Chat</h2></div><button onClick={() => supabase.auth.signOut()}>Ieșire</button></div>
      <button className="primary newBtn" onClick={() => setModal(true)}>+ Conversație nouă</button>
      <div className="conversationList">
        {loading && <p className="status">Se încarcă...</p>}
        {!loading && rooms.length === 0 && <p className="emptySide">Nu ai încă nicio conversație.</p>}
        {rooms.map((item) => <button className={`conv ${item.id === roomId ? "active" : ""}`} key={item.id} onClick={() => setRoomId(item.id)}>
          <span>{item.title.slice(0, 2).toUpperCase()}</span><div><strong>{item.title}</strong><small>{item.member_count} membri · privat</small></div>
        </button>)}
      </div>
      <div className="user"><strong>{session.user.email}</strong><small>Conectat</small></div>
    </aside>
    <section className="chat">
      {room ? <><header><div><strong>{room.title}</strong><small>{room.member_count} membri · numai membrii au acces</small></div><b>● Privat</b></header>
        <div className="warning">Versiune de test. Nu introduce date medicale sau personale reale.</div>
        <div className="msgs">
          {messages.length === 0 && !error && <p className="status">Trimite primul mesaj.</p>}
          {messages.map((item) => { const mine = item.user_id === session.user.id; return <div key={item.id} className={`bubble ${mine ? "mine" : ""}`}>
            {!mine && <strong className="sender">{item.sender_email || "Utilizator"}</strong>}<p>{item.body}</p><small>{time(item.created_at)}</small>
          </div>; })}<div ref={bottom} />
        </div>
        <div>{error && <p className="chatError">{error}</p>}<form className="composer" onSubmit={send}>
          <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Scrie un mesaj..." maxLength={4000} disabled={sending} />
          <button className="primary" disabled={sending || !draft.trim()}>{sending ? "Se trimite..." : "Trimite"}</button>
        </form></div></> :
        <div className="welcome"><div className="logo">eC</div><h2>Conversații private</h2><p>Creează o conversație și adaugă colegii care au deja cont.</p>
          <button className="primary" onClick={() => setModal(true)}>Creează prima conversație</button>{error && <p className="chatError">{error}</p>}</div>}
    </section>
    {modal && <NewConversation close={() => setModal(false)} created={(id) => { setModal(false); loadRooms(id); }} />}
  </main>;
}

export default function Home() {
  const [session, setSession] = useState(null);
  const [checking, setChecking] = useState(true);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setChecking(false); });
    const { data } = supabase.auth.onAuthStateChange((_event, next) => { setSession(next); setChecking(false); });
    return () => data.subscription.unsubscribe();
  }, []);
  if (checking) return <main className="center">Se verifică sesiunea...</main>;
  return session ? <Chat session={session} /> : <Login />;
}
