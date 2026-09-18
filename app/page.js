"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";

const time = (value, language = "ro") => new Date(value).toLocaleTimeString(language === "en" ? "en-GB" : "ro-RO", { hour: "2-digit", minute: "2-digit" });
const localize = (language, ro, en) => language === "en" ? en : ro;
const INACTIVITY_MS = 15 * 60 * 1000;
const WARNING_MS = 60 * 1000;
const QUICK_EMOJIS = [
  "😀", "😃", "😄", "😁", "😂", "🤣", "😊", "😍", "🥰", "😘",
  "😎", "🤩", "🤔", "🙄", "😮", "😢", "😭", "😡", "🤗", "🤝",
  "👍", "👎", "👏", "🙌", "🙏", "💪", "❤️", "💙", "💚", "🔥",
  "🎉", "✅", "❌", "⚠️", "📌", "💡", "👀", "💯", "🚑", "🏥",
];
const REACTION_EMOJIS = ["👍", "❤️", "😂", "🤣", "😮", "😢", "👏", "🙏", "🔥", "✅", "👀", "💯"];

const UI = {
  ro: {
    secureSignIn: "Conectare securizată", privateHelp: "Conversațiile sunt vizibile numai membrilor adăugați.",
    email: "Email", password: "Parolă", enterApp: "Intră în aplicație", processing: "Se procesează...",
    forgot: "Ai uitat parola?", noAccount: "Nu ai cont? Creează unul", testWarning: "Versiune de test. Nu introduce date medicale sau personale reale.",
    myConversations: "Conversațiile mele", allConversations: "Toate conversațiile", otherGroups: "Alte grupuri",
    communities: "Comunități", newGroup: "+ Grup nou", settings: "⚙️ Setări", pin: "📌 Pin", pinned: "📌 Fixat",
    logout: "Ieșire", connected: "Conectat", generalAdmin: "Administrator general", members: "membri",
    yourConversations: "Conversațiile tale", chooseConversation: "Alege o conversație pentru a o deschide.",
    noConversations: "Nu există încă nicio conversație disponibilă.", firstGroup: "Creează primul grup",
    messagePlaceholder: "Scrie un mesaj...", send: "Trimite", sending: "Se trimite...",
    resumeNotifications: "Reia notificările", profile: "Profil", displayName: "Nume afișat", language: "Limba interfeței",
    save: "Salvează", cancel: "Renunță", accountSettings: "Setările contului", createdBy: "Creat de eClinic Hub",
    mentionHint: "Menționează un membru", loading: "Se încarcă...", groupWithoutCommunity: "fără comunitate",
  },
  en: {
    secureSignIn: "Secure sign-in", privateHelp: "Conversations are visible only to added members.",
    email: "Email", password: "Password", enterApp: "Open app", processing: "Processing...",
    forgot: "Forgot your password?", noAccount: "No account? Create one", testWarning: "Test version. Do not enter real medical or personal data.",
    myConversations: "My conversations", allConversations: "All conversations", otherGroups: "Other groups",
    communities: "Communities", newGroup: "+ New group", settings: "⚙️ Settings", pin: "📌 Pin", pinned: "📌 Pinned",
    logout: "Sign out", connected: "Connected", generalAdmin: "General administrator", members: "members",
    yourConversations: "Your conversations", chooseConversation: "Choose a conversation to open it.",
    noConversations: "There are no conversations available yet.", firstGroup: "Create the first group",
    messagePlaceholder: "Write a message...", send: "Send", sending: "Sending...",
    resumeNotifications: "Resume notifications", profile: "Profile", displayName: "Display name", language: "Interface language",
    save: "Save", cancel: "Cancel", accountSettings: "Account settings", createdBy: "Created by eClinic Hub",
    mentionHint: "Mention a member", loading: "Loading...", groupWithoutCommunity: "no community",
  },
};

const translator = (language) => (key) => UI[language]?.[key] || UI.ro[key] || key;

function LinkifiedText({ text }) {
  return text.split(/(https?:\/\/[^\s]+)/gi).map((part, index) => {
    if (!/^https?:\/\//i.test(part)) return part;
    return <a
      className="messageLink"
      href={part}
      target="_blank"
      rel="noopener noreferrer nofollow"
      key={`${part}-${index}`}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        window.open(part, "_blank", "noopener,noreferrer");
      }}
    >{part}</a>;
  });
}

function urlBase64ToUint8Array(value) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  return Uint8Array.from([...raw].map((character) => character.charCodeAt(0)));
}

function Login({ language, setLanguage }) {
  const t = translator(language);
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
      setNotice({ text: language === "en" ? "Account created. Check your email, then sign in." : "Cont creat. Verifică emailul, apoi conectează-te." });
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
      redirectTo: `${window.location.origin}/?recovery=1`,
    });
    if (error) setNotice({ error: true, text: error.message });
    else setNotice({ text: language === "en" ? "If an account exists for this address, you will receive a password reset email." : "Dacă adresa are un cont, vei primi un email pentru alegerea unei parole noi." });
    setBusy(false);
  }

  return <main className="loginShell"><section className="loginCard">
    <div className="loginTop"><div className="logo">eC</div><div className="languageSwitch"><button className={language === "ro" ? "active" : ""} onClick={() => setLanguage("ro")}>RO</button><button className={language === "en" ? "active" : ""} onClick={() => setLanguage("en")}>EN</button></div></div>
    <p className="appName">eClinTalk</p>
    <h1>{forgotPassword ? (language === "en" ? "Reset password" : "Recuperează parola") : signup ? (language === "en" ? "Create account" : "Creează cont") : t("secureSignIn")}</h1>
    <p className="muted">{t("privateHelp")}</p>
    {forgotPassword ? <form onSubmit={sendResetLink} className="form">
      <label>{t("email")}<input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></label>
      {notice && <p className={notice.error ? "error" : "success"}>{notice.text}</p>}
      <button disabled={busy} className="primary">{busy ? (language === "en" ? "Sending..." : "Se trimite...") : (language === "en" ? "Send recovery link" : "Trimite linkul de recuperare")}</button>
    </form> : <form onSubmit={submit} className="form">
      <label>{t("email")}<input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></label>
      <label>{t("password")}<input type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} /></label>
      {notice && <p className={notice.error ? "error" : "success"}>{notice.text}</p>}
      <button disabled={busy} className="primary">{busy ? t("processing") : signup ? (language === "en" ? "Create account" : "Creează cont") : t("enterApp")}</button>
    </form>}
    {!forgotPassword && !signup && <button className="linkBtn" onClick={() => { setForgotPassword(true); setNotice(null); }}>
      {t("forgot")}
    </button>}
    <button className="linkBtn" onClick={() => { setForgotPassword(false); setSignup(forgotPassword ? false : !signup); setNotice(null); }}>
      {forgotPassword ? (language === "en" ? "Back to sign-in" : "Înapoi la conectare") : signup ? (language === "en" ? "Already have an account? Sign in" : "Ai deja cont? Conectează-te") : t("noAccount")}
    </button>
    <p className="note">{t("testWarning")}</p><p className="poweredBy">{t("createdBy")}</p>
  </section></main>;
}

