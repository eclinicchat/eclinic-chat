"use client";

import { useMemo, useRef, useState } from "react";

const conversations = [
  {
    id: 1,
    name: "Garda CT",
    initials: "CT",
    preview: "Am încărcat imaginile.",
    time: "10:42",
    unread: 2,
  },
  {
    id: 2,
    name: "Echipa RM",
    initials: "RM",
    preview: "Cazul este gata pentru revizuire.",
    time: "09:18",
    unread: 0,
  },
  {
    id: 3,
    name: "Intervențional",
    initials: "IR",
    preview: "Confirmăm ora 14:30.",
    time: "Ieri",
    unread: 0,
  },
];

const initialMessages = [
  {
    id: 1,
    sender: "other",
    text: "Bună dimineața. Ai disponibilitate pentru o a doua opinie?",
    time: "10:36",
  },
  {
    id: 2,
    sender: "me",
    text: "Da. Trimite-mi, te rog, imaginile anonimizate.",
    time: "10:38",
  },
  {
    id: 3,
    sender: "other",
    text: "Am încărcat imaginile. Pacientul are durere toracică acută.",
    time: "10:42",
  },
];

export default function Home() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [securityKey, setSecurityKey] = useState("");
  const [loginError, setLoginError] = useState("");
  const [selectedConversation, setSelectedConversation] = useState(1);
  const [messages, setMessages] = useState(initialMessages);
  const [draft, setDraft] = useState("");
  const [attachment, setAttachment] = useState(null);
  const fileInputRef = useRef(null);

  const currentConversation = useMemo(
    () => conversations.find((item) => item.id === selectedConversation),
    [selectedConversation]
  );

  function handleLogin(event) {
    event.preventDefault();

    if (!username.trim() || !password.trim() || !securityKey.trim()) {
      setLoginError("Completează utilizatorul, parola și cheia de securitate.");
      return;
    }

    setLoginError("");
    setLoggedIn(true);
  }

  function sendMessage(event) {
    event.preventDefault();

    if (!draft.trim() && !attachment) return;

    setMessages((current) => [
      ...current,
      {
        id: Date.now(),
        sender: "me",
        text: draft.trim(),
        time: new Date().toLocaleTimeString("ro-RO", {
          hour: "2-digit",
          minute: "2-digit",
        }),
        attachment,
      },
    ]);

    setDraft("");
    setAttachment(null);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function chooseAttachment(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    setAttachment({
      name: file.name,
      size: `${Math.max(1, Math.round(file.size / 1024))} KB`,
      type: file.type || "Fișier",
    });
  }

  if (!loggedIn) {
    return (
      <main className="login-shell">
        <section className="login-card">
          <div className="brand-mark" aria-hidden="true">eC</div>
          <p className="eyebrow">eClinic Chat</p>
          <h1>Conectare securizată</h1>
          <p className="muted">
            Prototip demonstrativ. Nu introduce date medicale sau parole reale.
          </p>

          <form onSubmit={handleLogin} className="login-form">
            <label>
              Utilizator
              <input
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                autoComplete="username"
                placeholder="ex. cosmin.adrian"
              />
            </label>

            <label>
              Parolă
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                placeholder="••••••••••"
              />
            </label>

            <label>
              Cheie de securitate
              <input
                type="password"
                inputMode="numeric"
                value={securityKey}
                onChange={(event) => setSecurityKey(event.target.value)}
                placeholder="6 cifre"
              />
            </label>

            {loginError ? <p className="error-message">{loginError}</p> : null}

            <button className="primary-button" type="submit">
              Intră în aplicație
            </button>
          </form>

          <p className="prototype-note">
            În această versiune, autentificarea este doar locală, pentru testarea interfeței.
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <header className="sidebar-header">
          <div>
            <p className="eyebrow">eClinic</p>
            <h1>Chat</h1>
          </div>
          <button
            type="button"
            className="icon-button"
            aria-label="Deconectare"
            onClick={() => setLoggedIn(false)}
          >
            ↗
          </button>
        </header>

        <label className="search-box">
          <span aria-hidden="true">⌕</span>
          <input placeholder="Caută conversații" />
        </label>

        <div className="conversation-list">
          {conversations.map((conversation) => (
            <button
              type="button"
              key={conversation.id}
              className={`conversation ${
                selectedConversation === conversation.id ? "active" : ""
              }`}
              onClick={() => setSelectedConversation(conversation.id)}
            >
              <span className="avatar">{conversation.initials}</span>
              <span className="conversation-copy">
                <span className="conversation-topline">
                  <strong>{conversation.name}</strong>
                  <small>{conversation.time}</small>
                </span>
                <span className="conversation-bottomline">
                  <span>{conversation.preview}</span>
                  {conversation.unread ? (
                    <span className="unread-badge">{conversation.unread}</span>
                  ) : null}
                </span>
              </span>
            </button>
          ))}
        </div>

        <div className="user-card">
          <span className="avatar user-avatar">CA</span>
          <span>
            <strong>{username || "Utilizator demo"}</strong>
            <small>Conectat</small>
          </span>
        </div>
      </aside>

      <section className="chat-panel">
        <header className="chat-header">
          <div className="chat-identity">
            <span className="avatar">{currentConversation?.initials}</span>
            <span>
              <strong>{currentConversation?.name}</strong>
              <small>3 participanți · online</small>
            </span>
          </div>
          <span className="security-pill">🔒 Prototip local</span>
        </header>

        <div className="prototype-banner">
          Nu folosi date reale. Criptarea și autentificarea server-side vor fi adăugate în etapa următoare.
        </div>

        <div className="messages" aria-live="polite">
          <div className="day-divider">Astăzi</div>
          {messages.map((message) => (
            <article
              key={message.id}
              className={`message ${message.sender === "me" ? "mine" : ""}`}
            >
              {message.text ? <p>{message.text}</p> : null}
              {message.attachment ? (
                <div className="attachment-card">
                  <span aria-hidden="true">▧</span>
                  <span>
                    <strong>{message.attachment.name}</strong>
                    <small>{message.attachment.size}</small>
                  </span>
                </div>
              ) : null}
              <time>{message.time}</time>
            </article>
          ))}
        </div>

        {attachment ? (
          <div className="attachment-preview">
            <span>
              <strong>{attachment.name}</strong>
              <small>{attachment.size}</small>
            </span>
            <button type="button" onClick={() => setAttachment(null)}>
              Elimină
            </button>
          </div>
        ) : null}

        <form className="composer" onSubmit={sendMessage}>
          <input
            ref={fileInputRef}
            type="file"
            className="visually-hidden"
            onChange={chooseAttachment}
            accept=".png,.jpg,.jpeg,.pdf,.dcm,application/dicom"
          />
          <button
            type="button"
            className="attach-button"
            onClick={() => fileInputRef.current?.click()}
            aria-label="Atașează fișier"
          >
            ＋
          </button>
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Scrie un mesaj..."
          />
          <button className="send-button" type="submit">
            Trimite
          </button>
        </form>
      </section>
    </main>
  );
}
