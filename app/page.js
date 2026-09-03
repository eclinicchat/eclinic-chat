"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";

const time = (value) => new Date(value).toLocaleTimeString("ro-RO", { hour: "2-digit", minute: "2-digit" });
const INACTIVITY_MS = 15 * 60 * 1000;
const WARNING_MS = 60 * 1000;
const QUICK_EMOJIS = [
  "😀", "😃", "😄", "😁", "😂", "🤣", "😊", "😍", "🥰", "😘",
  "😎", "🤩", "🤔", "🙄", "😮", "😢", "😭", "😡", "🤗", "🤝",
  "👍", "👎", "👏", "🙌", "🙏", "💪", "❤️", "💙", "💚", "🔥",
  "🎉", "✅", "❌", "⚠️", "📌", "💡", "👀", "💯", "🚑", "🏥",
];
const REACTION_EMOJIS = ["👍", "❤️", "😂", "🤣", "😮", "😢", "👏", "🙏", "🔥", "✅", "👀", "💯"];

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
  const [unlockedRoomId, setUnlockedRoomId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [reactions, setReactions] = useState([]);
  const [draft, setDraft] = useState("");
  const [replyTo, setReplyTo] = useState(null);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [reactionTarget, setReactionTarget] = useState(null);
  const [pinnedOpen, setPinnedOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [attachment, setAttachment] = useState(null);
  const [imageUrls, setImageUrls] = useState({});
  const [error, setError] = useState("");
  const [modal, setModal] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [members, setMembers] = useState([]);
  const [settingsTitle, setSettingsTitle] = useState("");
  const [newMemberEmails, setNewMemberEmails] = useState("");
  const [settingsBusy, setSettingsBusy] = useState(false);
  const [settingsError, setSettingsError] = useState("");
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [roomPassword, setRoomPassword] = useState("");
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [groupPassword, setGroupPassword] = useState("");
  const [passwordProtected, setPasswordProtected] = useState(false);
  const [logoutWarning, setLogoutWarning] = useState(false);
  const [logoutCountdown, setLogoutCountdown] = useState(60);
  const bottom = useRef(null);
  const messageRefs = useRef({});
  const fileInput = useRef(null);
  const inactivityTimer = useRef(null);
  const warningTimer = useRef(null);
  const countdownTimer = useRef(null);
  const room = rooms.find((x) => x.id === roomId);
  const currentMembership = members.find((x) => x.user_id === session.user.id);
  const isOwner = room?.created_by === session.user.id;
  const isAdmin = Boolean(isOwner || currentMembership?.is_admin);
  const pinnedMessages = messages.filter((x) => x.pinned_at).sort((a, b) => new Date(b.pinned_at) - new Date(a.pinned_at));

  async function signOut() {
    clearTimeout(inactivityTimer.current);
    clearTimeout(warningTimer.current);
    clearInterval(countdownTimer.current);
    await supabase.auth.signOut();
  }

  useEffect(() => {
    function resetInactivity() {
      clearTimeout(inactivityTimer.current);
      clearTimeout(warningTimer.current);
      clearInterval(countdownTimer.current);
      setLogoutWarning(false);
      setLogoutCountdown(60);

      warningTimer.current = setTimeout(() => {
        setLogoutWarning(true);
        const deadline = Date.now() + WARNING_MS;
        countdownTimer.current = setInterval(() => {
          setLogoutCountdown(Math.max(0, Math.ceil((deadline - Date.now()) / 1000)));
        }, 1000);
      }, INACTIVITY_MS - WARNING_MS);

      inactivityTimer.current = setTimeout(signOut, INACTIVITY_MS);
    }

    const events = ["pointerdown", "keydown", "scroll", "touchstart"];
    events.forEach((event) => window.addEventListener(event, resetInactivity, { passive: true }));
    resetInactivity();
    return () => {
      events.forEach((event) => window.removeEventListener(event, resetInactivity));
      clearTimeout(inactivityTimer.current);
      clearTimeout(warningTimer.current);
      clearInterval(countdownTimer.current);
    };
  }, []);

  async function loadRooms(preferredId) {
    const { data, error: loadError } = await supabase.from("my_conversations").select("*").order("is_pinned", { ascending: false }).order("updated_at", { ascending: false });
    if (loadError) setError("Conversațiile nu au putut fi încărcate. Rulează scriptul SQL v0.5.");
    else {
      const list = data || [];
      setRooms(list);
      setRoomId((current) => preferredId && list.some((x) => x.id === preferredId) ? preferredId : list.some((x) => x.id === current) ? current : null);
    }
    setLoading(false);
  }

  useEffect(() => { loadRooms(); }, []);
  useEffect(() => {
    if (!roomId) { setMessages([]); setUnlockedRoomId(null); return; }
    if (unlockedRoomId === roomId) return;
    let active = true;
    setMessages([]); setPasswordError(""); setRoomPassword("");
    supabase.rpc("conversation_requires_password", { target_conversation_id: roomId })
      .then(({ data, error: passwordCheckError }) => {
        if (!active) return;
        if (passwordCheckError) setError(passwordCheckError.message);
        else if (data) setPasswordOpen(true);
        else setUnlockedRoomId(roomId);
      });
    return () => { active = false; };
  }, [roomId, unlockedRoomId]);
  useEffect(() => {
    if (!roomId || unlockedRoomId !== roomId) { setMessages([]); setReactions([]); return; }
    let active = true;
    setMessages([]);
    setReactions([]);
    setError("");
    Promise.all([
      supabase.from("private_messages").select("*").eq("conversation_id", roomId).order("created_at").limit(500),
      supabase.from("message_reactions").select("*").eq("conversation_id", roomId),
    ]).then(([messageResult, reactionResult]) => {
        if (!active) return;
        if (messageResult.error) setError("Mesajele nu au putut fi încărcate.");
        else setMessages(messageResult.data || []);
        if (!reactionResult.error) setReactions(reactionResult.data || []);
        supabase.rpc("mark_conversation_read", { target_conversation_id: roomId }).then(() => loadRooms(roomId));
      });
    const channel = supabase.channel(`private:${roomId}`).on("postgres_changes", {
      event: "INSERT", schema: "public", table: "private_messages", filter: `conversation_id=eq.${roomId}`,
    }, ({ new: item }) => {
      setMessages((current) => current.some((x) => x.id === item.id) ? current : [...current, item]);
      supabase.rpc("mark_conversation_read", { target_conversation_id: roomId }).then(() => loadRooms(roomId));
    }).on("postgres_changes", {
      event: "UPDATE", schema: "public", table: "private_messages", filter: `conversation_id=eq.${roomId}`,
    }, ({ new: item }) => setMessages((current) => current.map((x) => x.id === item.id ? item : x)))
      .on("postgres_changes", {
        event: "*", schema: "public", table: "message_reactions", filter: `conversation_id=eq.${roomId}`,
      }, () => supabase.from("message_reactions").select("*").eq("conversation_id", roomId).then(({ data }) => active && setReactions(data || [])))
      .subscribe();
    return () => { active = false; supabase.removeChannel(channel); };
  }, [roomId, unlockedRoomId]);
  useEffect(() => { bottom.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  useEffect(() => {
    let active = true;
    const paths = messages.map((item) => item.attachment_path).filter((path) => path && !imageUrls[path]);
    if (!paths.length) return;
    Promise.all(paths.map(async (path) => {
      const { data } = await supabase.storage.from("chat-images").createSignedUrl(path, 60 * 60);
      return [path, data?.signedUrl || ""];
    })).then((entries) => {
      if (active) setImageUrls((current) => ({ ...current, ...Object.fromEntries(entries) }));
    });
    return () => { active = false; };
  }, [messages, imageUrls]);

  function chooseFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const allowed = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];
    if (!allowed.includes(file.type)) { setError("Poți atașa numai imagini JPG, PNG, WEBP sau HEIC."); e.target.value = ""; return; }
    if (file.size > 10 * 1024 * 1024) { setError("Imaginea trebuie să aibă cel mult 10 MB."); e.target.value = ""; return; }
    setError("");
    setAttachment(file);
  }

  async function send(e) {
    e.preventDefault();
    const body = draft.trim();
    if ((!body && !attachment) || !roomId || sending) return;
    setSending(true); setError("");
    let attachmentData = {};
    let uploadedPath = null;
    if (attachment) {
      const extension = attachment.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
      uploadedPath = `${roomId}/${session.user.id}/${crypto.randomUUID()}.${extension}`;
      const { error: uploadError } = await supabase.storage.from("chat-images").upload(uploadedPath, attachment, { contentType: attachment.type, upsert: false });
      if (uploadError) { setError("Imaginea nu a putut fi încărcată."); setSending(false); return; }
      attachmentData = { attachment_path: uploadedPath, attachment_name: attachment.name, attachment_type: attachment.type, attachment_size: attachment.size };
    }
    const { data, error: sendError } = await supabase.from("private_messages").insert({
      conversation_id: roomId, user_id: session.user.id, sender_email: session.user.email, body: body || null,
      reply_to_id: replyTo?.id || null, ...attachmentData,
    }).select().single();
    if (sendError) {
      if (uploadedPath) await supabase.storage.from("chat-images").remove([uploadedPath]);
      setError("Mesajul nu a fost trimis.");
    }
    else {
      setDraft("");
      setReplyTo(null);
      setEmojiOpen(false);
      setAttachment(null);
      if (fileInput.current) fileInput.current.value = "";
      setMessages((current) => current.some((x) => x.id === data.id) ? current : [...current, data]);
      loadRooms(roomId);
    }
    setSending(false);
  }

  function insertEmoji(emoji) {
    setDraft((current) => `${current}${emoji}`);
  }

  function groupedReactions(messageId) {
    const groups = {};
    for (const reaction of reactions.filter((x) => x.message_id === messageId)) {
      if (!groups[reaction.emoji]) groups[reaction.emoji] = { count: 0, mine: false };
      groups[reaction.emoji].count += 1;
      if (reaction.user_id === session.user.id) groups[reaction.emoji].mine = true;
    }
    return groups;
  }

  async function reactToMessage(messageId, emoji) {
    setReactionTarget(null);
    const { error: reactionError } = await supabase.rpc("set_message_reaction", {
      target_message_id: messageId, reaction_emoji: emoji,
    });
    if (reactionError) setError(reactionError.message);
  }

  async function toggleMessagePin(messageId) {
    const { error: pinError } = await supabase.rpc("toggle_message_pin", { target_message_id: messageId });
    if (pinError) setError(pinError.message);
  }

  async function toggleGroupPin() {
    const { error: pinError } = await supabase.rpc("toggle_conversation_pin", { target_conversation_id: roomId });
    if (pinError) setError(pinError.message);
    else await loadRooms(roomId);
  }

  function scrollToMessage(messageId) {
    setPinnedOpen(false);
    messageRefs.current[messageId]?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  async function loadMembers() {
    if (!roomId) return;
    setSettingsError("");
    const { data, error: memberError } = await supabase.rpc("get_conversation_members", {
      target_conversation_id: roomId,
    });
    if (memberError) setSettingsError(memberError.message);
    else setMembers(data || []);
  }

  async function openSettings() {
    setSettingsOpen(true);
    setSettingsTitle(room?.title || "");
    setNewMemberEmails("");
    setGroupPassword("");
    setMembers([]);
    const [, passwordResult] = await Promise.all([
      loadMembers(),
      supabase.rpc("conversation_requires_password", { target_conversation_id: roomId }),
    ]);
    if (passwordResult.error) setSettingsError(passwordResult.error.message);
    else setPasswordProtected(Boolean(passwordResult.data));
  }

  async function unlockConversation(e) {
    e.preventDefault();
    if (!roomPassword || passwordBusy) return;
    setPasswordBusy(true); setPasswordError("");
    const { data, error: verifyError } = await supabase.rpc("verify_conversation_password", {
      target_conversation_id: roomId, supplied_password: roomPassword,
    });
    if (verifyError) setPasswordError(verifyError.message);
    else if (!data) setPasswordError("Parola grupului este greșită.");
    else {
      setUnlockedRoomId(roomId); setPasswordOpen(false); setRoomPassword("");
    }
    setPasswordBusy(false);
  }

  function cancelPassword() {
    if (passwordBusy) return;
    setPasswordOpen(false); setRoomPassword(""); setPasswordError(""); setRoomId(null);
  }

  async function renameConversation(e) {
    e.preventDefault();
    if (!settingsTitle.trim() || settingsBusy) return;
    setSettingsBusy(true); setSettingsError("");
    const { error: renameError } = await supabase.rpc("rename_private_conversation", {
      target_conversation_id: roomId, new_title: settingsTitle.trim(),
    });
    if (renameError) setSettingsError(renameError.message);
    else await loadRooms(roomId);
    setSettingsBusy(false);
  }

  async function addMembers(e) {
    e.preventDefault();
    const emails = newMemberEmails.split(/[,\n;]/).map((x) => x.trim().toLowerCase()).filter(Boolean);
    if (!emails.length || settingsBusy) return;
    setSettingsBusy(true); setSettingsError("");
    const { error: addError } = await supabase.rpc("add_conversation_members", {
      target_conversation_id: roomId, member_emails: emails,
    });
    if (addError) setSettingsError(addError.message);
    else {
      setNewMemberEmails("");
      await Promise.all([loadMembers(), loadRooms(roomId)]);
    }
    setSettingsBusy(false);
  }

  async function removeMember(member) {
    if (settingsBusy || !window.confirm(`Elimini ${member.email} din conversație?`)) return;
    setSettingsBusy(true); setSettingsError("");
    const { error: removeError } = await supabase.rpc("remove_conversation_member", {
      target_conversation_id: roomId, target_user_id: member.user_id,
    });
    if (removeError) setSettingsError(removeError.message);
    else await Promise.all([loadMembers(), loadRooms(roomId)]);
    setSettingsBusy(false);
  }

  async function toggleAdmin(member) {
    if (settingsBusy || !window.confirm(member.is_admin ? `Retragi rolul de administrator pentru ${member.email}?` : `Acordezi rolul de administrator lui ${member.email}?`)) return;
    setSettingsBusy(true); setSettingsError("");
    const { error: adminError } = await supabase.rpc("set_conversation_admin", {
      target_conversation_id: roomId, target_user_id: member.user_id, make_admin: !member.is_admin,
    });
    if (adminError) setSettingsError(adminError.message);
    else await loadMembers();
    setSettingsBusy(false);
  }

  async function saveGroupPassword(e) {
    e.preventDefault();
    if (settingsBusy || groupPassword.length < 6) return;
    setSettingsBusy(true); setSettingsError("");
    const { error: passwordSetError } = await supabase.rpc("set_conversation_password", {
      target_conversation_id: roomId, new_password: groupPassword,
    });
    if (passwordSetError) setSettingsError(passwordSetError.message);
    else { setGroupPassword(""); setPasswordProtected(true); }
    setSettingsBusy(false);
  }

  async function removeGroupPassword() {
    if (settingsBusy || !window.confirm("Elimini parola suplimentară a grupului?")) return;
    setSettingsBusy(true); setSettingsError("");
    const { error: passwordRemoveError } = await supabase.rpc("set_conversation_password", {
      target_conversation_id: roomId, new_password: "",
    });
    if (passwordRemoveError) setSettingsError(passwordRemoveError.message);
    else { setGroupPassword(""); setPasswordProtected(false); }
    setSettingsBusy(false);
  }

  async function leaveConversation() {
    if (settingsBusy || !window.confirm("Părăsești această conversație? Nu vei mai vedea mesajele sau imaginile.")) return;
    setSettingsBusy(true); setSettingsError("");
    const { error: leaveError } = await supabase.rpc("leave_private_conversation", {
      target_conversation_id: roomId,
    });
    if (leaveError) { setSettingsError(leaveError.message); setSettingsBusy(false); return; }
    setSettingsOpen(false); setRoomId(null); await loadRooms(); setSettingsBusy(false);
  }

  async function removeStoredImages(conversationId) {
    const { data: folders } = await supabase.storage.from("chat-images").list(conversationId, { limit: 1000 });
    if (!folders) return;
    const paths = [];
    for (const folder of folders) {
      const { data: files } = await supabase.storage.from("chat-images").list(`${conversationId}/${folder.name}`, { limit: 1000 });
      for (const file of files || []) paths.push(`${conversationId}/${folder.name}/${file.name}`);
    }
    if (paths.length) await supabase.storage.from("chat-images").remove(paths);
  }

  async function deleteConversation() {
    if (settingsBusy || !window.confirm("Ștergi definitiv conversația, mesajele și imaginile? Această acțiune nu poate fi anulată.")) return;
    setSettingsBusy(true); setSettingsError("");
    await removeStoredImages(roomId);
    const { error: deleteError } = await supabase.rpc("delete_private_conversation", {
      target_conversation_id: roomId,
    });
    if (deleteError) { setSettingsError(deleteError.message); setSettingsBusy(false); return; }
    setSettingsOpen(false); setRoomId(null); await loadRooms(); setSettingsBusy(false);
  }

  return <main className="app">
    <aside className="side">
      <div className="brandRow"><div><p className="eyebrow">eClinic</p><h2>Chat</h2></div><button className="logoutBtn" onClick={signOut} title="Ieșire din cont"><span className="logoutText">Ieșire</span><span className="logoutIcon" aria-hidden="true">↪</span></button></div>
      <button className="primary newBtn" onClick={() => setModal(true)}>+ Conversație nouă</button>
      <div className="conversationList">
        {loading && <p className="status">Se încarcă...</p>}
        {!loading && rooms.length === 0 && <p className="emptySide">Nu ai încă nicio conversație.</p>}
        {rooms.map((item) => <button className={`conv ${item.id === roomId ? "active" : ""}`} key={item.id} onClick={() => setRoomId(item.id)}>
          <span>{item.title.slice(0, 2).toUpperCase()}</span><div><strong>{item.is_pinned && "📌 "}{item.title}</strong><small>{item.member_count} membri · privat</small></div>
          {!item.password_protected && item.unread_count > 0 && <i className="unreadBadge">{item.unread_count > 99 ? "99+" : item.unread_count}</i>}
        </button>)}
      </div>
      <div className="user"><strong>{session.user.email}</strong><small>Conectat</small></div>
    </aside>
    <section className="chat">
      {room ? <><header><div><strong>{room.title}</strong><small>{room.member_count} membri · numai membrii au acces</small></div><div className="headerActions"><b>● Privat</b><button onClick={toggleGroupPin}>{room.is_pinned ? "📌 Fixat" : "Fixează sus"}</button><button onClick={openSettings}>Gestionează</button></div></header>
        <div className="warning">Versiune de test. Nu introduce date medicale sau personale reale.</div>
        <div className="msgs">
          {pinnedMessages.length > 0 && <div className="pinnedArea">
            <button className="pinnedBanner" onClick={() => pinnedMessages.length === 1 ? scrollToMessage(pinnedMessages[0].id) : setPinnedOpen(!pinnedOpen)}>
              <span className="largePin">📌</span><span>{pinnedMessages.length} {pinnedMessages.length === 1 ? "mesaj fixat" : "mesaje fixate"}</span><span className="pinChevron">{pinnedMessages.length > 1 ? (pinnedOpen ? "▲" : "▼") : "›"}</span>
            </button>
            {pinnedOpen && pinnedMessages.length > 1 && <div className="pinnedList">
              {pinnedMessages.map((item, index) => <button key={item.id} onClick={() => scrollToMessage(item.id)}>
                <span>📌</span><div><strong>Mesaj fixat {index + 1}</strong><small>{item.body || (item.attachment_path ? "📷 Imagine" : item.attachment_name || "Mesaj")}</small></div>
              </button>)}
            </div>}
          </div>}
          {messages.length === 0 && !error && <p className="status">Trimite primul mesaj.</p>}
          {messages.map((item) => { const mine = item.user_id === session.user.id; const replied = messages.find((x) => x.id === item.reply_to_id); const itemReactions = groupedReactions(item.id); return <div ref={(node) => { messageRefs.current[item.id] = node; }} key={item.id} className={`messageWrap ${mine ? "mine" : ""}`}>
            <div className={`bubble ${mine ? "mine" : ""} ${item.attachment_path ? "hasImage" : ""} ${item.pinned_at ? "pinnedMessage" : ""}`}>
              {!mine && <strong className="sender">{item.sender_email || "Utilizator"}</strong>}
              {item.pinned_at && <span className="pinMark">📌</span>}
              {item.reply_to_id && <button className="replyQuote" onClick={() => scrollToMessage(item.reply_to_id)}>
                <strong>{replied?.sender_email || "Mesaj anterior"}</strong><span>{replied?.body || (replied?.attachment_path ? "📷 Imagine" : "Mesaj indisponibil")}</span>
                {replied?.attachment_path && imageUrls[replied.attachment_path] && <img src={imageUrls[replied.attachment_path]} alt="Imagine citată" />}
              </button>}
              {item.attachment_path && imageUrls[item.attachment_path] && <a href={imageUrls[item.attachment_path]} target="_blank" rel="noreferrer"><img className="chatImage" src={imageUrls[item.attachment_path]} alt={item.attachment_name || "Imagine atașată"} /></a>}
              {item.attachment_path && !imageUrls[item.attachment_path] && <p className="imageLoading">Se încarcă imaginea...</p>}
              {item.body && <p>{item.body}</p>}<small>{time(item.created_at)}</small>
            </div>
            <div className="messageActions"><button onClick={() => setReplyTo(item)}><span>↩</span> Răspunde</button><button onClick={() => setReactionTarget(reactionTarget === item.id ? null : item.id)}><span>☺</span> Reacție</button>
              {room.my_is_admin && <button onClick={() => toggleMessagePin(item.id)}><span>📌</span> {item.pinned_at ? "Anulează pin" : "Pin"}</button>}</div>
            {reactionTarget === item.id && <div className="reactionPicker">{REACTION_EMOJIS.map((emoji) => <button key={emoji} onClick={() => reactToMessage(item.id, emoji)}>{emoji}</button>)}</div>}
            {Object.keys(itemReactions).length > 0 && <div className="reactionSummary">{Object.entries(itemReactions).map(([emoji, info]) => <button className={info.mine ? "mine" : ""} key={emoji} onClick={() => reactToMessage(item.id, emoji)}>{emoji} {info.count}</button>)}</div>}
          </div>; })}<div ref={bottom} />
        </div>
        <div>{error && <p className="chatError">{error}</p>}<form className="composer" onSubmit={send}>
          {replyTo && <div className="selectedReply"><div><strong>Răspuns către {replyTo.sender_email || "mesaj"}</strong><span>{replyTo.body || (replyTo.attachment_path ? "📷 Imagine" : "Mesaj")}</span></div>{replyTo.attachment_path && imageUrls[replyTo.attachment_path] && <img src={imageUrls[replyTo.attachment_path]} alt="Imagine selectată pentru răspuns" />}<button type="button" onClick={() => setReplyTo(null)}>×</button></div>}
          <input ref={fileInput} className="fileInput" type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" onChange={chooseFile} />
          <button className="attachBtn" type="button" onClick={() => fileInput.current?.click()} disabled={sending} title="Atașează imagine" aria-label="Atașează imagine">📎</button>
          <button className="emojiBtn" type="button" onClick={() => setEmojiOpen(!emojiOpen)} disabled={sending} title="Emoticoane" aria-label="Emoticoane">☺</button>
          <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Scrie un mesaj..." maxLength={4000} disabled={sending} />
          <button className="primary" disabled={sending || (!draft.trim() && !attachment)}>{sending ? "Se trimite..." : "Trimite"}</button>
          {emojiOpen && <div className="emojiPicker">{QUICK_EMOJIS.map((emoji) => <button type="button" key={emoji} onClick={() => insertEmoji(emoji)}>{emoji}</button>)}</div>}
          {attachment && <div className="selectedFile"><span>{attachment.name}</span><button type="button" onClick={() => { setAttachment(null); if (fileInput.current) fileInput.current.value = ""; }}>×</button></div>}
        </form></div></> :
        <div className="welcome"><div className="logo">eC</div><h2>Conversații private</h2><p>{rooms.length ? "Selectează o conversație din listă pentru a o deschide." : "Creează o conversație și adaugă colegii care au deja cont."}</p>
          {!rooms.length && <button className="primary" onClick={() => setModal(true)}>Creează prima conversație</button>}{error && <p className="chatError">{error}</p>}</div>}
    </section>
    {modal && <NewConversation close={() => setModal(false)} created={(id) => { setModal(false); loadRooms(id); }} />}
    {settingsOpen && room && <div className="modalBackdrop" onMouseDown={() => !settingsBusy && setSettingsOpen(false)}><section className="modal manageModal" onMouseDown={(e) => e.stopPropagation()}>
      <div className="modalTitle"><div><p className="eyebrow">Conversație privată</p><h2>Administrare</h2></div><button className="iconBtn" disabled={settingsBusy} onClick={() => setSettingsOpen(false)}>×</button></div>
      {isAdmin && <form className="manageSection" onSubmit={renameConversation}>
        <label>Numele conversației<div className="inlineForm"><input required maxLength={80} value={settingsTitle} onChange={(e) => setSettingsTitle(e.target.value)} /><button className="primary" disabled={settingsBusy || !settingsTitle.trim()}>Salvează</button></div></label>
      </form>}
      <div className="manageSection"><div className="sectionHeading"><strong>Membri</strong><small>{members.length}</small></div>
        <div className="memberList">{members.map((member) => <div className="memberRow" key={member.user_id}><div><strong>{member.email}</strong><small>{member.is_owner ? "Proprietar · Administrator" : member.is_admin ? "Administrator" : "Membru"}</small></div>
          <div className="memberActions">{isOwner && !member.is_owner && <button disabled={settingsBusy} onClick={() => toggleAdmin(member)}>{member.is_admin ? "Retrage admin" : "Fă admin"}</button>}
          {isAdmin && !member.is_owner && (isOwner || !member.is_admin) && <button disabled={settingsBusy} onClick={() => removeMember(member)}>Elimină</button>}</div></div>)}</div>
      </div>
      {isAdmin && <form className="manageSection" onSubmit={addMembers}>
        <label>Adaugă membri<textarea rows={2} placeholder="coleg@exemplu.ro" value={newMemberEmails} onChange={(e) => setNewMemberEmails(e.target.value)} /></label>
        <p className="helper">Persoanele trebuie să aibă deja cont. Poți separa adresele prin virgulă.</p>
        <button className="primary" disabled={settingsBusy || !newMemberEmails.trim()}>Adaugă</button>
      </form>}
      {isOwner && <form className="manageSection" onSubmit={saveGroupPassword}>
        <div className="sectionHeading"><strong>Parolă suplimentară</strong><small>{passwordProtected ? "Activă" : "Inactivă"}</small></div>
        <label>{passwordProtected ? "Schimbă parola grupului" : "Protejează grupul cu parolă"}<input type="password" minLength={6} maxLength={64} placeholder="Minimum 6 caractere" value={groupPassword} onChange={(e) => setGroupPassword(e.target.value)} /></label>
        <p className="helper">Va fi cerută membrilor la fiecare deschidere a grupului. Parola nu este afișată și nu este stocată în clar.</p>
        <div className="passwordActions"><button className="primary" disabled={settingsBusy || groupPassword.length < 6}>{passwordProtected ? "Schimbă parola" : "Activează parola"}</button>
          {passwordProtected && <button type="button" disabled={settingsBusy} onClick={removeGroupPassword}>Elimină parola</button>}</div>
      </form>}
      {settingsError && <p className="error manageError">{settingsError}</p>}
      <div className="dangerZone">{isOwner ? <button className="dangerBtn" disabled={settingsBusy} onClick={deleteConversation}>Șterge conversația</button> : <button className="dangerBtn" disabled={settingsBusy} onClick={leaveConversation}>Părăsește conversația</button>}</div>
    </section></div>}
    {passwordOpen && room && <div className="modalBackdrop"><section className="modal passwordModal">
      <div className="lockMark">🔒</div><p className="eyebrow">Grup protejat</p><h2>{room.title}</h2>
      <p className="muted">Introdu parola suplimentară pentru a deschide conversația.</p>
      <form className="form" onSubmit={unlockConversation}><label>Parola grupului<input autoFocus type="password" value={roomPassword} onChange={(e) => setRoomPassword(e.target.value)} /></label>
        {passwordError && <p className="error">{passwordError}</p>}
        <div className="modalActions"><button type="button" disabled={passwordBusy} onClick={cancelPassword}>Renunță</button><button className="primary" disabled={passwordBusy || !roomPassword}>{passwordBusy ? "Se verifică..." : "Deschide grupul"}</button></div>
      </form>
    </section></div>}
    {logoutWarning && <div className="modalBackdrop"><section className="modal timeoutModal">
      <p className="eyebrow">Sesiune inactivă</p><h2>Vei fi delogat în {logoutCountdown} secunde</h2>
      <p className="muted">Pentru protejarea contului, sesiunea se închide automat după 15 minute fără activitate.</p>
      <div className="modalActions"><button onClick={signOut}>Ieșire acum</button><button className="primary" onClick={() => window.dispatchEvent(new Event("pointerdown"))}>Rămân conectat</button></div>
    </section></div>}
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