function UpdatePassword({ completed, language }) {
  const l = (ro, en) => localize(language, ro, en);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);

  async function submit(e) {
    e.preventDefault();
    setNotice(null);
    if (password !== confirmPassword) {
      setNotice({ error: true, text: l("Parolele nu coincid.", "Passwords do not match.") });
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) setNotice({ error: true, text: error.message });
    else {
      setNotice({ text: l("Parola a fost schimbată. Poți continua în aplicație.", "Your password was changed. You can continue to the app.") });
      setPassword("");
      setConfirmPassword("");
      completed();
    }
    setBusy(false);
  }

  return <main className="loginShell"><section className="loginCard">
    <div className="logo">eC</div><p className="appName">eClinTalk</p>
    <h1>{l("Alege o parolă nouă", "Choose a new password")}</h1>
    <p className="muted">{l("Folosește minimum 8 caractere și nu reutiliza o parolă veche.", "Use at least 8 characters and do not reuse an old password.")}</p>
    <form onSubmit={submit} className="form">
      <label>{l("Parola nouă", "New password")}<input type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} /></label>
      <label>{l("Confirmă parola", "Confirm password")}<input type="password" required minLength={8} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} /></label>
      {notice && <p className={notice.error ? "error" : "success"}>{notice.text}</p>}
      <button className="primary" disabled={busy || password.length < 8 || confirmPassword.length < 8}>{busy ? l("Se salvează...", "Saving...") : l("Salvează parola nouă", "Save new password")}</button>
    </form>
  </section></main>;
}

