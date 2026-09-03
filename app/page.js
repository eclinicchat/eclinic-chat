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
  const [forgotPassword, setForgotPassword] = useState(false);
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

  async function sendResetLink(e) {
    e.preventDefault();
    if (!email || busy) return;
    setBusy(true);
    setNotice(null);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: window.location.origin,
    });
    if (error) setNotice({ error: true, text: error.message });
    else setNotice({ text: "Dacă adresa are un cont, vei primi un email pentru alegerea unei parole noi." });
    setBusy(false);
  }

  return <main className="loginShell"><section className="loginCard">
    <div className="logo">eC</div><p className="eyebrow">eClinic Chat</p>
    <h1>{forgotPassword ? "Recuperează parola" : signup ? "Creează cont" : "Conectare securizată"}</h1>
    <p className="muted">Conversațiile sunt vizibile numai membrilor adăugați.</p>
    {forgotPassword ? <form onSubmit={sendResetLink} className="form">
      <label>Email<input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></label>
      {notice && <p className={notice.error ? "error" : "success"}>{notice.text}</p>}
      <button disabled={busy} className="primary">{busy ? "Se trimite..." : "Trimite linkul de recuperare"}</button>
    </form> : <form onSubmit={submit} className="form">
      <label>Email<input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></label>
      <label>Parolă<input type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} /></label>
      {notice && <p className={notice.error ? "error" : "success"}>{notice.text}</p>}
      <button disabled={busy} className="primary">{busy ? "Se procesează..." : signup ? "Creează cont" : "Intră în aplicație"}</button>
    </form>}
    {!forgotPassword && !signup && <button className="linkBtn" onClick={() => { setForgotPassword(true); setNotice(null); }}>
      Ai uitat parola?
    </button>}
    <button className="linkBtn" onClick={() => { setForgotPassword(false); setSignup(forgotPassword ? false : !signup); setNotice(null); }}>
      {forgotPassword ? "Înapoi la conectare" : signup ? "Ai deja cont? Conectează-te" : "Nu ai cont? Creează unul"}
    </button>
    <p className="note">Versiune de test. Nu introduce date medicale reale.</p>
  </section></main>;
}

function UpdatePassword({ completed }) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);

  async function submit(e) {
    e.preventDefault();
    setNotice(null);
    if (password !== confirmPassword) {
      setNotice({ error: true, text: "Parolele nu coincid." });
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) setNotice({ error: true, text: error.message });
    else {
      setNotice({ text: "Parola a fost schimbată. Poți continua în aplicație." });
      setPassword("");
      setConfirmPassword("");
      completed();
    }
    setBusy(false);
  }

  return <main className="loginShell"><section className="loginCard">
    <div className="logo">eC</div><p className="eyebrow">eClinic Chat</p>
    <h1>Alege o parolă nouă</h1>
    <p className="muted">Folosește minimum 8 caractere și nu reutiliza o parolă veche.</p>
    <form onSubmit={submit} className="form">
      <label>Parola nouă<input type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} /></label>
      <label>Confirmă parola<input type="password" required minLength={8} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} /></label>
      {notice && <p className={notice.error ? "error" : "success"}>{notice.text}</p>}
      <button className="primary" disabled={busy || password.length < 8 || confirmPassword.length < 8}>{busy ? "Se salvează..." : "Salvează parola nouă"}</button>
    </form>
  </section></main>;
}