function NewConversation({ close, created, communities, selectedCommunityId, isGeneralAdmin, language }) {
  const l = (ro, en) => localize(language, ro, en);
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
    <div className="modalTitle"><div><p className="eyebrow">{l("Grup privat", "Private group")}</p><h2>{l("Grup nou", "New group")}</h2></div>
      <button className="iconBtn" onClick={close}>×</button></div>
    <form className="form" onSubmit={submit}>
      <label>{l("Numele grupului", "Group name")}<input required maxLength={80} value={title} onChange={(e) => setTitle(e.target.value)} /></label>
      <label>{l("Locul grupului", "Group location")}<select value={communityId} onChange={(e) => setCommunityId(e.target.value)}>
        {isGeneralAdmin && <option value="">{l("Fără comunitate", "No community")}</option>}
        {allowedCommunities.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
      </select></label>
      <label>{l("Emailurile membrilor", "Member emails")}<textarea rows={4} placeholder="user1@example.com, user2@example.com" value={emails} onChange={(e) => setEmails(e.target.value)} /></label>
      <p className="helper">{l("Pentru un grup din comunitate, persoanele trebuie adăugate mai întâi în comunitate.", "For a community group, people must first be added to the community.")}</p>
      <label>{l("Parolă suplimentară opțională", "Optional additional password")}<input type="password" minLength={6} maxLength={64} placeholder={l("Lasă liber dacă nu dorești parolă", "Leave blank if no password is needed")} value={initialPassword} onChange={(e) => setInitialPassword(e.target.value)} /></label>
      {error && <p className="error">{error}</p>}
      <div className="modalActions"><button type="button" onClick={close}>{l("Renunță", "Cancel")}</button>
        <button className="primary" disabled={busy || !title.trim()}>{busy ? l("Se creează...", "Creating...") : l("Creează", "Create")}</button></div>
    </form>
  </section></div>;
}

function NewCommunity({ close, created, language }) {
  const l = (ro, en) => localize(language, ro, en);
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
    <div className="modalTitle"><div><p className="eyebrow">eClinTalk</p><h2>{l("Comunitate nouă", "New community")}</h2></div><button className="iconBtn" onClick={close}>×</button></div>
    <form className="form" onSubmit={submit}>
      <label>{l("Numele comunității", "Community name")}<input required maxLength={80} value={name} onChange={(e) => setName(e.target.value)} /></label>
      <label>{l("Descriere", "Description")}<textarea rows={3} maxLength={500} value={description} onChange={(e) => setDescription(e.target.value)} /></label>
      {error && <p className="error">{error}</p>}
      <div className="modalActions"><button type="button" onClick={close}>{l("Renunță", "Cancel")}</button><button className="primary" disabled={busy || !name.trim()}>{busy ? l("Se creează...", "Creating...") : l("Creează", "Create")}</button></div>
    </form>
  </section></div>;
}

function Chat({ session, language, setLanguage }) {
  const t = translator(language);
  const l = (ro, en) => localize(language, ro, en);
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
  const [deletingMessageId, setDeletingMessageId] = useState(null);
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
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [mentionsOnly, setMentionsOnly] = useState(false);
  const [mutedUntil, setMutedUntil] = useState("");
  const [notificationBusy, setNotificationBusy] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [logoutWarning, setLogoutWarning] = useState(false);
  const [logoutCountdown, setLogoutCountdown] = useState(60);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileName, setProfileName] = useState("");
  const [profileBusy, setProfileBusy] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [selectedMentions, setSelectedMentions] = useState([]);
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
  const displayNameForUser = (userId, fallback) => members.find((member) => member.user_id === userId)?.display_name || fallback || l("Utilizator", "User");
  const mentionMatch = draft.match(/(?:^|\s)@([^\s@]*)$/);
  const mentionQuery = (mentionMatch?.[1] || "").toLocaleLowerCase();
  const mentionSuggestions = mentionMatch ? members
    .filter((member) => member.user_id !== session.user.id)
    .filter((member) => {
      const name = (member.display_name || "").toLocaleLowerCase();
      const emailName = (member.email || "").split("@")[0].toLocaleLowerCase();
      return !mentionQuery || name.includes(mentionQuery) || emailName.includes(mentionQuery);
    }).slice(0, 6) : [];

  function chooseCommunity(id) {
    setSelectedCommunityId(id);
    setRoomId(null);
    setMobileMenuOpen(false);
  }

  function chooseRoom(id) {
    setRoomId(id);
    setMobileMenuOpen(false);
  }

  function insertMention(member) {
    const label = (member.display_name || member.email?.split("@")[0] || "membru").trim();
    setDraft((current) => current.replace(/(?:^|\s)@([^\s@]*)$/, (match) => `${match.startsWith(" ") ? " " : ""}@${label} `));
    setSelectedMentions((current) => current.some((item) => item.user_id === member.user_id)
      ? current : [...current, { user_id: member.user_id, label }]);
  }

  async function openProfile() {
    setProfileError("");
    const { data, error: profileLoadError } = await supabase.from("profiles")
      .select("display_name, preferred_language").eq("user_id", session.user.id).maybeSingle();
    if (profileLoadError) setProfileError(profileLoadError.message);
    setProfileName(data?.display_name || session.user.email?.split("@")[0] || "");
    if (data?.preferred_language) setLanguage(data.preferred_language);
    setProfileOpen(true);
  }

  async function saveProfile(e) {
    e.preventDefault();
    if (profileBusy || profileName.trim().length < 2) return;
    setProfileBusy(true); setProfileError("");
    const { error: profileSaveError } = await supabase.from("profiles").update({
      display_name: profileName.trim(), preferred_language: language, updated_at: new Date().toISOString(),
    }).eq("user_id", session.user.id);
    if (profileSaveError) setProfileError(profileSaveError.message);
    else { setProfileOpen(false); if (roomId) await loadMembers(); }
    setProfileBusy(false);
  }

  async function signOut() {
    clearTimeout(inactivityTimer.current);
    clearTimeout(warningTimer.current);
    clearInterval(countdownTimer.current);
    if (roomId) {
      await supabase.rpc("lock_conversation", { target_conversation_id: roomId });
    }
    try {
      if ("serviceWorker" in navigator) {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        if (subscription) {
          await fetch("/api/push/subscribe", {
            method: "DELETE",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
            body: JSON.stringify({ endpoint: subscription.endpoint }),
          });
          await subscription.unsubscribe();
        }
      }
    } catch {}
    await supabase.auth.signOut();
  }

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    let active = true;
    navigator.serviceWorker.register("/sw.js")
      .then(() => navigator.serviceWorker.ready)
      .then(async (registration) => {
        const subscription = await registration.pushManager.getSubscription();
        if (active) setPushEnabled(Boolean(subscription));
      })
      .catch(() => active && setPushEnabled(false));
    return () => { active = false; };
  }, []);

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
    if (loadError) setError(l("Grupurile nu au putut fi încărcate. Verifică instalarea scriptului SQL v1.7.", "Groups could not be loaded. Check that the v1.7 SQL script is installed."));
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
    if (communityLoadError) setError(l("Comunitățile nu au putut fi încărcate. Verifică instalarea scriptului SQL.", "Communities could not be loaded. Check the SQL installation."));
    else {
      const list = data || [];
      setCommunities(list);
      if (preferredId && list.some((item) => item.id === preferredId)) setSelectedCommunityId(preferredId);
    }
  }

  useEffect(() => {
    loadRooms(); loadCommunities();
    supabase.from("profiles").select("display_name, preferred_language").eq("user_id", session.user.id).maybeSingle()
      .then(({ data }) => {
        if (data?.display_name) setProfileName(data.display_name);
        if (data?.preferred_language) setLanguage(data.preferred_language);
      });
  }, []);
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
    if (roomId && unlockedRoomId === roomId) loadMembers();
  }, [roomId, unlockedRoomId]);
  useEffect(() => {
    if (!roomId) return;
    let active = true;
    supabase.from("notification_preferences")
      .select("notifications_enabled, sound_enabled, mentions_only, muted_until")
      .eq("conversation_id", roomId)
      .maybeSingle()
      .then(({ data }) => {
        if (!active) return;
        setNotificationsEnabled(data?.notifications_enabled ?? true);
        setSoundEnabled(data?.sound_enabled ?? true);
        setMentionsOnly(data?.mentions_only ?? false);
        setMutedUntil(data?.muted_until || "");
      });
    return () => { active = false; };
  }, [roomId]);
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
        if (messageResult.error) setError(l("Mesajele nu au putut fi încărcate.", "Messages could not be loaded."));
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
    if (!allowed.includes(file.type)) { setError(l("Poți atașa numai imagini JPG, PNG, WEBP sau HEIC.", "You can only attach JPG, PNG, WEBP, or HEIC images.")); e.target.value = ""; return; }
    if (file.size > 10 * 1024 * 1024) { setError(l("Imaginea trebuie să aibă cel mult 10 MB.", "The image must be no larger than 10 MB.")); e.target.value = ""; return; }
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
      if (uploadError) { setError(l("Imaginea nu a putut fi încărcată.", "The image could not be uploaded.")); setSending(false); return; }
      attachmentData = { attachment_path: uploadedPath, attachment_name: attachment.name, attachment_type: attachment.type, attachment_size: attachment.size };
    }
    const activeMentionIds = selectedMentions
      .filter((mention) => body.includes(`@${mention.label}`))
      .map((mention) => mention.user_id);
    const { data, error: sendError } = await supabase.from("private_messages").insert({
      conversation_id: roomId, user_id: session.user.id, sender_email: session.user.email, body: body || null,
      reply_to_id: replyTo?.id || null, mentioned_user_ids: activeMentionIds, ...attachmentData,
    }).select().single();
    if (sendError) {
      if (uploadedPath) await supabase.storage.from("chat-images").remove([uploadedPath]);
      setError(l("Mesajul nu a fost trimis.", "The message was not sent."));
    }
    else {
      setDraft("");
      setReplyTo(null);
      setEmojiOpen(false);
      setSelectedMentions([]);
      setAttachment(null);
      if (fileInput.current) fileInput.current.value = "";
      setMessages((current) => current.some((x) => x.id === data.id) ? current : [...current, data]);
      loadRooms(roomId);
      fetch("/api/push/send", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ messageId: data.id }),
      }).catch(() => {});
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

  async function deleteMessage(item) {
    if (deletingMessageId || item.deleted_at) return;
    const ownMessage = item.user_id === session.user.id;
    const question = ownMessage
      ? l("Ștergi acest mesaj? Acțiunea nu poate fi anulată.", "Delete this message? This action cannot be undone.")
      : l("Ștergi mesajul acestui membru? Acțiunea va fi înregistrată.", "Delete this member's message? The action will be logged.");
    if (!window.confirm(question)) return;

    setDeletingMessageId(item.id);
    setError("");

    if (item.attachment_path) {
      const { error: imageDeleteError } = await supabase.storage.from("chat-images").remove([item.attachment_path]);
      if (imageDeleteError) {
        setError(l("Imaginea nu a putut fi ștearsă. Mesajul a fost păstrat.", "The image could not be deleted. The message was kept."));
        setDeletingMessageId(null);
        return;
      }
    }

    const { error: deleteError } = await supabase.rpc("delete_private_message", {
      target_message_id: item.id,
    });
    if (deleteError) {
      setError(l("Mesajul nu a putut fi șters complet. Încearcă din nou.", "The message could not be fully deleted. Try again."));
      setDeletingMessageId(null);
      return;
    }

    setMessages((current) => current.map((message) => message.id === item.id ? {
      ...message,
      body: null,
      attachment_path: null,
      attachment_name: null,
      attachment_type: null,
      attachment_size: null,
      reply_to_id: null,
      pinned_at: null,
      pinned_by: null,
      deleted_at: new Date().toISOString(),
      deleted_by: session.user.id,
    } : message));
    setReactions((current) => current.filter((reaction) => reaction.message_id !== item.id));
    if (replyTo?.id === item.id) setReplyTo(null);
    if (item.attachment_path) {
      setImageUrls((current) => {
        const next = { ...current };
        delete next[item.attachment_path];
        return next;
      });
    }
    setDeletingMessageId(null);
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
    if (!selectedCommunity || communityBusy || !window.confirm(member.is_admin ? l(`Retragi rolul de administrator pentru ${member.email}?`, `Remove administrator access from ${member.email}?`) : l(`Acordezi rolul de administrator lui ${member.email}?`, `Grant administrator access to ${member.email}?`))) return;
    setCommunityBusy(true); setCommunityError("");
    const { error: adminError } = await supabase.rpc("set_community_admin", {
      target_community_id: selectedCommunity.id,target_user_id: member.user_id,make_admin: !member.is_admin,
    });
    if (adminError) setCommunityError(adminError.message); else await loadCommunityMembers();
    setCommunityBusy(false);
  }

  async function removeCommunityMember(member) {
    if (!selectedCommunity || communityBusy || !window.confirm(l(`Elimini ${member.email} din comunitate și din grupurile ei?`, `Remove ${member.email} from the community and its groups?`))) return;
    setCommunityBusy(true); setCommunityError("");
    const { error: removeError } = await supabase.rpc("remove_community_member", {
      target_community_id: selectedCommunity.id,target_user_id: member.user_id,
    });
    if (removeError) setCommunityError(removeError.message);
    else await Promise.all([loadCommunityMembers(),loadCommunities(selectedCommunity.id),loadRooms()]);
    setCommunityBusy(false);
  }

  async function deleteCommunity() {
    if (!selectedCommunity || communityBusy || !window.confirm(l("Ștergi comunitatea? Aceasta trebuie să nu mai conțină grupuri.", "Delete this community? It must contain no groups."))) return;
    setCommunityBusy(true); setCommunityError("");
    const { error: deleteError } = await supabase.rpc("delete_community", { target_community_id: selectedCommunity.id });
    if (deleteError) { setCommunityError(deleteError.message); setCommunityBusy(false); return; }
    setCommunitySettingsOpen(false); setSelectedCommunityId("all"); await loadCommunities(); setCommunityBusy(false);
  }

  async function openSettings() {
    setSettingsOpen(true);
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.ready
        .then((registration) => registration.pushManager.getSubscription())
        .then((subscription) => setPushEnabled(Boolean(subscription)))
        .catch(() => setPushEnabled(false));
    }
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
    const { data: preference, error: preferenceError } = await supabase
      .from("notification_preferences")
      .select("notifications_enabled, sound_enabled, mentions_only, muted_until")
      .eq("conversation_id", roomId)
      .maybeSingle();
    if (preferenceError) setSettingsError(preferenceError.message);
    else {
      setNotificationsEnabled(preference?.notifications_enabled ?? true);
      setSoundEnabled(preference?.sound_enabled ?? true);
      setMentionsOnly(preference?.mentions_only ?? false);
      setMutedUntil(preference?.muted_until || "");
    }
  }

  async function saveNotificationPreferences(e) {
    e?.preventDefault();
    if (!roomId || notificationBusy) return;
    setNotificationBusy(true);
    setSettingsError("");
    const { error: saveError } = await supabase.from("notification_preferences").upsert({
      user_id: session.user.id,
      conversation_id: roomId,
      notifications_enabled: notificationsEnabled,
      sound_enabled: soundEnabled,
      mentions_only: mentionsOnly,
      muted_until: mutedUntil || null,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id,conversation_id" });
    if (saveError) setSettingsError(saveError.message);
    setNotificationBusy(false);
  }

  async function enablePushNotifications() {
    if (notificationBusy) return;
    setNotificationBusy(true);
    setSettingsError("");
    try {
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
        throw new Error(l("Acest browser nu acceptă notificări push.", "This browser does not support push notifications."));
      }
      const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!publicKey) throw new Error(l("Cheia publică pentru notificări nu este configurată.", "The public notification key is not configured."));
      const permission = await Notification.requestPermission();
      if (permission !== "granted") throw new Error(l("Notificările nu au fost permise.", "Notification permission was not granted."));

      const registration = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey),
        });
      }
      const response = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify(subscription.toJSON()),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || l("Abonarea nu a reușit.", "Subscription failed."));
      setPushEnabled(true);
    } catch (pushError) {
      setPushEnabled(false);
      setSettingsError(pushError.message || l("Notificările nu au putut fi activate.", "Notifications could not be enabled."));
    }
    setNotificationBusy(false);
  }

  async function unlockConversation(e) {
    e.preventDefault();
    if (!roomPassword || passwordBusy) return;
    setPasswordBusy(true); setPasswordError("");
    const { data, error: verifyError } = await supabase.rpc("verify_conversation_password", {
      target_conversation_id: roomId, supplied_password: roomPassword,
    });
    if (verifyError) setPasswordError(verifyError.message);
    else if (!data) setPasswordError(l("Parola grupului este greșită.", "The group password is incorrect."));
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
    if (settingsBusy || !window.confirm(l(`Elimini ${member.email} din conversație?`, `Remove ${member.email} from the conversation?`))) return;
    setSettingsBusy(true); setSettingsError("");
    const { error: removeError } = await supabase.rpc("remove_conversation_member", {
      target_conversation_id: roomId, target_user_id: member.user_id,
    });
    if (removeError) setSettingsError(removeError.message);
    else await Promise.all([loadMembers(), loadRooms(roomId)]);
    setSettingsBusy(false);
  }

  async function toggleAdmin(member) {
    if (settingsBusy || !window.confirm(member.is_admin ? l(`Retragi rolul de administrator pentru ${member.email}?`, `Remove administrator access from ${member.email}?`) : l(`Acordezi rolul de administrator lui ${member.email}?`, `Grant administrator access to ${member.email}?`))) return;
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
    if (settingsBusy || !window.confirm(l("Elimini parola suplimentară a grupului?", "Remove the group's additional password?"))) return;
    setSettingsBusy(true); setSettingsError("");
    const { error: passwordRemoveError } = await supabase.rpc("set_conversation_password", {
      target_conversation_id: roomId, new_password: "",
    });
    if (passwordRemoveError) setSettingsError(passwordRemoveError.message);
    else { setGroupPassword(""); setPasswordProtected(false); }
    setSettingsBusy(false);
  }

  async function leaveConversation() {
    if (settingsBusy || !window.confirm(l("Părăsești această conversație? Nu vei mai vedea mesajele sau imaginile.", "Leave this conversation? You will no longer see its messages or images."))) return;
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
    if (settingsBusy || !window.confirm(l("Ștergi definitiv conversația, mesajele și imaginile? Această acțiune nu poate fi anulată.", "Permanently delete the conversation, messages, and images? This action cannot be undone."))) return;
    setSettingsBusy(true); setSettingsError("");
    await removeStoredImages(roomId);
    const { error: deleteError } = await supabase.rpc("delete_private_conversation", {
      target_conversation_id: roomId,
    });
    if (deleteError) { setSettingsError(deleteError.message); setSettingsBusy(false); return; }
    setSettingsOpen(false); setRoomId(null); await loadRooms(); setSettingsBusy(false);
  }

  return <main className="app">
    <aside id="group-menu" className={`side ${mobileMenuOpen ? "open" : ""}`}>
      <div className="brandRow"><div><p className="eyebrow">eClinTalk</p><h2>{t("myConversations")}</h2></div><div className="brandActions"><button className="mobileCloseBtn" onClick={() => setMobileMenuOpen(false)} aria-label={l("Închide meniul", "Close menu")}>×</button></div></div>
      <div className="communityNav">
        <button className={selectedCommunityId === "all" ? "selected" : ""} onClick={() => chooseCommunity("all")}>▦ {t("allConversations")}</button>
        {communities.length > 0 && <div className="communityNavTitle"><strong>{t("communities")}</strong>{isGeneralAdmin && <button title={l("Comunitate nouă", "New community")} onClick={() => setCommunityModal(true)}>＋</button>}</div>}
        {communities.map((item) => <button key={item.id} className={selectedCommunityId === item.id ? "selected" : ""} onClick={() => chooseCommunity(item.id)}>
          <span>◉</span><div><strong>{item.name}</strong><small>{item.group_count} {l("grupuri", "groups")} · {item.member_count} {t("members")}</small></div>
        </button>)}
        {rooms.some((item) => !item.community_id) && <button className={selectedCommunityId === "private" ? "selected" : ""} onClick={() => chooseCommunity("private")}>◇ {t("otherGroups")}</button>}
      </div>
      {selectedCommunity?.my_is_admin && <button className="manageCommunityBtn" onClick={openCommunitySettings}>⚙ {l("Setările comunității", "Community settings")}</button>}
      {canCreateGroup && <button className="primary newBtn" onClick={() => setModal(true)}>{t("newGroup")}</button>}
      <div className="conversationList">
        {loading && <p className="status">{t("loading")}</p>}
        {!loading && visibleRooms.length === 0 && <p className="emptySide">{l("Nu ai conversații în această secțiune.", "You have no conversations in this section.")}</p>}
        {visibleRooms.map((item) => <button className={`conv ${item.id === roomId ? "active" : ""}`} key={item.id} onClick={() => chooseRoom(item.id)}>
          <span>{item.title.slice(0, 2).toUpperCase()}</span><div><strong>{item.is_pinned && "📌 "}{item.title}</strong><small>{item.member_count} {t("members")} · {item.community_name || t("groupWithoutCommunity")}</small></div>
          {!item.password_protected && item.unread_count > 0 && <i className="unreadBadge">{item.unread_count > 99 ? "99+" : item.unread_count}</i>}
        </button>)}
      </div>
      <div className="sideFooter"><button className="profileBtn" onClick={openProfile}><strong>{profileName || session.user.email}</strong><small>{t("profile")} · {isGeneralAdmin ? t("generalAdmin") : t("connected")}</small></button><button className="logoutBtn" onClick={signOut} title={t("logout")}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 5H5v14h5M14 8l4 4-4 4M8 12h10" /></svg><span>{t("logout")}</span></button><p className="poweredBy sideCredit">{t("createdBy")}</p></div>
    </aside>
    {mobileMenuOpen && <button className="sideBackdrop" onClick={() => setMobileMenuOpen(false)} aria-label={l("Închide meniul", "Close menu")} />}
    <section className={`chat ${room ? "" : "chatEmpty"}`}>
      {room ? <><header><button className="mobileMenuBtn" onClick={() => setMobileMenuOpen(true)} aria-controls="group-menu" aria-expanded={mobileMenuOpen}>☰</button><div className="headerMain"><strong>{room.title}</strong><small>{room.member_count} {t("members")} · {room.community_name || t("groupWithoutCommunity")} · {l("numai membrii au acces", "members only")}</small></div><div className="headerActions"><b>● {l("Privat", "Private")}</b><button onClick={toggleGroupPin}>{room.is_pinned ? t("pinned") : t("pin")}</button><button onClick={openSettings}>{t("settings")}</button></div></header>
        <div className="warning">{t("testWarning")}</div>
        <div className="msgs">
          {pinnedMessages.length > 0 && <div className="pinnedArea">
            <button className="pinnedBanner" onClick={() => pinnedMessages.length === 1 ? scrollToMessage(pinnedMessages[0].id) : setPinnedOpen(!pinnedOpen)}>
              <span className="largePin">📌</span><span>{pinnedMessages.length} {pinnedMessages.length === 1 ? l("mesaj fixat", "pinned message") : l("mesaje fixate", "pinned messages")}</span><span className="pinChevron">{pinnedMessages.length > 1 ? (pinnedOpen ? "▲" : "▼") : "›"}</span>
            </button>
            {pinnedOpen && pinnedMessages.length > 1 && <div className="pinnedList">
              {pinnedMessages.map((item, index) => <button key={item.id} onClick={() => scrollToMessage(item.id)}>
                <span>📌</span><div><strong>{l("Mesaj fixat", "Pinned message")} {index + 1}</strong><small>{item.body || (item.attachment_path ? l("📷 Imagine", "📷 Image") : item.attachment_name || l("Mesaj", "Message"))}</small></div>
              </button>)}
            </div>}
          </div>}
          {messages.length === 0 && !error && <p className="status">{l("Trimite primul mesaj.", "Send the first message.")}</p>}
          {messages.map((item) => { const mine = item.user_id === session.user.id; const replied = messages.find((x) => x.id === item.reply_to_id); const itemReactions = groupedReactions(item.id); return <div ref={(node) => { messageRefs.current[item.id] = node; }} key={item.id} className={`messageWrap ${mine ? "mine" : ""}`}>
            <div className={`bubble ${mine ? "mine" : ""} ${item.attachment_path ? "hasImage" : ""} ${item.pinned_at ? "pinnedMessage" : ""} ${item.deleted_at ? "deletedMessage" : ""}`}>
              {item.deleted_at ? <p className="deletedText">{l("Mesaj șters", "Deleted message")}</p> : <>
                {!mine && <strong className="sender">{displayNameForUser(item.user_id, item.sender_email)}</strong>}
                {item.pinned_at && <span className="pinMark">📌</span>}
                {item.reply_to_id && <button className="replyQuote" onClick={() => scrollToMessage(item.reply_to_id)}>
                  <strong>{replied ? displayNameForUser(replied.user_id, replied.sender_email) : l("Mesaj anterior", "Previous message")}</strong><span>{replied?.deleted_at ? l("Mesaj șters", "Deleted message") : replied?.body || (replied?.attachment_path ? l("📷 Imagine", "📷 Image") : l("Mesaj indisponibil", "Message unavailable"))}</span>
                  {!replied?.deleted_at && replied?.attachment_path && imageUrls[replied.attachment_path] && <img src={imageUrls[replied.attachment_path]} alt={l("Imagine citată", "Quoted image")} />}
                </button>}
                {item.attachment_path && imageUrls[item.attachment_path] && <a href={imageUrls[item.attachment_path]} target="_blank" rel="noreferrer"><img className="chatImage" src={imageUrls[item.attachment_path]} alt={item.attachment_name || l("Imagine atașată", "Attached image")} /></a>}
                {item.attachment_path && !imageUrls[item.attachment_path] && <p className="imageLoading">{l("Se încarcă imaginea...", "Loading image...")}</p>}
                {item.body && <p><LinkifiedText text={item.body} /></p>}
              </>}<small>{time(item.created_at, language)}</small>
            </div>
            {!item.deleted_at && <div className="messageActions"><button onClick={() => setReplyTo(item)}><span>↩</span> {l("Răspunde", "Reply")}</button><button onClick={() => setReactionTarget(reactionTarget === item.id ? null : item.id)}><span>☺</span> {l("Reacție", "React")}</button>
              {room.my_is_admin && <button onClick={() => toggleMessagePin(item.id)}><span>📌</span> {item.pinned_at ? l("Anulează pin", "Unpin") : "Pin"}</button>}
              {(mine || room.my_is_admin) && <button className="deleteMessageBtn" disabled={deletingMessageId === item.id} onClick={() => deleteMessage(item)}><span>🗑</span> {deletingMessageId === item.id ? l("Se șterge...", "Deleting...") : l("Șterge", "Delete")}</button>}</div>}
            {!item.deleted_at && reactionTarget === item.id && <div className="reactionPicker">{REACTION_EMOJIS.map((emoji) => <button key={emoji} onClick={() => reactToMessage(item.id, emoji)}>{emoji}</button>)}</div>}
            {!item.deleted_at && Object.keys(itemReactions).length > 0 && <div className="reactionSummary">{Object.entries(itemReactions).map(([emoji, info]) => <button className={info.mine ? "mine" : ""} key={emoji} onClick={() => reactToMessage(item.id, emoji)}>{emoji} {info.count}</button>)}</div>}
          </div>; })}<div ref={bottom} />
        </div>
        <div>{error && <p className="chatError">{error}</p>}<form className="composer" onSubmit={send}>
	          {replyTo && <div className="selectedReply"><div><strong>{l("Răspuns către", "Reply to")} {displayNameForUser(replyTo.user_id, replyTo.sender_email)}</strong><span>{replyTo.body || (replyTo.attachment_path ? l("📷 Imagine", "📷 Image") : l("Mesaj", "Message"))}</span></div>{replyTo.attachment_path && imageUrls[replyTo.attachment_path] && <img src={imageUrls[replyTo.attachment_path]} alt={l("Imagine selectată pentru răspuns", "Image selected for reply")} />}<button type="button" onClick={() => setReplyTo(null)}>×</button></div>}
          <input ref={fileInput} className="fileInput" type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" onChange={chooseFile} />
          <button className="attachBtn" type="button" onClick={() => fileInput.current?.click()} disabled={sending} title={l("Atașează imagine", "Attach image")} aria-label={l("Atașează imagine", "Attach image")}>📎</button>
          <button className="emojiBtn" type="button" onClick={() => setEmojiOpen(!emojiOpen)} disabled={sending} title={l("Emoticoane", "Emoji")} aria-label={l("Emoticoane", "Emoji")}>☺</button>
	          <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={t("messagePlaceholder")} maxLength={4000} disabled={sending} autoComplete="off" />
	          <button className="primary" disabled={sending || (!draft.trim() && !attachment)}>{sending ? t("sending") : t("send")}</button>
	          {mentionMatch && <div className="mentionPicker" role="listbox" aria-label={t("mentionHint")}>
	            {mentionSuggestions.length ? mentionSuggestions.map((member) => <button type="button" key={member.user_id} onClick={() => insertMention(member)}><span className="mentionAvatar">{(member.display_name || member.email).slice(0, 2).toUpperCase()}</span><span><strong>{member.display_name || member.email.split("@")[0]}</strong><small>{member.email}</small></span></button>) : <p>{language === "en" ? "No matching member" : "Niciun membru găsit"}</p>}
	          </div>}
          {emojiOpen && <div className="emojiPicker">{QUICK_EMOJIS.map((emoji) => <button type="button" key={emoji} onClick={() => insertEmoji(emoji)}>{emoji}</button>)}</div>}
          {attachment && <div className="selectedFile"><span>{attachment.name}</span><button type="button" onClick={() => { setAttachment(null); if (fileInput.current) fileInput.current.value = ""; }}>×</button></div>}
        </form></div></> :
	        <><div className="mobileWelcomeBar"><button className="mobileMenuBtn" onClick={() => setMobileMenuOpen(true)} aria-controls="group-menu" aria-expanded={mobileMenuOpen}>☰ <span>{t("myConversations")}</span></button></div><div className="welcome conversationHome"><div className="logo">eC</div><h2>{selectedCommunity?.name || t("yourConversations")}</h2><p>{visibleRooms.length ? t("chooseConversation") : t("noConversations")}</p>
	          {visibleRooms.length > 0 && <div className="homeConversationList">{visibleRooms.map((item) => <button key={item.id} onClick={() => chooseRoom(item.id)}><span>{item.title.slice(0,2).toUpperCase()}</span><div><strong>{item.is_pinned && "📌 "}{item.title}</strong><small>{item.member_count} {t("members")} · {item.community_name || t("groupWithoutCommunity")}</small></div>{!item.password_protected && item.unread_count > 0 && <i className="unreadBadge">{item.unread_count > 99 ? "99+" : item.unread_count}</i>}</button>)}</div>}
	          {!visibleRooms.length && canCreateGroup && <button className="primary" onClick={() => setModal(true)}>{t("firstGroup")}</button>}{error && <p className="chatError">{error}</p>}</div></>}
    </section>
    {modal && <NewConversation language={language} close={() => setModal(false)} communities={communities} selectedCommunityId={selectedCommunityId} isGeneralAdmin={isGeneralAdmin} created={(id) => { setModal(false); loadRooms(id); loadCommunities(); }} />}
    {communityModal && <NewCommunity language={language} close={() => setCommunityModal(false)} created={(id) => { setCommunityModal(false); loadCommunities(id); }} />}
    {settingsOpen && room && <div className="modalBackdrop" onMouseDown={() => !settingsBusy && setSettingsOpen(false)}><section className="modal manageModal" onMouseDown={(e) => e.stopPropagation()}>
      <div className="modalTitle"><div><p className="eyebrow">{l("Grup privat", "Private group")}</p><h2>{l("Setări", "Settings")}</h2></div><button className="iconBtn" disabled={settingsBusy} onClick={() => setSettingsOpen(false)}>×</button></div>
      {isAdmin && <form className="manageSection" onSubmit={renameConversation}>
        <label>{l("Numele grupului", "Group name")}<div className="inlineForm"><input required maxLength={80} value={settingsTitle} onChange={(e) => setSettingsTitle(e.target.value)} /><button className="primary" disabled={settingsBusy || !settingsTitle.trim()}>{t("save")}</button></div></label>
      </form>}
      <form className="manageSection" onSubmit={saveNotificationPreferences}>
        <div className="sectionHeading"><strong>{l("Notificări", "Notifications")}</strong><small>{l("Numai pentru contul tău", "Only for your account")}</small></div>
        <label className="checkLabel"><input type="checkbox" checked={notificationsEnabled} onChange={(e) => setNotificationsEnabled(e.target.checked)} />{l("Primește notificări pentru acest grup", "Receive notifications for this group")}</label>
        <label className="checkLabel"><input type="checkbox" checked={soundEnabled} disabled={!notificationsEnabled} onChange={(e) => setSoundEnabled(e.target.checked)} />{l("Sunet pentru mesajele noi", "Sound for new messages")}</label>
        <label className="checkLabel"><input type="checkbox" checked={mentionsOnly} disabled={!notificationsEnabled} onChange={(e) => setMentionsOnly(e.target.checked)} />{l("Notifică-mă numai când sunt menționat", "Notify me only when mentioned")}</label>
        <div className="memberActions notificationActions">
          <button type="button" onClick={() => setMutedUntil(new Date(Date.now() + 60 * 60 * 1000).toISOString())}>{l("Silențios 1 oră", "Mute for 1 hour")}</button>
          <button type="button" onClick={() => setMutedUntil(new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString())}>{l("Silențios 8 ore", "Mute for 8 hours")}</button>
	          <button type="button" onClick={() => setMutedUntil("")}>{t("resumeNotifications")}</button>
        </div>
        <p className="helper">
          {mutedUntil && new Date(mutedUntil) > new Date()
            ? l(`Notificări oprite până la ${new Date(mutedUntil).toLocaleString("ro-RO")}`, `Notifications muted until ${new Date(mutedUntil).toLocaleString("en-GB")}`)
            : l("Notificările nu sunt suspendate temporar.", "Notifications are not temporarily muted.")}
        </p>
        <button type="button" onClick={enablePushNotifications} disabled={notificationBusy}>
          {pushEnabled ? l("✓ Notificări push active pe acest dispozitiv", "✓ Push notifications active on this device") : l("Activează notificările pe acest dispozitiv", "Enable notifications on this device")}
        </button>
        <p className="helper">{l("Pe iPhone: deschide pagina din pictograma adăugată pe ecranul principal, apoi activează notificările aici.", "On iPhone: open the app from the Home Screen icon, then enable notifications here.")}</p>
        <button className="primary" disabled={notificationBusy}>{notificationBusy ? l("Se salvează...", "Saving...") : l("Salvează notificările", "Save notifications")}</button>
      </form>
      <div className="manageSection"><div className="sectionHeading"><strong>{l("Membri", "Members")}</strong><small>{members.length}</small></div>
        <div className="memberList">{members.map((member) => <div className="memberRow" key={member.user_id}><div><strong>{member.display_name || member.email}</strong><small>{member.email} · {member.is_owner ? l("Proprietar · Administrator", "Owner · Administrator") : member.is_admin ? "Administrator" : l("Membru", "Member")}</small></div>
          <div className="memberActions">{isOwner && !member.is_owner && <button disabled={settingsBusy} onClick={() => toggleAdmin(member)}>{member.is_admin ? l("Retrage admin", "Remove admin") : l("Fă admin", "Make admin")}</button>}
          {isAdmin && !member.is_owner && (isOwner || !member.is_admin) && <button disabled={settingsBusy} onClick={() => removeMember(member)}>{l("Elimină", "Remove")}</button>}</div></div>)}</div>
      </div>
      {isAdmin && <form className="manageSection" onSubmit={addMembers}>
        <label>{l("Adaugă membri", "Add members")}<textarea rows={2} placeholder="user@example.com" value={newMemberEmails} onChange={(e) => setNewMemberEmails(e.target.value)} /></label>
        <p className="helper">{l("Persoanele trebuie să aibă deja cont. Poți separa adresele prin virgulă.", "People must already have an account. Separate addresses with commas.")}</p>
        <button className="primary" disabled={settingsBusy || !newMemberEmails.trim()}>{l("Adaugă", "Add")}</button>
      </form>}
      {isAdmin && <form className="manageSection" onSubmit={saveGroupPassword}>
        <div className="sectionHeading"><strong>{l("Parolă suplimentară", "Additional password")}</strong><small>{passwordProtected ? l("Activă", "Active") : l("Inactivă", "Inactive")}</small></div>
        <label>{passwordProtected ? l("Schimbă parola grupului", "Change group password") : l("Protejează grupul cu parolă", "Protect group with password")}<input type="password" minLength={6} maxLength={64} placeholder={l("Minimum 6 caractere", "Minimum 6 characters")} value={groupPassword} onChange={(e) => setGroupPassword(e.target.value)} /></label>
        <p className="helper">{l("Va fi cerută membrilor la fiecare deschidere a grupului. Parola nu este afișată și nu este stocată în clar.", "Members will be asked for it every time they open the group. The password is never displayed or stored in plain text.")}</p>
        <div className="passwordActions"><button className="primary" disabled={settingsBusy || groupPassword.length < 6}>{passwordProtected ? l("Schimbă parola", "Change password") : l("Activează parola", "Enable password")}</button>
          {passwordProtected && <button type="button" disabled={settingsBusy} onClick={removeGroupPassword}>{l("Elimină parola", "Remove password")}</button>}</div>
      </form>}
      {settingsError && <p className="error manageError">{settingsError}</p>}
      <div className="dangerZone">{isOwner ? <button className="dangerBtn" disabled={settingsBusy} onClick={deleteConversation}>{l("Șterge conversația", "Delete conversation")}</button> : <button className="dangerBtn" disabled={settingsBusy} onClick={leaveConversation}>{l("Părăsește conversația", "Leave conversation")}</button>}</div>
    </section></div>}
    {communitySettingsOpen && selectedCommunity && <div className="modalBackdrop" onMouseDown={() => !communityBusy && setCommunitySettingsOpen(false)}><section className="modal manageModal" onMouseDown={(e) => e.stopPropagation()}>
      <div className="modalTitle"><div><p className="eyebrow">{l("Comunitate", "Community")}</p><h2>{l("Setări", "Settings")}</h2></div><button className="iconBtn" disabled={communityBusy} onClick={() => setCommunitySettingsOpen(false)} aria-label={l("Închide", "Close")}>×</button></div>
      <form className="manageSection" onSubmit={saveCommunity}>
        <label>{l("Numele comunității", "Community name")}<input required maxLength={80} value={communityName} onChange={(e) => setCommunityName(e.target.value)} /></label>
        <label>{l("Descriere", "Description")}<textarea rows={2} maxLength={500} value={communityDescription} onChange={(e) => setCommunityDescription(e.target.value)} /></label>
        <button className="primary" disabled={communityBusy || !communityName.trim()}>{t("save")}</button>
      </form>
      <div className="manageSection"><div className="sectionHeading"><strong>{l("Membrii comunității", "Community members")}</strong><small>{communityMembers.length}</small></div>
        <div className="memberList">{communityMembers.map((member) => <div className="memberRow" key={member.user_id}><div><strong>{member.display_name || member.email}</strong><small>{member.email} · {member.is_admin ? l("Administrator de comunitate", "Community administrator") : l("Membru", "Member")}</small></div>
          <div className="memberActions">{isGeneralAdmin && member.user_id !== session.user.id && <button disabled={communityBusy} onClick={() => toggleCommunityAdmin(member)}>{member.is_admin ? l("Retrage admin", "Remove admin") : l("Fă admin", "Make admin")}</button>}
          {member.user_id !== session.user.id && (!member.is_admin || isGeneralAdmin) && <button disabled={communityBusy} onClick={() => removeCommunityMember(member)}>{l("Elimină", "Remove")}</button>}</div>
        </div>)}</div>
      </div>
      <form className="manageSection" onSubmit={addCommunityMembers}>
        <label>{l("Adaugă membri", "Add members")}<textarea rows={2} placeholder="user@example.com" value={communityMemberEmails} onChange={(e) => setCommunityMemberEmails(e.target.value)} /></label>
        <p className="helper">{l("Persoanele trebuie să aibă deja cont. Adresele pot fi separate prin virgulă.", "People must already have an account. Separate addresses with commas.")}</p>
        <button className="primary" disabled={communityBusy || !communityMemberEmails.trim()}>{l("Adaugă în comunitate", "Add to community")}</button>
      </form>
      {communityError && <p className="error manageError">{communityError}</p>}
      {isGeneralAdmin && <div className="dangerZone"><button className="dangerBtn" disabled={communityBusy} onClick={deleteCommunity}>{l("Șterge comunitatea", "Delete community")}</button></div>}
    </section></div>}
    {profileOpen && <div className="modalBackdrop" onMouseDown={() => !profileBusy && setProfileOpen(false)}><section className="modal profileModal" onMouseDown={(e) => e.stopPropagation()}>
      <div className="modalTitle"><div><p className="eyebrow">eClinTalk</p><h2>{t("accountSettings")}</h2></div><button className="iconBtn" disabled={profileBusy} onClick={() => setProfileOpen(false)}>×</button></div>
      <form className="form" onSubmit={saveProfile}>
        <label>{t("displayName")}<input required minLength={2} maxLength={80} value={profileName} onChange={(e) => setProfileName(e.target.value)} /></label>
        <label>{t("email")}<input value={session.user.email || ""} disabled /></label>
        <label>{t("language")}<select value={language} onChange={(e) => setLanguage(e.target.value)}><option value="ro">Română</option><option value="en">English</option></select></label>
        {profileError && <p className="error">{profileError}</p>}
        <div className="modalActions"><button type="button" disabled={profileBusy} onClick={() => setProfileOpen(false)}>{t("cancel")}</button><button className="primary" disabled={profileBusy || profileName.trim().length < 2}>{profileBusy ? t("processing") : t("save")}</button></div>
      </form>
    </section></div>}
    {passwordOpen && room && <div className="modalBackdrop"><section className="modal passwordModal">
      <div className="lockMark">🔒</div><p className="eyebrow">{l("Grup protejat", "Protected group")}</p><h2>{room.title}</h2>
      <p className="muted">{l("Introdu parola suplimentară pentru a deschide conversația.", "Enter the additional password to open this conversation.")}</p>
      <form className="form" onSubmit={unlockConversation}><label>{l("Parola grupului", "Group password")}<input autoFocus type="password" value={roomPassword} onChange={(e) => setRoomPassword(e.target.value)} /></label>
        {passwordError && <p className="error">{passwordError}</p>}
        <div className="modalActions"><button type="button" disabled={passwordBusy} onClick={cancelPassword}>{t("cancel")}</button><button className="primary" disabled={passwordBusy || !roomPassword}>{passwordBusy ? l("Se verifică...", "Checking...") : l("Deschide grupul", "Open group")}</button></div>
      </form>
    </section></div>}
    {logoutWarning && <div className="modalBackdrop"><section className="modal timeoutModal">
      <p className="eyebrow">{l("Sesiune inactivă", "Inactive session")}</p><h2>{l(`Vei fi delogat în ${logoutCountdown} secunde`, `You will be signed out in ${logoutCountdown} seconds`)}</h2>
      <p className="muted">{l("Pentru protejarea contului, sesiunea se închide automat după 15 minute fără activitate.", "To protect your account, the session closes automatically after 15 minutes of inactivity.")}</p>
      <div className="modalActions"><button onClick={signOut}>{l("Ieșire acum", "Sign out now")}</button><button className="primary" onClick={() => window.dispatchEvent(new Event("pointerdown"))}>{l("Rămân conectat", "Stay signed in")}</button></div>
    </section></div>}
  </main>;
}

export default function Home() {
  const [session, setSession] = useState(null);
  const [checking, setChecking] = useState(true);
  const [passwordRecovery, setPasswordRecovery] = useState(false);
  const [language, setLanguageState] = useState("ro");
  function setLanguage(nextLanguage) {
    const safeLanguage = nextLanguage === "en" ? "en" : "ro";
    setLanguageState(safeLanguage);
    if (typeof window !== "undefined") window.localStorage.setItem("eclintalk-language", safeLanguage);
    if (typeof document !== "undefined") document.documentElement.lang = safeLanguage;
  }
  useEffect(() => {
    const storedLanguage = window.localStorage.getItem("eclintalk-language");
    setLanguage(storedLanguage || (navigator.language?.toLowerCase().startsWith("en") ? "en" : "ro"));
    if (new URLSearchParams(window.location.search).get("recovery") === "1") {
      setPasswordRecovery(true);
    }
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setChecking(false); });
    const { data } = supabase.auth.onAuthStateChange((event, next) => {
      if (event === "PASSWORD_RECOVERY") setPasswordRecovery(true);
      setSession(next);
      setChecking(false);
    });
    return () => data.subscription.unsubscribe();
  }, []);
  if (checking) return <main className="center">{language === "en" ? "Checking session..." : "Se verifică sesiunea..."}</main>;
  if (passwordRecovery && session) return <UpdatePassword language={language} completed={() => {
    window.history.replaceState({}, "", "/");
    setPasswordRecovery(false);
  }} />;
  return session ? <Chat session={session} language={language} setLanguage={setLanguage} /> : <Login language={language} setLanguage={setLanguage} />;
}