function NewConversation({ close, created, communities, selectedCommunityId, isGeneralAdmin }) {
  const [title, setTitle] = useState("");
  const [emails, setEmails] = useState("");
  const allowedCommunities = communities.filter((item) => item.my_is_admin);
  const initialCommunity = selectedCommunityId && selectedCommunityId !== "all" && selectedCommunityId !== "private"
    ? selectedCommunityId : isGeneralAdmin ? "" : (allowedCommunities[0]?.id || "");
  const [communityId, setCommunityId] = useState(initialCommunity);
  const [initialPassword, setInitialPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const memberEmails = emails.split(/[,\n;]/).map((x) => x.trim().toLowerCase()).filter(Boolean);
    const { data, error: rpcError } = await supabase.rpc("create_managed_conversation", {
      conversation_title: title.trim(), member_emails: memberEmails,
      target_community_id: communityId || null, initial_password: initialPassword || null,
    });
    if (rpcError) setError(rpcError.message);
    else created(data);
    setBusy(false);
  }

  return <div className="modalBackdrop" onMouseDown={close}><section className="modal" onMouseDown={(e) => e.stopPropagation()}>
    <div className="modalTitle"><div><p className="eyebrow">Grup privat</p><h2>Grup nou</h2></div>
      <button className="iconBtn" onClick={close}>×</button></div>
    <form className="form" onSubmit={submit}>
      <label>Numele grupului<input required maxLength={80} value={title} onChange={(e) => setTitle(e.target.value)} /></label>
      <label>Locul grupului<select value={communityId} onChange={(e) => setCommunityId(e.target.value)}>
        {isGeneralAdmin && <option value="">Grup privat independent</option>}
        {allowedCommunities.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
      </select></label>
      <label>Emailurile membrilor<textarea rows={4} placeholder="medic1@exemplu.ro, medic2@exemplu.ro" value={emails} onChange={(e) => setEmails(e.target.value)} /></label>
      <p className="helper">Pentru un grup din comunitate, persoanele trebuie adăugate mai întâi în comunitate.</p>
      <label>Parolă suplimentară opțională<input type="password" minLength={6} maxLength={64} placeholder="Lasă liber dacă nu dorești parolă" value={initialPassword} onChange={(e) => setInitialPassword(e.target.value)} /></label>
      {error && <p className="error">{error}</p>}
      <div className="modalActions"><button type="button" onClick={close}>Renunță</button>
        <button className="primary" disabled={busy || !title.trim()}>{busy ? "Se creează..." : "Creează"}</button></div>
    </form>
  </section></div>;
}

function NewCommunity({ close, created }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(e) {
    e.preventDefault(); setBusy(true); setError("");
    const { data, error: createError } = await supabase.rpc("create_community", {
      community_name: name.trim(), community_description: description.trim(),
    });
    if (createError) setError(createError.message); else created(data);
    setBusy(false);
  }
  return <div className="modalBackdrop" onMouseDown={close}><section className="modal" onMouseDown={(e) => e.stopPropagation()}>
    <div className="modalTitle"><div><p className="eyebrow">eClinic</p><h2>Comunitate nouă</h2></div><button className="iconBtn" onClick={close}>×</button></div>
    <form className="form" onSubmit={submit}>
      <label>Numele comunității<input required maxLength={80} value={name} onChange={(e) => setName(e.target.value)} /></label>
      <label>Descriere<textarea rows={3} maxLength={500} value={description} onChange={(e) => setDescription(e.target.value)} /></label>
      {error && <p className="error">{error}</p>}
      <div className="modalActions"><button type="button" onClick={close}>Renunță</button><button className="primary" disabled={busy || !name.trim()}>{busy ? "Se creează..." : "Creează"}</button></div>
    </form>
  </section></div>;
}

function Chat({ session }) {
  const [rooms, setRooms] = useState([]);
  const [communities, setCommunities] = useState([]);
  const [selectedCommunityId, setSelectedCommunityId] = useState("all");
  const [isGeneralAdmin, setIsGeneralAdmin] = useState(false);
  const [communityModal, setCommunityModal] = useState(false);
  const [communitySettingsOpen, setCommunitySettingsOpen] = useState(false);
  const [communityMembers, setCommunityMembers] = useState([]);
  const [communityName, setCommunityName] = useState("");
  const [communityDescription, setCommunityDescription] = useState("");
  const [communityMemberEmails, setCommunityMemberEmails] = useState("");
  const [communityBusy, setCommunityBusy] = useState(false);
  const [communityError, setCommunityError] = useState("");
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
  const previousRoomId = useRef(null);
  const room = rooms.find((x) => x.id === roomId);
  const selectedCommunity = communities.find((x) => x.id === selectedCommunityId);
  const visibleRooms = rooms.filter((item) => selectedCommunityId === "all" ? true : selectedCommunityId === "private" ? !item.community_id : item.community_id === selectedCommunityId);
  const canCreateGroup = selectedCommunityId === "private"
    ? isGeneralAdmin
    : isGeneralAdmin || communities.some((item) => item.my_is_admin);
  const currentMembership = members.find((x) => x.user_id === session.user.id);
  const isOwner = room?.created_by === session.user.id;
  const isAdmin = Boolean(isOwner || currentMembership?.is_admin);
  const pinnedMessages = messages.filter((x) => x.pinned_at).sort((a, b) => new Date(b.pinned_at) - new Date(a.pinned_at));

  async function signOut() {
    clearTimeout(inactivityTimer.current);
    clearTimeout(warningTimer.current);
    clearInterval(countdownTimer.current);
    if (roomId) {
      await supabase.rpc("lock_conversation", { target_conversation_id: roomId });
    }
    await supabase.auth.signOut();
  }

  useEffect(() => {
    const previous = previousRoomId.current;
    if (previous && previous !== roomId) {
      supabase.rpc("lock_conversation", { target_conversation_id: previous });
    }
    previousRoomId.current = roomId;
  }, [roomId]);

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
    if (loadError) setError("Grupurile nu au putut fi încărcate. Verifică instalarea scriptului SQL v1.0.");
    else {
      const list = data || [];
      setRooms(list);
      setRoomId((current) => preferredId && list.some((x) => x.id === preferredId) ? preferredId : list.some((x) => x.id === current) ? current : null);
    }
    setLoading(false);
  }

  async function loadCommunities(preferredId) {
    const [{ data: contextData, error: contextError }, { data, error: communityLoadError }] = await Promise.all([
      supabase.rpc("get_app_context"), supabase.rpc("get_my_communities"),
    ]);
    if (!contextError) setIsGeneralAdmin(Boolean(contextData?.[0]?.is_general_admin));
    if (communityLoadError) setError("Comunitățile nu au putut fi încărcate. Rulează scriptul SQL v1.0.");
    else {
      const list = data || [];
      setCommunities(list);
      if (preferredId && list.some((item) => item.id === preferredId)) setSelectedCommunityId(preferredId);
    }
  }

  useEffect(() => { loadRooms(); loadCommunities(); }, []);
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

  async function loadCommunityMembers() {
    if (!selectedCommunity) return;
    setCommunityError("");
    const { data, error: memberError } = await supabase.rpc("get_community_members", {
      target_community_id: selectedCommunity.id,
    });
    if (memberError) setCommunityError(memberError.message); else setCommunityMembers(data || []);
  }

  async function openCommunitySettings() {
    if (!selectedCommunity) return;
    setCommunityName(selectedCommunity.name);
    setCommunityDescription(selectedCommunity.description || "");
    setCommunityMemberEmails(""); setCommunityMembers([]); setCommunityError("");
    setCommunitySettingsOpen(true);
    await loadCommunityMembers();
  }

  async function saveCommunity(e) {
    e.preventDefault();
    if (!selectedCommunity || communityBusy || !communityName.trim()) return;
    setCommunityBusy(true); setCommunityError("");
    const { error: saveError } = await supabase.rpc("update_community", {
      target_community_id: selectedCommunity.id, new_name: communityName.trim(), new_description: communityDescription.trim(),
    });
    if (saveError) setCommunityError(saveError.message); else await loadCommunities(selectedCommunity.id);
    setCommunityBusy(false);
  }

  async function addCommunityMembers(e) {
    e.preventDefault();
    const emails = communityMemberEmails.split(/[,\n;]/).map((x) => x.trim().toLowerCase()).filter(Boolean);
    if (!selectedCommunity || !emails.length || communityBusy) return;
    setCommunityBusy(true); setCommunityError("");
    const { error: addError } = await supabase.rpc("add_community_members", {
      target_community_id: selectedCommunity.id, member_emails: emails,
    });
    if (addError) setCommunityError(addError.message);
    else { setCommunityMemberEmails(""); await Promise.all([loadCommunityMembers(),loadCommunities(selectedCommunity.id)]); }
    setCommunityBusy(false);
  }

  async function toggleCommunityAdmin(member) {
    if (!selectedCommunity || communityBusy || !window.confirm(member.is_admin ? `Retragi rolul de administrator pentru ${member.email}?` : `Acordezi rolul de administrator lui ${member.email}?`)) return;
    setCommunityBusy(true); setCommunityError("");
    const { error: adminError } = await supabase.rpc("set_community_admin", {
      target_community_id: selectedCommunity.id,target_user_id: member.user_id,make_admin: !member.is_admin,
    });
    if (adminError) setCommunityError(adminError.message); else await loadCommunityMembers();
    setCommunityBusy(false);
  }

  async function removeCommunityMember(member) {
    if (!selectedCommunity || communityBusy || !window.confirm(`Elimini ${member.email} din comunitate și din grupurile ei?`)) return;
    setCommunityBusy(true); setCommunityError("");
    const { error: removeError } = await supabase.rpc("remove_community_member", {
      target_community_id: selectedCommunity.id,target_user_id: member.user_id,
    });
    if (removeError) setCommunityError(removeError.message);
    else await Promise.all([loadCommunityMembers(),loadCommunities(selectedCommunity.id),loadRooms()]);
    setCommunityBusy(false);
  }

  async function deleteCommunity() {
    if (!selectedCommunity || communityBusy || !window.confirm("Ștergi comunitatea? Aceasta trebuie să nu mai conțină grupuri.")) return;
    setCommunityBusy(true); setCommunityError("");
    const { error: deleteError } = await supabase.rpc("delete_community", { target_community_id: selectedCommunity.id });
    if (deleteError) { setCommunityError(deleteError.message); setCommunityBusy(false); return; }
    setCommunitySettingsOpen(false); setSelectedCommunityId("all"); await loadCommunities(); setCommunityBusy(false);
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
      <div className="brandRow"><div><p className="eyebrow">eClinic</p><h2>Comunități</h2></div><button className="logoutBtn" onClick={signOut} title="Ieșire din cont"><span className="logoutText">Ieșire</span><span className="logoutIcon" aria-hidden="true">↪</span></button></div>
      <div className="communityNav">
        <div className="communityNavTitle"><strong>Comunități</strong>{isGeneralAdmin && <button title="Comunitate nouă" onClick={() => setCommunityModal(true)}>＋</button>}</div>
        <button className={selectedCommunityId === "all" ? "selected" : ""} onClick={() => { setSelectedCommunityId("all"); setRoomId(null); }}>Toate grupurile</button>
        <button className={selectedCommunityId === "private" ? "selected" : ""} onClick={() => { setSelectedCommunityId("private"); setRoomId(null); }}>Grupuri independente</button>
        {communities.map((item) => <button key={item.id} className={selectedCommunityId === item.id ? "selected" : ""} onClick={() => { setSelectedCommunityId(item.id); setRoomId(null); }}>
          <span>◉</span><div><strong>{item.name}</strong><small>{item.group_count} grupuri · {item.member_count} membri</small></div>
        </button>)}
      </div>
      {selectedCommunity?.my_is_admin && <button className="manageCommunityBtn" onClick={openCommunitySettings}>⚙ Administrează comunitatea</button>}
      {canCreateGroup && <button className="primary newBtn" onClick={() => setModal(true)}>+ Grup nou</button>}
      <div className="conversationList">
        {loading && <p className="status">Se încarcă...</p>}
        {!loading && visibleRooms.length === 0 && <p className="emptySide">Nu ai grupuri în această secțiune.</p>}
        {visibleRooms.map((item) => <button className={`conv ${item.id === roomId ? "active" : ""}`} key={item.id} onClick={() => setRoomId(item.id)}>
          <span>{item.title.slice(0, 2).toUpperCase()}</span><div><strong>{item.is_pinned && "📌 "}{item.title}</strong><small>{item.member_count} membri · {item.community_name || "independent"}</small></div>
          {!item.password_protected && item.unread_count > 0 && <i className="unreadBadge">{item.unread_count > 99 ? "99+" : item.unread_count}</i>}
        </button>)}
      </div>
      <div className="user"><strong>{session.user.email}</strong><small>{isGeneralAdmin ? "Administrator general" : "Conectat"}</small></div>
    </aside>
    <section className="chat">
      {room ? <><header><div><strong>{room.title}</strong><small>{room.member_count} membri · {room.community_name || "grup independent"} · numai membrii au acces</small></div><div className="headerActions"><b>● Privat</b><button onClick={toggleGroupPin}>{room.is_pinned ? "📌 Fixat" : "Fixează sus"}</button><button onClick={openSettings}>Gestionează</button></div></header>
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
        <div className="welcome"><div className="logo">eC</div><h2>{selectedCommunity?.name || "Grupuri private"}</h2><p>{visibleRooms.length ? "Selectează un grup din listă pentru a-l deschide." : canCreateGroup ? "Poți crea primul grup din această secțiune." : "Nu există încă grupuri disponibile."}</p>
          {!visibleRooms.length && canCreateGroup && <button className="primary" onClick={() => setModal(true)}>Creează primul grup</button>}{error && <p className="chatError">{error}</p>}</div>}
    </section>
    {modal && <NewConversation close={() => setModal(false)} communities={communities} selectedCommunityId={selectedCommunityId} isGeneralAdmin={isGeneralAdmin} created={(id) => { setModal(false); loadRooms(id); loadCommunities(); }} />}
    {communityModal && <NewCommunity close={() => setCommunityModal(false)} created={(id) => { setCommunityModal(false); loadCommunities(id); }} />}
    {settingsOpen && room && <div className="modalBackdrop" onMouseDown={() => !settingsBusy && setSettingsOpen(false)}><section className="modal manageModal" onMouseDown={(e) => e.stopPropagation()}>
      <div className="modalTitle"><div><p className="eyebrow">Grup privat</p><h2>Administrare</h2></div><button className="iconBtn" disabled={settingsBusy} onClick={() => setSettingsOpen(false)}>×</button></div>
      {isAdmin && <form className="manageSection" onSubmit={renameConversation}>
        <label>Numele grupului<div className="inlineForm"><input required maxLength={80} value={settingsTitle} onChange={(e) => setSettingsTitle(e.target.value)} /><button className="primary" disabled={settingsBusy || !settingsTitle.trim()}>Salvează</button></div></label>
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
      {isAdmin && <form className="manageSection" onSubmit={saveGroupPassword}>
        <div className="sectionHeading"><strong>Parolă suplimentară</strong><small>{passwordProtected ? "Activă" : "Inactivă"}</small></div>
        <label>{passwordProtected ? "Schimbă parola grupului" : "Protejează grupul cu parolă"}<input type="password" minLength={6} maxLength={64} placeholder="Minimum 6 caractere" value={groupPassword} onChange={(e) => setGroupPassword(e.target.value)} /></label>
        <p className="helper">Va fi cerută membrilor la fiecare deschidere a grupului. Parola nu este afișată și nu este stocată în clar.</p>
        <div className="passwordActions"><button className="primary" disabled={settingsBusy || groupPassword.length < 6}>{passwordProtected ? "Schimbă parola" : "Activează parola"}</button>
          {passwordProtected && <button type="button" disabled={settingsBusy} onClick={removeGroupPassword}>Elimină parola</button>}</div>
      </form>}
      {settingsError && <p className="error manageError">{settingsError}</p>}
      <div className="dangerZone">{isOwner ? <button className="dangerBtn" disabled={settingsBusy} onClick={deleteConversation}>Șterge conversația</button> : <button className="dangerBtn" disabled={settingsBusy} onClick={leaveConversation}>Părăsește conversația</button>}</div>
    </section></div>}
    {communitySettingsOpen && selectedCommunity && <div className="modalBackdrop" onMouseDown={() => !communityBusy && setCommunitySettingsOpen(false)}><section className="modal manageModal" onMouseDown={(e) => e.stopPropagation()}>
      <div className="modalTitle"><div><p className="eyebrow">Comunitate</p><h2>Administrare</h2></div><button className="iconBtn" disabled={communityBusy} onClick={() => setCommunitySettingsOpen(false)}>×</button></div>
      <form className="manageSection" onSubmit={saveCommunity}>
        <label>Numele comunității<input required maxLength={80} value={communityName} onChange={(e) => setCommunityName(e.target.value)} /></label>
        <label>Descriere<textarea rows={2} maxLength={500} value={communityDescription} onChange={(e) => setCommunityDescription(e.target.value)} /></label>
        <button className="primary" disabled={communityBusy || !communityName.trim()}>Salvează</button>
      </form>
      <div className="manageSection"><div className="sectionHeading"><strong>Membrii comunității</strong><small>{communityMembers.length}</small></div>
        <div className="memberList">{communityMembers.map((member) => <div className="memberRow" key={member.user_id}><div><strong>{member.email}</strong><small>{member.is_admin ? "Administrator de comunitate" : "Membru"}</small></div>
          <div className="memberActions">{isGeneralAdmin && member.user_id !== session.user.id && <button disabled={communityBusy} onClick={() => toggleCommunityAdmin(member)}>{member.is_admin ? "Retrage admin" : "Fă admin"}</button>}
          {member.user_id !== session.user.id && (!member.is_admin || isGeneralAdmin) && <button disabled={communityBusy} onClick={() => removeCommunityMember(member)}>Elimină</button>}</div>
        </div>)}</div>
      </div>
      <form className="manageSection" onSubmit={addCommunityMembers}>
        <label>Adaugă membri<textarea rows={2} placeholder="coleg@exemplu.ro" value={communityMemberEmails} onChange={(e) => setCommunityMemberEmails(e.target.value)} /></label>
        <p className="helper">Persoanele trebuie să aibă deja cont. Adresele pot fi separate prin virgulă.</p>
        <button className="primary" disabled={communityBusy || !communityMemberEmails.trim()}>Adaugă în comunitate</button>
      </form>
      {communityError && <p className="error manageError">{communityError}</p>}
      {isGeneralAdmin && <div className="dangerZone"><button className="dangerBtn" disabled={communityBusy} onClick={deleteCommunity}>Șterge comunitatea</button></div>}
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
  const [passwordRecovery, setPasswordRecovery] = useState(false);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setChecking(false); });
    const { data } = supabase.auth.onAuthStateChange((event, next) => {
      if (event === "PASSWORD_RECOVERY") setPasswordRecovery(true);
      setSession(next);
      setChecking(false);
    });
    return () => data.subscription.unsubscribe();
  }, []);
  if (checking) return <main className="center">Se verifică sesiunea...</main>;
  if (passwordRecovery && session) return <UpdatePassword completed={() => setPasswordRecovery(false)} />;
  return session ? <Chat session={session} /> : <Login />;
}
