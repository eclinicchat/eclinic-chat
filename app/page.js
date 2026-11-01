"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { EXTRA_TRANSLATIONS } from "./i18n-extra";

const LANGUAGE_LOCALES = { ro: "ro-RO", en: "en-GB", fr: "fr-FR", es: "es-ES" };
const SUPPORTED_LANGUAGES = Object.keys(LANGUAGE_LOCALES);
const time = (value, language = "ro") => new Date(value).toLocaleTimeString(LANGUAGE_LOCALES[language] || LANGUAGE_LOCALES.ro, { hour: "2-digit", minute: "2-digit" });
const linksFromText = (value = "") => (value.match(/https?:\/\/[^\s<>"']+/gi) || []).map((url) => url.replace(/[),.;!?]+$/, ""));
const localize = (language, ro, en, fr, es) => {
  if (language === "ro") return ro;
  if (language === "fr") return fr || EXTRA_TRANSLATIONS.fr?.[en] || en;
  if (language === "es") return es || EXTRA_TRANSLATIONS.es?.[en] || en;
  return en;
};
const INACTIVITY_MS = 15 * 60 * 1000;
const WARNING_MS = 60 * 1000;
const EMOJI_CATEGORIES = [
  { id: "faces", ro: "Expresii", en: "Faces", fr: "Expressions", es: "Caras", icon: "😊", items: ["😀","😃","😄","😁","😂","🤣","😊","😇","🙂","🙃","😉","😍","🥰","😘","😎","🤩","🤔","🫡","🙄","😮","😢","😭","😡","🤗","😴","🥳"] },
  { id: "gestures", ro: "Gesturi", en: "Gestures", fr: "Gestes", es: "Gestos", icon: "👍", items: ["👍","👎","👏","🙌","🙏","🤝","💪","👌","✌️","🤞","🫶","👋","☝️","💬","👀","🧠"] },
  { id: "symbols", ro: "Simboluri", en: "Symbols", fr: "Symboles", es: "Símbolos", icon: "❤️", items: ["❤️","💙","💚","🧡","💜","🤍","🔥","✨","🎉","✅","❌","⚠️","📌","💡","💯","⭐","❗","❓"] },
  { id: "medical", ro: "Medical", en: "Medical", fr: "Médical", es: "Médico", icon: "🩺", items: ["🩺","🏥","🚑","💊","💉","🩻","🧬","🧪","🦠","🫀","🫁","🧠","🩹","📋","📷","🔬"] },
];
const REACTION_EMOJIS = ["👍", "❤️", "😂", "🤣", "😮", "😢", "👏", "🙏", "🔥", "✅", "👀", "💯"];
const ALL_REACTION_EMOJIS = [...new Set(EMOJI_CATEGORIES.flatMap((category) => category.items))];

function Icon({ name, size = 18 }) {
  const paths = {
    search: <><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></>,
    settings: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1A1.7 1.7 0 0 0 9 4.6 1.7 1.7 0 0 0 10 3V2.8h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z"/></>,
    pin: <path d="m14 4 6 6-3 1-4 4-1 5-3-3-5 3 3-5 4-4 1-3Z"/>,
    reply: <><path d="m9 17-5-5 5-5"/><path d="M4 12h10a6 6 0 0 1 6 6"/></>,
    forward: <><path d="m15 7 5 5-5 5"/><path d="M20 12H10a6 6 0 0 0-6 6"/></>,
    info: <><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></>,
    zoom: <><circle cx="10" cy="10" r="6"/><path d="m15 15 5 5M10 7v6M7 10h6"/></>,
    smile: <><circle cx="12" cy="12" r="9"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><path d="M9 9h.01M15 9h.01"/></>,
    attachment: <path d="m20.5 11.5-8.9 8.9a6 6 0 0 1-8.5-8.5l9.4-9.4a4 4 0 0 1 5.7 5.7l-9.4 9.4a2 2 0 0 1-2.8-2.8l8.8-8.8"/>,
    send: <><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></>,
    trash: <><path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13"/><path d="M10 11v5M14 11v5"/></>,
    users: <><circle cx="9" cy="8" r="3"/><path d="M3 20v-2a5 5 0 0 1 5-5h2a5 5 0 0 1 5 5v2"/><path d="M16 4a3 3 0 0 1 0 6M17 13a5 5 0 0 1 4 5v2"/></>,
    image: <><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 20"/></>,
    file: <><path d="M6 2h8l4 4v16H6Z"/><path d="M14 2v5h5M9 12h6M9 16h6"/></>,
    link: <><path d="M10 13a5 5 0 0 0 7.5.5l2-2a5 5 0 0 0-7-7l-1.2 1.2"/><path d="M14 11a5 5 0 0 0-7.5-.5l-2 2a5 5 0 0 0 7 7l1.2-1.2"/></>,
    shield: <path d="M12 3 20 6v5c0 5-3.4 8.2-8 10-4.6-1.8-8-5-8-10V6Z"/>,
    lock: <><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></>,
    menu: <path d="M4 7h16M4 12h16M4 17h16"/>,
    share: <><circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="m8.2 10.8 7.6-4.4M8.2 13.2l7.6 4.4"/></>,
    copy: <><rect x="8" y="8" width="11" height="11" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/></>,
    chevronDown: <path d="m7 9 5 5 5-5"/>,
    close: <path d="m6 6 12 12M18 6 6 18"/>,
  };
  return <svg className="uiIcon" width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">{paths[name]}</svg>;
}

function dayLabel(value, language) {
  const date = new Date(value);
  const today = new Date();
  const yesterday = new Date(); yesterday.setDate(today.getDate()-1);
  if (date.toDateString() === today.toDateString()) return localize(language, "Astăzi", "Today", "Aujourd’hui", "Hoy");
  if (date.toDateString() === yesterday.toDateString()) return localize(language, "Ieri", "Yesterday", "Hier", "Ayer");
  return date.toLocaleDateString(LANGUAGE_LOCALES[language] || LANGUAGE_LOCALES.ro, { day:"numeric", month:"long", year: date.getFullYear() === today.getFullYear() ? undefined : "numeric" });
}

const UI = {
  ro: {
    secureSignIn: "Conectare securizată", privateHelp: "Conversațiile sunt vizibile numai membrilor adăugați.",
    email: "Email", password: "Parolă", enterApp: "Intră în aplicație", processing: "Se procesează...",
    forgot: "Ai uitat parola?", noAccount: "Nu ai cont? Creează unul", testWarning: "Versiune de test. Nu introduce date medicale sau personale reale.",
    myConversations: "Conversațiile mele", allConversations: "Toate conversațiile", otherGroups: "Grupuri fără comunitate",
    communities: "Comunitățile mele", newGroup: "+ Grup nou", settings: "⚙️ Setări", pin: "📌 Pin", pinned: "📌 Fixat",
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
    myConversations: "My conversations", allConversations: "All conversations", otherGroups: "Groups without a community",
    communities: "My communities", newGroup: "+ New group", settings: "⚙️ Settings", pin: "📌 Pin", pinned: "📌 Pinned",
    logout: "Sign out", connected: "Connected", generalAdmin: "General administrator", members: "members",
    yourConversations: "Your conversations", chooseConversation: "Choose a conversation to open it.",
    noConversations: "There are no conversations available yet.", firstGroup: "Create the first group",
    messagePlaceholder: "Write a message...", send: "Send", sending: "Sending...",
    resumeNotifications: "Resume notifications", profile: "Profile", displayName: "Display name", language: "Interface language",
    save: "Save", cancel: "Cancel", accountSettings: "Account settings", createdBy: "Created by eClinic Hub",
    mentionHint: "Mention a member", loading: "Loading...", groupWithoutCommunity: "no community",
  },
  fr: {
    secureSignIn: "Connexion sécurisée", privateHelp: "Les conversations ne sont visibles que par les membres ajoutés.",
    email: "E-mail", password: "Mot de passe", enterApp: "Ouvrir l’application", processing: "Traitement…",
    forgot: "Mot de passe oublié ?", noAccount: "Pas de compte ? Créer un compte", testWarning: "Version de test. Ne saisissez pas de données médicales ou personnelles réelles.",
    myConversations: "Mes conversations", allConversations: "Toutes les conversations", otherGroups: "Groupes sans communauté",
    communities: "Mes communautés", newGroup: "+ Nouveau groupe", settings: "⚙️ Paramètres", pin: "📌 Épingler", pinned: "📌 Épinglé",
    logout: "Déconnexion", connected: "Connecté", generalAdmin: "Administrateur général", members: "membres",
    yourConversations: "Vos conversations", chooseConversation: "Choisissez une conversation pour l’ouvrir.",
    noConversations: "Aucune conversation n’est encore disponible.", firstGroup: "Créer le premier groupe",
    messagePlaceholder: "Écrire un message…", send: "Envoyer", sending: "Envoi…",
    resumeNotifications: "Réactiver les notifications", profile: "Profil", displayName: "Nom affiché", language: "Langue de l’interface",
    save: "Enregistrer", cancel: "Annuler", accountSettings: "Paramètres du compte", createdBy: "Créé par eClinic Hub",
    mentionHint: "Mentionner un membre", loading: "Chargement…", groupWithoutCommunity: "sans communauté",
  },
  es: {
    secureSignIn: "Conexión segura", privateHelp: "Las conversaciones solo son visibles para los miembros añadidos.",
    email: "Correo electrónico", password: "Contraseña", enterApp: "Abrir aplicación", processing: "Procesando…",
    forgot: "¿Olvidaste la contraseña?", noAccount: "¿No tienes cuenta? Crear una", testWarning: "Versión de prueba. No introduzcas datos médicos ni personales reales.",
    myConversations: "Mis conversaciones", allConversations: "Todas las conversaciones", otherGroups: "Grupos sin comunidad",
    communities: "Mis comunidades", newGroup: "+ Nuevo grupo", settings: "⚙️ Ajustes", pin: "📌 Fijar", pinned: "📌 Fijado",
    logout: "Cerrar sesión", connected: "Conectado", generalAdmin: "Administrador general", members: "miembros",
    yourConversations: "Tus conversaciones", chooseConversation: "Elige una conversación para abrirla.",
    noConversations: "Todavía no hay conversaciones disponibles.", firstGroup: "Crear el primer grupo",
    messagePlaceholder: "Escribe un mensaje…", send: "Enviar", sending: "Enviando…",
    resumeNotifications: "Reanudar notificaciones", profile: "Perfil", displayName: "Nombre mostrado", language: "Idioma de la interfaz",
    save: "Guardar", cancel: "Cancelar", accountSettings: "Ajustes de la cuenta", createdBy: "Creado por eClinic Hub",
    mentionHint: "Mencionar a un miembro", loading: "Cargando…", groupWithoutCommunity: "sin comunidad",
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

async function requestPasswordManagerSave(email, password) {
  if (typeof window === "undefined" || !window.PasswordCredential || !navigator.credentials?.store) return;
  try {
    const credential = new window.PasswordCredential({
      id: email,
      name: email,
      password,
    });
    await navigator.credentials.store(credential);
  } catch {
    // Safari/iCloud Passwords and password managers without this API use the
    // semantic form attributes below and keep control of their own prompts.
  }
}

function Login({ language, setLanguage, inviteToken }) {
  const t = translator(language);
  const l = (ro, en, fr, es) => localize(language, ro, en, fr, es);
  const [signup, setSignup] = useState(false);
  const [forgotPassword, setForgotPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);
  const [invitePreview, setInvitePreview] = useState(null);

  useEffect(() => {
    if (!inviteToken) return;
    supabase.rpc("get_invitation_preview", { invitation_token: inviteToken }).then(({ data, error }) => {
      const preview = data?.[0];
      if (error || !preview?.is_valid) {
        setNotice({ error: true, text: l("Această invitație nu este validă sau a expirat.", "This invitation is invalid or has expired.", "Cette invitation n’est pas valide ou a expiré.", "Esta invitación no es válida o ha caducado.") });
        return;
      }
      setInvitePreview(preview);
      setEmail(preview.invitee_email || "");
      setSignup(true);
    });
  }, [inviteToken]);

  async function submit(e) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const submittedEmail = String(formData.get("email") || email).trim().toLowerCase();
    const submittedPassword = String(formData.get("password") || password);
    setBusy(true);
    setNotice(null);
    try {
      const result = signup
        ? await supabase.auth.signUp({
          email: submittedEmail,
          password: submittedPassword,
          options: inviteToken ? { emailRedirectTo: `${window.location.origin}/?invite=${encodeURIComponent(inviteToken)}` } : undefined,
        })
        : await supabase.auth.signInWithPassword({ email: submittedEmail, password: submittedPassword });
      if (result.error) setNotice({ error: true, text: result.error.message });
      else if (signup && !result.data.session) {
        setNotice({ text: l("Cont creat. Verifică emailul, apoi conectează-te.", "Account created. Check your email, then sign in.", "Compte créé. Consultez votre e-mail, puis connectez-vous.", "Cuenta creada. Revisa tu correo y después inicia sesión.") });
        setSignup(false);
      } else {
        await requestPasswordManagerSave(submittedEmail, submittedPassword);
      }
    } catch {
      setNotice({ error: true, text: l("Serviciul de autentificare nu poate fi contactat. Încearcă din nou.", "The authentication service could not be reached. Please try again.", "Le service d’authentification est inaccessible. Réessayez.", "No se pudo contactar con el servicio de autenticación. Inténtalo de nuevo.") });
    } finally {
      setBusy(false);
    }
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
    else setNotice({ text: l("Dacă adresa are un cont, vei primi un email pentru alegerea unei parole noi.", "If an account exists for this address, you will receive a password reset email.", "Si un compte existe pour cette adresse, vous recevrez un e-mail de réinitialisation.", "Si existe una cuenta para esta dirección, recibirás un correo para restablecer la contraseña.") });
    setBusy(false);
  }

  return <main className="loginShell"><section className="loginCard" aria-labelledby="login-title">
    <div className="loginTop"><div className="logo" aria-hidden="true">eC</div><div className="languageSwitch" role="group" aria-label={t("language")}><button aria-pressed={language === "ro"} className={language === "ro" ? "active" : ""} onClick={() => setLanguage("ro")}>RO</button><button aria-pressed={language === "en"} className={language === "en" ? "active" : ""} onClick={() => setLanguage("en")}>EN</button><button aria-pressed={language === "fr"} className={language === "fr" ? "active" : ""} onClick={() => setLanguage("fr")}>FR</button><button aria-pressed={language === "es"} className={language === "es" ? "active" : ""} onClick={() => setLanguage("es")}>ES</button></div></div>
    <p className="appName">eClinTalk</p>
    <h1 id="login-title">{forgotPassword ? l("Recuperează parola", "Reset password", "Réinitialiser le mot de passe", "Restablecer contraseña") : signup ? l("Creează cont", "Create account", "Créer un compte", "Crear cuenta") : t("secureSignIn")}</h1>
    <p className="muted">{t("privateHelp")}</p>
    {invitePreview && <div className="inviteBanner"><strong>{l(`Invitație în ${invitePreview.community_name}`, `Invitation to ${invitePreview.community_name}`, `Invitation à ${invitePreview.community_name}`, `Invitación a ${invitePreview.community_name}`)}</strong><span>{l(`Continuă cu adresa ${invitePreview.invitee_email}.`, `Continue with ${invitePreview.invitee_email}.`, `Continuez avec ${invitePreview.invitee_email}.`, `Continúa con ${invitePreview.invitee_email}.`)}</span></div>}
    {forgotPassword ? <form id="recovery-form" name="recovery" onSubmit={sendResetLink} className="form" autoComplete="on" method="post">
      <label htmlFor="recovery-email">{t("email")}<input id="recovery-email" name="email" type="email" inputMode="email" autoCapitalize="none" autoCorrect="off" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></label>
      {notice && <p role={notice.error ? "alert" : "status"} className={notice.error ? "error" : "success"}>{notice.text}</p>}
      <button disabled={busy} className="primary">{busy ? l("Se trimite...", "Sending...", "Envoi…", "Enviando…") : l("Trimite linkul de recuperare", "Send recovery link", "Envoyer le lien de récupération", "Enviar enlace de recuperación")}</button>
    </form> : <form id={signup ? "signup-form" : "login-form"} name={signup ? "signup" : "login"} onSubmit={submit} className="form" autoComplete="on" method="post">
      <label htmlFor={signup ? "signup-email" : "login-email"}>{t("email")}<input id={signup ? "signup-email" : "login-email"} name="email" type="email" inputMode="email" autoCapitalize="none" autoCorrect="off" spellCheck={false} autoComplete="username" enterKeyHint="next" autoFocus required value={email} onChange={(e) => setEmail(e.target.value)} /></label>
      <label htmlFor={signup ? "new-password" : "current-password"}>{t("password")}<span className="passwordField"><input id={signup ? "new-password" : "current-password"} name="password" type={showPassword ? "text" : "password"} autoCapitalize="none" autoCorrect="off" spellCheck={false} autoComplete={signup ? "new-password" : "current-password"} enterKeyHint="go" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} /><button type="button" className="passwordToggle" aria-label={showPassword ? l("Ascunde parola", "Hide password", "Masquer le mot de passe", "Ocultar contraseña") : l("Arată parola", "Show password", "Afficher le mot de passe", "Mostrar contraseña")} onClick={() => setShowPassword((visible) => !visible)}>{showPassword ? "🙈" : "👁️"}</button></span></label>
      {notice && <p role={notice.error ? "alert" : "status"} className={notice.error ? "error" : "success"}>{notice.text}</p>}
      <button type="submit" disabled={busy} className="primary">{busy ? t("processing") : signup ? l("Creează cont", "Create account", "Créer un compte", "Crear cuenta") : t("enterApp")}</button>
      {!signup && <p className="passwordHelp">{l("Datele salvate sunt completate și administrate în siguranță de managerul de parole al dispozitivului.", "Saved credentials are securely filled and managed by your device's password manager.", "Les identifiants enregistrés sont remplis et gérés en toute sécurité par le gestionnaire de mots de passe de votre appareil.", "Las credenciales guardadas se completan y administran de forma segura mediante el gestor de contraseñas del dispositivo.")}</p>}
    </form>}
    {!forgotPassword && !signup && <button className="linkBtn" onClick={() => { setForgotPassword(true); setNotice(null); }}>
      {t("forgot")}
    </button>}
    <button className="linkBtn" onClick={() => { setForgotPassword(false); setSignup(forgotPassword ? false : !signup); setNotice(null); }}>
      {forgotPassword ? l("Înapoi la conectare", "Back to sign-in", "Retour à la connexion", "Volver al inicio de sesión") : signup ? l("Ai deja cont? Conectează-te", "Already have an account? Sign in", "Vous avez déjà un compte ? Connectez-vous", "¿Ya tienes cuenta? Inicia sesión") : t("noAccount")}
    </button>
    <p className="note safetyNotice" role="note"><span aria-hidden="true">⚠</span>{t("testWarning")}</p><p className="poweredBy">{t("createdBy")}</p>
  </section></main>;
}

function UpdatePassword({ completed, language }) {
  const l = (ro, en, fr, es) => localize(language, ro, en, fr, es);
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
    <form onSubmit={submit} className="form" autoComplete="on">
      <label>{l("Parola nouă", "New password")}<input name="new-password" type="password" autoComplete="new-password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} /></label>
      <label>{l("Confirmă parola", "Confirm password")}<input name="confirm-password" type="password" autoComplete="new-password" required minLength={8} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} /></label>
      {notice && <p role={notice.error ? "alert" : "status"} className={notice.error ? "error" : "success"}>{notice.text}</p>}
      <button className="primary" disabled={busy || password.length < 8 || confirmPassword.length < 8}>{busy ? l("Se salvează...", "Saving...") : l("Salvează parola nouă", "Save new password")}</button>
    </form>
  </section></main>;
}

function NewConversation({ close, created, communities, selectedCommunityId, isGeneralAdmin, language }) {
  const l = (ro, en, fr, es) => localize(language, ro, en, fr, es);
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

  return <div className="modalBackdrop" onMouseDown={close}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="new-group-title" onMouseDown={(e) => e.stopPropagation()}>
    <div className="modalTitle"><div><p className="eyebrow">{l("Grup privat", "Private group")}</p><h2 id="new-group-title">{l("Grup nou", "New group")}</h2></div>
      <button className="iconBtn" onClick={close} aria-label={l("Închide", "Close")}>×</button></div>
    <form className="form" onSubmit={submit}>
      <label>{l("Numele grupului", "Group name")}<input required maxLength={80} value={title} onChange={(e) => setTitle(e.target.value)} /></label>
      <label>{l("Locul grupului", "Group location")}<select value={communityId} onChange={(e) => setCommunityId(e.target.value)}>
        {isGeneralAdmin && <option value="">{l("Fără comunitate", "No community")}</option>}
        {allowedCommunities.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
      </select></label>
      <label>{l("Emailurile membrilor", "Member emails")}<textarea rows={4} placeholder="user1@example.com, user2@example.com" value={emails} onChange={(e) => setEmails(e.target.value)} /></label>
      <p className="helper">{l("Pentru un grup din comunitate, persoanele trebuie adăugate mai întâi în comunitate.", "For a community group, people must first be added to the community.")}</p>
      <label>{l("Parolă suplimentară opțională", "Optional additional password")}<input type="password" minLength={6} maxLength={64} placeholder={l("Lasă liber dacă nu dorești parolă", "Leave blank if no password is needed")} value={initialPassword} onChange={(e) => setInitialPassword(e.target.value)} /></label>
      {error && <p className="error" role="alert">{error}</p>}
      <div className="modalActions"><button type="button" onClick={close}>{l("Renunță", "Cancel")}</button>
        <button className="primary" disabled={busy || !title.trim()}>{busy ? l("Se creează...", "Creating...") : l("Creează", "Create")}</button></div>
    </form>
  </section></div>;
}

function NewCommunity({ close, created, language }) {
  const l = (ro, en, fr, es) => localize(language, ro, en, fr, es);
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
  return <div className="modalBackdrop" onMouseDown={close}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="new-community-title" onMouseDown={(e) => e.stopPropagation()}>
    <div className="modalTitle"><div><p className="eyebrow">eClinTalk</p><h2 id="new-community-title">{l("Comunitate nouă", "New community")}</h2></div><button className="iconBtn" onClick={close} aria-label={l("Închide", "Close")}>×</button></div>
    <form className="form" onSubmit={submit}>
      <label>{l("Numele comunității", "Community name")}<input required maxLength={80} value={name} onChange={(e) => setName(e.target.value)} /></label>
      <label>{l("Descriere", "Description")}<textarea rows={3} maxLength={500} value={description} onChange={(e) => setDescription(e.target.value)} /></label>
      {error && <p className="error" role="alert">{error}</p>}
      <div className="modalActions"><button type="button" onClick={close}>{l("Renunță", "Cancel")}</button><button className="primary" disabled={busy || !name.trim()}>{busy ? l("Se creează...", "Creating...") : l("Creează", "Create")}</button></div>
    </form>
  </section></div>;
}

function Chat({ session, language, setLanguage, themePreference, setThemePreference, inviteToken, invitationCompleted }) {
  const t = translator(language);
  const l = (ro, en, fr, es) => localize(language, ro, en, fr, es);
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
  const [communityNotice, setCommunityNotice] = useState("");
  const [communityInviteScope, setCommunityInviteScope] = useState("community");
  const [communityInviteGroups, setCommunityInviteGroups] = useState([]);
  const [communityHistoryAccess, setCommunityHistoryAccess] = useState("new");
  const [communityInviteLinks, setCommunityInviteLinks] = useState([]);
  const [invitationLanguage, setInvitationLanguage] = useState(language);
  const [memberGroupEditorId, setMemberGroupEditorId] = useState(null);
  const [memberGroupOptions, setMemberGroupOptions] = useState([]);
  const [memberGroupSelection, setMemberGroupSelection] = useState([]);
  const [memberGroupHistoryAccess, setMemberGroupHistoryAccess] = useState("new");
  const [inviteStatus, setInviteStatus] = useState("");
  const [roomId, setRoomId] = useState(null);
  const [unlockedRoomId, setUnlockedRoomId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messagePreferences, setMessagePreferences] = useState([]);
  const [reactions, setReactions] = useState([]);
  const [draft, setDraft] = useState("");
  const [replyTo, setReplyTo] = useState(null);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [emojiCategory, setEmojiCategory] = useState("faces");
  const [recentEmojis, setRecentEmojis] = useState([]);
  const [reactionTarget, setReactionTarget] = useState(null);
  const [actionMessage, setActionMessage] = useState(null);
  const [actionRoom, setActionRoom] = useState(null);
  const [actionReactionsExpanded, setActionReactionsExpanded] = useState(false);
  const [pinnedOpen, setPinnedOpen] = useState(false);
  const [conversationSearchOpen, setConversationSearchOpen] = useState(false);
  const [conversationSearch, setConversationSearch] = useState("");
  const [pinnedOnly, setPinnedOnly] = useState(false);
  const [readMarkers, setReadMarkers] = useState([]);
  const [receiptMessage, setReceiptMessage] = useState(null);
  const [forwardMessage, setForwardMessage] = useState(null);
  const [forwardTargetId, setForwardTargetId] = useState("");
  const [forwardSearch, setForwardSearch] = useState("");
  const [forwardBusy, setForwardBusy] = useState(false);
  const [viewerMessage, setViewerMessage] = useState(null);
  const [viewerZoom, setViewerZoom] = useState(1);
  const [viewerPan, setViewerPan] = useState({ x: 0, y: 0 });
  const [viewerDismissY, setViewerDismissY] = useState(0);
  const [viewerShareOpen, setViewerShareOpen] = useState(false);
  const [viewerShareBusy, setViewerShareBusy] = useState(false);
  const [viewerShareNotice, setViewerShareNotice] = useState("");
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackText, setFeedbackText] = useState("");
  const [feedbackBusy, setFeedbackBusy] = useState(false);
  const [feedbackNotice, setFeedbackNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [deletingMessageId, setDeletingMessageId] = useState(null);
  const [attachment, setAttachment] = useState(null);
  const [imageUrls, setImageUrls] = useState({});
  const [error, setError] = useState("");
  const [modal, setModal] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [groupInfoOpen, setGroupInfoOpen] = useState(false);
  const [groupInfoTab, setGroupInfoTab] = useState("members");
  const [members, setMembers] = useState([]);
  const [settingsTitle, setSettingsTitle] = useState("");
  const [newMemberEmails, setNewMemberEmails] = useState("");
  const [newMemberHistoryAccess, setNewMemberHistoryAccess] = useState("new");
  const [settingsBusy, setSettingsBusy] = useState(false);
  const [settingsError, setSettingsError] = useState("");
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [roomPassword, setRoomPassword] = useState("");
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [groupPassword, setGroupPassword] = useState("");
  const [passwordProtected, setPasswordProtected] = useState(false);
  const [protectedContent, setProtectedContent] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [mentionsOnly, setMentionsOnly] = useState(false);
  const [mutedUntil, setMutedUntil] = useState("");
  const [notificationBusy, setNotificationBusy] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [logoutWarning, setLogoutWarning] = useState(false);
  const [logoutCountdown, setLogoutCountdown] = useState(60);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [roomSearch, setRoomSearch] = useState("");
  const [unreadBoundaryId, setUnreadBoundaryId] = useState(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileName, setProfileName] = useState("");
  const [profileBusy, setProfileBusy] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [selectedMentions, setSelectedMentions] = useState([]);
  const bottom = useRef(null);
  const messageRefs = useRef({});
  const fileInput = useRef(null);
  const messageInput = useRef(null);
  const inactivityTimer = useRef(null);
  const warningTimer = useRef(null);
  const countdownTimer = useRef(null);
  const previousRoomId = useRef(null);
  const draftRoomId = useRef(null);
  const currentDraft = useRef("");
  const viewerPointers = useRef(new Map());
  const viewerGesture = useRef({ distance: 0, zoom: 1, startX: 0, startY: 0, panX: 0, panY: 0, dismissY: 0 });
  const viewerHistoryActive = useRef(false);
  const messageLongPress = useRef({ timer: null, x: 0, y: 0, triggered: false });
  const swipeStart = useRef(null);
  const room = rooms.find((x) => x.id === roomId);
  const selectedCommunity = communities.find((x) => x.id === selectedCommunityId);
  const visibleRooms = rooms.filter((item) => selectedCommunityId === "all" ? true : selectedCommunityId === "private" ? !item.community_id : item.community_id === selectedCommunityId);
  const filteredVisibleRooms = visibleRooms.filter((item) => !roomSearch.trim() || `${item.title} ${item.community_name || ""}`.toLocaleLowerCase().includes(roomSearch.trim().toLocaleLowerCase()));
  const selectedCommunityRooms = selectedCommunity ? rooms.filter((item) => item.community_id === selectedCommunity.id) : [];
  const bulkEligibleCommunityRooms = selectedCommunityRooms.filter((item) => !item.password_protected);
  const protectedCommunityRooms = selectedCommunityRooms.filter((item) => item.password_protected);
  const canCreateGroup = selectedCommunityId === "private"
    ? isGeneralAdmin
    : isGeneralAdmin || communities.some((item) => item.my_is_admin);
  const currentMembership = members.find((x) => x.user_id === session.user.id);
  const isOwner = room?.created_by === session.user.id;
  const isAdmin = Boolean(isOwner || currentMembership?.is_admin);
  const preferenceForMessage = (messageId) => messagePreferences.find((item) => item.message_id === messageId);
  const isMessagePinned = (item) => Boolean(item.pinned_at || preferenceForMessage(item.id)?.pinned_at);
  const visibleMessages = messages.filter((item) => !preferenceForMessage(item.id)?.hidden_at);
  const pinnedMessages = visibleMessages.filter(isMessagePinned).sort((a, b) => new Date(preferenceForMessage(b.id)?.pinned_at || b.pinned_at) - new Date(preferenceForMessage(a.id)?.pinned_at || a.pinned_at));
  const displayedMessages = visibleMessages.filter((item) => {
    if (pinnedOnly && !isMessagePinned(item)) return false;
    const query = conversationSearch.trim().toLocaleLowerCase();
    if (!query) return true;
    return `${item.body || ""} ${item.attachment_name || ""} ${item.sender_email || ""}`.toLocaleLowerCase().includes(query);
  });
  const displayNameForUser = (userId, fallback) => members.find((member) => member.user_id === userId)?.display_name || fallback || l("Utilizator", "User");
  const sharedMedia = visibleMessages.filter((item) => !item.deleted_at && item.attachment_path && (item.attachment_type || "").startsWith("image/"));
  const sharedFiles = visibleMessages.filter((item) => !item.deleted_at && item.attachment_path && !(item.attachment_type || "").startsWith("image/"));
  const sharedLinks = visibleMessages.flatMap((item) => linksFromText(item.deleted_at ? "" : item.body || "").map((url) => ({ url, messageId: item.id, createdAt: item.created_at, sender: displayNameForUser(item.user_id, item.sender_email) })));
  const protectedWatermark = `${profileName || session.user.email || "eClinTalk"} · ${new Date().toLocaleDateString(LANGUAGE_LOCALES[language] || LANGUAGE_LOCALES.ro)}`;
  const forwardTargets = rooms.filter((item) => item.id !== roomId && !item.password_protected && (!room?.protected_content || item.protected_content));
  const filteredForwardTargets = forwardTargets.filter((item) => {
    const query = forwardSearch.trim().toLocaleLowerCase();
    return !query || `${item.title} ${item.community_name || t("groupWithoutCommunity")}`.toLocaleLowerCase().includes(query);
  });
  const mentionMatch = draft.match(/(?:^|\s)@([^\s@]*)$/);
  const mentionQuery = (mentionMatch?.[1] || "").toLocaleLowerCase();
  const mentionSuggestions = mentionMatch ? members
    .filter((member) => member.user_id !== session.user.id)
    .filter((member) => {
      const name = (member.display_name || "").toLocaleLowerCase();
      const emailName = (member.email || "").split("@")[0].toLocaleLowerCase();
      return !mentionQuery || name.includes(mentionQuery) || emailName.includes(mentionQuery);
    }).slice(0, 6) : [];
  const emojiTabs = recentEmojis.length ? [{ id:"recent",ro:"Recente",en:"Recent",icon:"🕘",items:recentEmojis },...EMOJI_CATEGORIES] : EMOJI_CATEGORIES;
  const activeEmojiItems = emojiTabs.find((category) => category.id === emojiCategory)?.items || emojiTabs[0].items;

  function chooseCommunity(id) {
    setSelectedCommunityId(id);
    setRoomId(null);
    setConversationSearch("");
    setConversationSearchOpen(false);
  }

  function chooseRoom(id) {
    setActionRoom(null);
    setConversationSearch("");
    setConversationSearchOpen(false);
    setRoomId(id);
    setMobileMenuOpen(false);
  }

  function openImageViewer(item) {
    setViewerZoom(1);
    setViewerPan({ x: 0, y: 0 });
    setViewerDismissY(0);
    setViewerShareOpen(false);
    setViewerShareNotice("");
    viewerPointers.current.clear();
    viewerGesture.current = { distance: 0, zoom: 1, startX: 0, startY: 0, panX: 0, panY: 0, dismissY: 0 };
    if (!viewerHistoryActive.current) {
      window.history.pushState({ eclintalkViewer: true }, "");
      viewerHistoryActive.current = true;
    }
    setViewerMessage(item);
  }

  function closeImageViewer() {
    setViewerShareOpen(false);
    setViewerShareNotice("");
    if (viewerHistoryActive.current) window.history.back();
    else setViewerMessage(null);
  }

  async function getViewerImageFile() {
    if (!viewerMessage?.attachment_path) throw new Error(l("Imaginea nu este disponibilă.", "The image is not available.", "L’image n’est pas disponible.", "La imagen no está disponible."));
    const { data, error: downloadError } = await supabase.storage.from("chat-images").download(viewerMessage.attachment_path);
    if (downloadError || !data) throw new Error(downloadError?.message || l("Imaginea nu a putut fi pregătită.", "The image could not be prepared."));
    const extension = (viewerMessage.attachment_type || data.type || "image/jpeg").split("/")[1]?.replace("jpeg","jpg") || "jpg";
    const rawName = viewerMessage.attachment_name || `eClinTalk-${Date.now()}.${extension}`;
    const safeName = rawName.replace(/[^a-zA-Z0-9._-]+/g,"-");
    return new File([data], safeName, { type: viewerMessage.attachment_type || data.type || "image/jpeg" });
  }

  function saveViewerFile(file) {
    const url = URL.createObjectURL(file);
    const link = document.createElement("a");
    link.href = url; link.download = file.name; link.click();
    window.setTimeout(() => URL.revokeObjectURL(url),1500);
  }

  async function getMessageAttachmentFile(item) {
    if (!item?.attachment_path) return null;
    const { data, error: downloadError } = await supabase.storage.from("chat-images").download(item.attachment_path);
    if (downloadError || !data) throw new Error(downloadError?.message || l("Fișierul nu a putut fi pregătit.", "The file could not be prepared.", "Le fichier n’a pas pu être préparé.", "No se pudo preparar el archivo."));
    const extension = (item.attachment_name || "file").split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "bin";
    const rawName = item.attachment_name || `eClinTalk-${Date.now()}.${extension}`;
    const safeName = rawName.replace(/[^a-zA-Z0-9._-]+/g, "-");
    return new File([data], safeName, { type: item.attachment_type || data.type || "application/octet-stream" });
  }

  async function writeTextClipboard(text) {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return;
    }
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    const copied = document.execCommand("copy");
    textarea.remove();
    if (!copied) throw new Error("copy_failed");
  }

  async function shareViewerImage() {
    if (room?.protected_content || viewerShareBusy) return;
    setViewerShareBusy(true); setViewerShareNotice("");
    try {
      const file = await getViewerImageFile();
      if (navigator.share && (!navigator.canShare || navigator.canShare({ files:[file] }))) {
        await navigator.share({ files:[file], title:viewerMessage.attachment_name || "eClinTalk" });
        setViewerShareOpen(false);
      } else {
        saveViewerFile(file);
        setViewerShareNotice(l("Imaginea a fost descărcată. O poți trimite din aplicația dorită.", "The image was downloaded. You can send it from your preferred app.", "L’image a été téléchargée. Vous pouvez l’envoyer depuis l’application souhaitée.", "La imagen se descargó. Puedes enviarla desde la aplicación que prefieras."));
      }
    } catch (shareError) {
      if (shareError?.name !== "AbortError") setViewerShareNotice(shareError?.message || l("Distribuirea nu este disponibilă.", "Sharing is unavailable."));
    }
    setViewerShareBusy(false);
  }

  async function openExternalImageTool(target) {
    if (room?.protected_content || viewerShareBusy) return;
    const destinations = { web:"https://lens.google.com/", chatgpt:"https://chatgpt.com/", claude:"https://claude.ai/new" };
    const externalWindow = window.open("about:blank","_blank");
    if (externalWindow) externalWindow.opener = null;
    setViewerShareBusy(true); setViewerShareNotice("");
    try {
      const file = await getViewerImageFile();
      saveViewerFile(file);
      if (externalWindow) externalWindow.location.href = destinations[target];
      else window.open(destinations[target],"_blank","noopener,noreferrer");
      setViewerShareNotice(l("Imaginea a fost descărcată. Atașeaz-o în pagina deschisă.", "The image was downloaded. Attach it in the page that opened.", "L’image a été téléchargée. Joignez-la dans la page ouverte.", "La imagen se descargó. Adjúntala en la página abierta."));
    } catch (toolError) {
      externalWindow?.close();
      setViewerShareNotice(toolError?.message || l("Imaginea nu a putut fi pregătită.", "The image could not be prepared."));
    }
    setViewerShareBusy(false);
  }

  function viewerPointerDown(event) {
    event.currentTarget.setPointerCapture?.(event.pointerId);
    viewerPointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const points = [...viewerPointers.current.values()];
    if (points.length >= 2) {
      setViewerDismissY(0);
      viewerGesture.current = { ...viewerGesture.current, distance: Math.hypot(points[0].x-points[1].x,points[0].y-points[1].y), zoom: viewerZoom, dismissY: 0 };
    } else {
      viewerGesture.current = { ...viewerGesture.current, startX: event.clientX, startY: event.clientY, panX: viewerPan.x, panY: viewerPan.y };
    }
  }

  function changeViewerZoom(delta) {
    setViewerZoom((current) => {
      const next = Math.min(4, Math.max(1, Math.round((current + delta) * 10) / 10));
      if (next === 1) setViewerPan({ x: 0, y: 0 });
      viewerGesture.current = { ...viewerGesture.current, zoom: next, panX: next === 1 ? 0 : viewerPan.x, panY: next === 1 ? 0 : viewerPan.y };
      return next;
    });
  }

  function resetViewerZoom() {
    setViewerZoom(1);
    setViewerPan({ x: 0, y: 0 });
    setViewerDismissY(0);
    viewerGesture.current = { ...viewerGesture.current, zoom: 1, panX: 0, panY: 0, dismissY: 0 };
  }

  function viewerPointerMove(event) {
    if (!viewerPointers.current.has(event.pointerId)) return;
    event.preventDefault();
    viewerPointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const points = [...viewerPointers.current.values()];
    if (points.length >= 2 && viewerGesture.current.distance > 0) {
      const distance = Math.hypot(points[0].x-points[1].x,points[0].y-points[1].y);
      const nextZoom = Math.min(4,Math.max(1,viewerGesture.current.zoom*(distance/viewerGesture.current.distance)));
      setViewerZoom(nextZoom);
      if (nextZoom === 1) setViewerPan({ x: 0, y: 0 });
    } else if (points.length === 1 && viewerZoom > 1) {
      setViewerPan({ x: viewerGesture.current.panX + event.clientX-viewerGesture.current.startX, y: viewerGesture.current.panY + event.clientY-viewerGesture.current.startY });
    } else if (points.length === 1 && viewerZoom === 1 && event.pointerType !== "mouse") {
      const deltaX = event.clientX-viewerGesture.current.startX;
      const deltaY = Math.max(0,event.clientY-viewerGesture.current.startY);
      if (deltaY > Math.abs(deltaX)) {
        viewerGesture.current = { ...viewerGesture.current, dismissY: deltaY };
        setViewerDismissY(deltaY);
      }
    }
  }

  function viewerPointerUp(event) {
    viewerPointers.current.delete(event.pointerId);
    const point = [...viewerPointers.current.values()][0];
    if (point) viewerGesture.current = { ...viewerGesture.current, distance: 0, startX: point.x, startY: point.y, panX: viewerPan.x, panY: viewerPan.y, zoom: viewerZoom };
    else if (viewerZoom === 1 && viewerGesture.current.dismissY > 110) closeImageViewer();
    else {
      setViewerDismissY(0);
      viewerGesture.current = { ...viewerGesture.current, distance: 0, panX: viewerPan.x, panY: viewerPan.y, zoom: viewerZoom, dismissY: 0 };
    }
  }

  function startMessageLongPress(event,item) {
    if (item.deleted_at || event.pointerType === "mouse") return;
    window.clearTimeout(messageLongPress.current.timer);
    messageLongPress.current = { x: event.clientX, y: event.clientY, triggered: false, timer: window.setTimeout(() => {
      messageLongPress.current.triggered = true;
      navigator.vibrate?.(12);
      setActionMessage(item);
    },420) };
  }

  function moveMessageLongPress(event) {
    const press = messageLongPress.current;
    if (!press.timer || Math.hypot(event.clientX-press.x,event.clientY-press.y) < 12) return;
    window.clearTimeout(press.timer);
    press.timer = null;
  }

  function endMessageLongPress() {
    window.clearTimeout(messageLongPress.current.timer);
    messageLongPress.current.timer = null;
    if (messageLongPress.current.triggered) window.setTimeout(() => { messageLongPress.current.triggered = false; },600);
  }

  function suppressLongPressClick(event) {
    if (!messageLongPress.current.triggered) return;
    event.preventDefault();
    event.stopPropagation();
    messageLongPress.current.triggered = false;
  }

  function chatTouchStart(event) {
    const touch = event.touches?.[0];
    swipeStart.current = touch && touch.clientX <= 36 ? { x: touch.clientX, y: touch.clientY } : null;
  }

  function chatTouchEnd(event) {
    const start = swipeStart.current;
    const touch = event.changedTouches?.[0];
    swipeStart.current = null;
    if (!start || !touch || window.innerWidth > 760) return;
    const dx = touch.clientX-start.x;
    const dy = touch.clientY-start.y;
    if (dx > 72 && Math.abs(dx) > Math.abs(dy)*1.25) setMobileMenuOpen(true);
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
    await supabase.auth.signOut();
  }

  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("Notification" in window)) return;
    let active = true;
    navigator.serviceWorker.register("/sw.js")
      .then(() => navigator.serviceWorker.ready)
      .then(async (registration) => {
        const subscription = await registration.pushManager.getSubscription();
        const isEnabled = Boolean(subscription) && Notification.permission === "granted";
        if (active) setPushEnabled(isEnabled);
        if (isEnabled) {
          const response = await fetch("/api/push/subscribe", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
            body: JSON.stringify(subscription.toJSON()),
          });
          if (!response.ok && active) setPushEnabled(false);
        }
      })
      .catch(() => active && setPushEnabled(false));
    return () => { active = false; };
  }, [session.access_token]);

  useEffect(() => {
    if (window.matchMedia("(max-width: 760px)").matches) setMobileMenuOpen(true);
  }, []);

  useEffect(() => {
    function handleViewerBack() {
      if (!viewerHistoryActive.current) return;
      viewerHistoryActive.current = false;
      setViewerMessage(null);
      setViewerDismissY(0);
      setViewerShareOpen(false);
    }
    window.addEventListener("popstate", handleViewerBack);
    return () => window.removeEventListener("popstate", handleViewerBack);
  }, []);

  useEffect(() => {
    if (!actionMessage) setActionReactionsExpanded(false);
  }, [actionMessage]);

  useEffect(() => {
    function closeWithEscape(event) {
      if (event.key !== "Escape" || logoutWarning) return;
      if (passwordOpen && !passwordBusy) cancelPassword();
      else if (viewerShareOpen) setViewerShareOpen(false);
      else if (viewerMessage) closeImageViewer();
      else if (receiptMessage) setReceiptMessage(null);
      else if (forwardMessage && !forwardBusy) setForwardMessage(null);
      else if (feedbackOpen && !feedbackBusy) setFeedbackOpen(false);
      else if (settingsOpen && !settingsBusy) setSettingsOpen(false);
      else if (groupInfoOpen) setGroupInfoOpen(false);
      else if (communitySettingsOpen && !communityBusy) setCommunitySettingsOpen(false);
      else if (profileOpen && !profileBusy) setProfileOpen(false);
      else if (modal) setModal(false);
      else if (communityModal) setCommunityModal(false);
      else if (emojiOpen) setEmojiOpen(false);
      else if (actionMessage) setActionMessage(null);
      else if (actionRoom) setActionRoom(null);
      else if (reactionTarget) setReactionTarget(null);
      else if (pinnedOpen) setPinnedOpen(false);
      else if (mobileMenuOpen) setMobileMenuOpen(false);
    }
    document.addEventListener("keydown", closeWithEscape);
    return () => document.removeEventListener("keydown", closeWithEscape);
  }, [logoutWarning, passwordOpen, passwordBusy, viewerShareOpen, viewerMessage, receiptMessage, forwardMessage, forwardBusy, feedbackOpen, feedbackBusy, settingsOpen, settingsBusy, groupInfoOpen, communitySettingsOpen, communityBusy, profileOpen, profileBusy, modal, communityModal, emojiOpen, actionMessage, actionRoom, reactionTarget, pinnedOpen, mobileMenuOpen]);

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
    try { setRecentEmojis(JSON.parse(window.localStorage.getItem("eclintalk-recent-emojis") || "[]").slice(0,12)); } catch { setRecentEmojis([]); }
    supabase.from("profiles").select("display_name, preferred_language").eq("user_id", session.user.id).maybeSingle()
      .then(({ data }) => {
        if (data?.display_name) setProfileName(data.display_name);
      });
  }, []);
  useEffect(() => {
    currentDraft.current = draft;
    const activeRoom = draftRoomId.current;
    if (!activeRoom) return;
    const key = `eclintalk-draft:${session.user.id}:${activeRoom}`;
    if (draft) window.localStorage.setItem(key,draft); else window.localStorage.removeItem(key);
  }, [draft]);
  useEffect(() => {
    const previousRoom = draftRoomId.current;
    if (previousRoom) {
      const previousKey = `eclintalk-draft:${session.user.id}:${previousRoom}`;
      if (currentDraft.current) window.localStorage.setItem(previousKey,currentDraft.current); else window.localStorage.removeItem(previousKey);
    }
    const nextDraft = roomId ? window.localStorage.getItem(`eclintalk-draft:${session.user.id}:${roomId}`) || "" : "";
    draftRoomId.current = roomId;
    currentDraft.current = nextDraft;
    setDraft(nextDraft);
    setReplyTo(null); setAttachment(null); setEmojiOpen(false); setConversationSearch(""); setPinnedOnly(false); setReadMarkers([]);
    if (fileInput.current) fileInput.current.value = "";
  }, [roomId]);
  useEffect(() => {
    if (!inviteToken) return;
    let active = true;
    setInviteStatus(l("Se acceptă invitația...", "Accepting invitation..."));
    supabase.rpc("accept_community_invitation", { invitation_token: inviteToken }).then(async ({ data, error: invitationError }) => {
      if (!active) return;
      if (invitationError) {
        setInviteStatus(l(`Invitația nu a putut fi acceptată: ${invitationError.message}`, `The invitation could not be accepted: ${invitationError.message}`, `L’invitation n’a pas pu être acceptée : ${invitationError.message}`, `No se pudo aceptar la invitación: ${invitationError.message}`));
        return;
      }
      const accepted = data?.[0];
      await Promise.all([loadRooms(), loadCommunities()]);
      setInviteStatus(l(
        `Ai fost adăugat în comunitatea ${accepted?.community_name || "selectată"}${accepted?.groups_added ? ` și în ${accepted.groups_added} grupuri` : ""}.`,
        `You joined ${accepted?.community_name || "the selected community"}${accepted?.groups_added ? ` and ${accepted.groups_added} groups` : ""}.`,
        `Vous avez rejoint ${accepted?.community_name || "la communauté sélectionnée"}${accepted?.groups_added ? ` et ${accepted.groups_added} groupes` : ""}.`,
        `Te has unido a ${accepted?.community_name || "la comunidad seleccionada"}${accepted?.groups_added ? ` y a ${accepted.groups_added} grupos` : ""}.`,
      ));
      invitationCompleted();
    });
    return () => { active = false; };
  }, [inviteToken]);
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
    if (!roomId || unlockedRoomId !== roomId) { setMessages([]); setMessagePreferences([]); setReactions([]); setUnreadBoundaryId(null); return; }
    let active = true;
    setMessages([]);
    setMessagePreferences([]);
    setReactions([]);
    setError("");
    Promise.all([
      supabase.from("private_messages").select("*").eq("conversation_id", roomId).order("created_at").limit(500),
      supabase.from("message_reactions").select("*").eq("conversation_id", roomId),
      supabase.rpc("get_my_message_preferences", { target_conversation_id: roomId }),
    ]).then(([messageResult, reactionResult, preferenceResult]) => {
        if (!active) return;
        if (messageResult.error) setError(l("Mesajele nu au putut fi încărcate.", "Messages could not be loaded."));
        else {
          const list = messageResult.data || [];
          const unreadCount = rooms.find((item) => item.id === roomId)?.unread_count || 0;
          setUnreadBoundaryId(unreadCount > 0 ? list[Math.max(0,list.length-unreadCount)]?.id || null : null);
          setMessages(list);
        }
        if (!reactionResult.error) setReactions(reactionResult.data || []);
        if (!preferenceResult.error) setMessagePreferences(preferenceResult.data || []);
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
  useEffect(() => {
    if (!roomId || unlockedRoomId !== roomId) { setReadMarkers([]); return; }
    loadReadMarkers();
    const refresh = window.setInterval(loadReadMarkers, 12000);
    return () => window.clearInterval(refresh);
  }, [roomId, unlockedRoomId]);
  useEffect(() => { bottom.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  useEffect(() => {
    let active = true;
    const paths = messages.map((item) => item.attachment_path).filter((path) => path && !imageUrls[path]);
    if (!paths.length) return;
    Promise.all(paths.map(async (path) => {
      const { data } = await supabase.storage.from("chat-images").createSignedUrl(path, room?.protected_content ? 5 * 60 : 60 * 60);
      return [path, data?.signedUrl || ""];
    })).then((entries) => {
      if (active) setImageUrls((current) => ({ ...current, ...Object.fromEntries(entries) }));
    });
    return () => { active = false; };
  }, [messages, imageUrls, room?.protected_content]);

  function chooseFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const allowed = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif", "application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "text/plain"];
    if (!allowed.includes(file.type)) { setError(l("Poți atașa imagini, PDF, Word, Excel sau fișiere text.", "You can attach images, PDF, Word, Excel, or text files.", "Vous pouvez joindre des images, des fichiers PDF, Word, Excel ou texte.", "Puedes adjuntar imágenes, PDF, Word, Excel o archivos de texto.")); e.target.value = ""; return; }
    if (file.size > 20 * 1024 * 1024) { setError(l("Fișierul trebuie să aibă cel mult 20 MB.", "The file must be no larger than 20 MB.", "Le fichier ne doit pas dépasser 20 Mo.", "El archivo no debe superar los 20 MB.")); e.target.value = ""; return; }
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
      if (uploadError) { setError(l("Fișierul nu a putut fi încărcat.", "The file could not be uploaded.", "Le fichier n’a pas pu être téléversé.", "No se pudo cargar el archivo.")); setSending(false); return; }
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
    setEmojiOpen(false);
    setRecentEmojis((current) => {
      const next = [emoji,...current.filter((item) => item!==emoji)].slice(0,12);
      window.localStorage.setItem("eclintalk-recent-emojis",JSON.stringify(next));
      return next;
    });
    window.requestAnimationFrame(() => messageInput.current?.focus());
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

  async function togglePersonalMessagePin(messageId) {
    const { data, error: pinError } = await supabase.rpc("toggle_personal_message_pin", { target_message_id: messageId });
    if (pinError) { setError(pinError.message); return; }
    setMessagePreferences((current) => {
      const existing = current.find((item) => item.message_id === messageId);
      const next = { message_id: messageId, pinned_at: data || null, hidden_at: existing?.hidden_at || null };
      return existing ? current.map((item) => item.message_id === messageId ? next : item) : [...current, next];
    });
  }

  async function toggleGlobalMessagePin(messageId) {
    const { data, error: pinError } = await supabase.rpc("toggle_message_pin", { target_message_id: messageId });
    if (pinError) { setError(pinError.message); return; }
    setMessages((current) => current.map((item) => item.id === messageId ? {
      ...item,
      pinned_at: data ? new Date().toISOString() : null,
      pinned_by: data ? session.user.id : null,
    } : item));
  }

  async function hideMessageForMe(item) {
    if (!window.confirm(l("Ștergi acest mesaj doar pentru tine? Ceilalți membri îl vor vedea în continuare.", "Delete this message only for you? Other members will still see it.", "Supprimer ce message uniquement pour vous ? Les autres membres le verront toujours.", "¿Eliminar este mensaje solo para ti? Los demás miembros seguirán viéndolo."))) return;
    const { data, error: hideError } = await supabase.rpc("hide_message_for_me", { target_message_id: item.id });
    if (hideError) { setError(hideError.message); return; }
    setMessagePreferences((current) => {
      const existing = current.find((entry) => entry.message_id === item.id);
      const next = { message_id: item.id, pinned_at: existing?.pinned_at || null, hidden_at: data || new Date().toISOString() };
      return existing ? current.map((entry) => entry.message_id === item.id ? next : entry) : [...current, next];
    });
    if (replyTo?.id === item.id) setReplyTo(null);
  }

  async function loadReadMarkers() {
    if (!roomId || unlockedRoomId !== roomId) return;
    const { data, error: markerError } = await supabase.rpc("get_conversation_read_markers", {
      target_conversation_id: roomId,
    });
    if (!markerError) setReadMarkers(data || []);
  }

  function receiptForMessage(item) {
    const recipients = readMarkers.filter((marker) => marker.user_id !== item.user_id);
    const seen = recipients.filter((marker) => marker.last_read_at && new Date(marker.last_read_at) >= new Date(item.created_at));
    return { recipients, seen, unseen: recipients.filter((marker) => !seen.some((entry) => entry.user_id === marker.user_id)) };
  }

  function openReceipts(item) {
    setReceiptMessage(item);
    loadReadMarkers();
  }

  function openForward(item) {
    setForwardTargetId("");
    setForwardSearch("");
    setForwardMessage(item);
  }

  async function copyMessageText(item) {
    const text = item?.body?.trim();
    if (!text) return;
    try {
      await writeTextClipboard(text);
      setActionMessage(null);
      setInviteStatus(l("Text copiat.", "Text copied.", "Texte copié.", "Texto copiado."));
    } catch {
      setError(l("Textul nu a putut fi copiat.", "The text could not be copied.", "Le texte n’a pas pu être copié.", "No se pudo copiar el texto."));
    }
  }

  async function shareMessage(item) {
    if (!item || room?.protected_content) return;
    setActionMessage(null);
    try {
      const file = await getMessageAttachmentFile(item);
      const shareData = { title: item.attachment_name || "eClinTalk" };
      if (item.body?.trim()) shareData.text = item.body.trim();
      if (file) shareData.files = [file];
      const canShareFiles = !file || !navigator.canShare || navigator.canShare({ files: [file] });
      if (navigator.share && canShareFiles) {
        await navigator.share(shareData);
        return;
      }
      if (file) saveViewerFile(file);
      if (item.body?.trim()) await writeTextClipboard(item.body.trim());
      setInviteStatus(file && item.body?.trim()
        ? l("Fișier descărcat și text copiat.", "File downloaded and text copied.", "Fichier téléchargé et texte copié.", "Archivo descargado y texto copiado.")
        : file
          ? l("Fișier descărcat. Îl poți distribui din dispozitiv.", "File downloaded. You can share it from your device.", "Fichier téléchargé. Vous pouvez le partager depuis votre appareil.", "Archivo descargado. Puedes compartirlo desde tu dispositivo.")
          : l("Text copiat. Îl poți lipi în aplicația dorită.", "Text copied. You can paste it into another app.", "Texte copié. Vous pouvez le coller dans une autre application.", "Texto copiado. Puedes pegarlo en otra aplicación."));
    } catch (shareError) {
      if (shareError?.name !== "AbortError") setError(shareError?.message || l("Mesajul nu a putut fi distribuit.", "The message could not be shared.", "Le message n’a pas pu être partagé.", "No se pudo compartir el mensaje."));
    }
  }

  async function confirmForward(e) {
    e.preventDefault();
    if (!forwardMessage || !forwardTargetId || forwardBusy) return;
    const target = rooms.find((item) => item.id === forwardTargetId);
    if (!target || (room?.protected_content && !target.protected_content)) {
      setError(l("Conținutul protejat poate fi redirecționat numai către un grup protejat.", "Protected content can only be forwarded to a protected group.", "Le contenu protégé ne peut être transféré que vers un groupe protégé.", "El contenido protegido solo puede reenviarse a un grupo protegido."));
      return;
    }
    setForwardBusy(true); setError("");
    let attachmentData = {};
    let copiedPath = null;
    if (forwardMessage.attachment_path) {
      const { data: sourceFile, error: downloadError } = await supabase.storage.from("chat-images").download(forwardMessage.attachment_path);
      if (downloadError || !sourceFile) {
        setError(l("Fișierul original nu a putut fi copiat.", "The original file could not be copied.", "Le fichier d’origine n’a pas pu être copié.", "No se pudo copiar el archivo original."));
        setForwardBusy(false); return;
      }
      const extension = (forwardMessage.attachment_name || "file").split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "bin";
      copiedPath = `${forwardTargetId}/${session.user.id}/${crypto.randomUUID()}.${extension}`;
      const { error: uploadError } = await supabase.storage.from("chat-images").upload(copiedPath, sourceFile, {
        contentType: forwardMessage.attachment_type || sourceFile.type || "application/octet-stream", upsert: false,
      });
      if (uploadError) {
        setError(l("Fișierul nu a putut fi copiat în grupul destinație.", "The file could not be copied to the destination group.", "Le fichier n’a pas pu être copié dans le groupe de destination.", "No se pudo copiar el archivo al grupo de destino."));
        setForwardBusy(false); return;
      }
      attachmentData = {
        attachment_path: copiedPath,
        attachment_name: forwardMessage.attachment_name,
        attachment_type: forwardMessage.attachment_type,
        attachment_size: forwardMessage.attachment_size,
      };
    }
    const { data, error: forwardError } = await supabase.from("private_messages").insert({
      conversation_id: forwardTargetId,
      user_id: session.user.id,
      sender_email: session.user.email,
      body: forwardMessage.body || null,
      forwarded_from_message_id: forwardMessage.id,
      ...attachmentData,
    }).select().single();
    if (forwardError) {
      if (copiedPath) await supabase.storage.from("chat-images").remove([copiedPath]);
      setError(forwardError.message);
    } else {
      setForwardMessage(null); setForwardTargetId("");
      setInviteStatus(l(`Mesaj redirecționat către ${target.title}.`, `Message forwarded to ${target.title}.`, `Message transféré vers ${target.title}.`, `Mensaje reenviado a ${target.title}.`));
      fetch("/api/push/send", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ messageId: data.id }),
      }).catch(() => {});
    }
    setForwardBusy(false);
  }

  async function submitFeedback(e) {
    e.preventDefault();
    if (feedbackBusy || feedbackText.trim().length < 3) return;
    setFeedbackBusy(true); setFeedbackNotice("");
    const { error: feedbackError } = await supabase.rpc("submit_app_feedback", {
      feedback_message: feedbackText.trim(),
      feedback_context: { room_id: roomId, version: "1.20.3", language, user_agent: navigator.userAgent },
    });
    if (feedbackError) setFeedbackNotice(feedbackError.message);
    else {
      setFeedbackText("");
      setFeedbackNotice(l("Feedback trimis. Mulțumim!", "Feedback sent. Thank you!", "Avis envoyé. Merci !", "Comentarios enviados. ¡Gracias!"));
    }
    setFeedbackBusy(false);
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
        setError(l("Fișierul nu a putut fi șters. Mesajul a fost păstrat.", "The file could not be deleted. The message was kept.", "Le fichier n’a pas pu être supprimé. Le message a été conservé.", "No se pudo eliminar el archivo. El mensaje se conservó."));
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

  async function toggleGroupPin(targetRoomId = roomId) {
    const { error: pinError } = await supabase.rpc("toggle_conversation_pin", { target_conversation_id: targetRoomId });
    if (pinError) setError(pinError.message);
    else await loadRooms(roomId || targetRoomId);
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
    setCommunityMemberEmails(""); setCommunityMembers([]); setCommunityError(""); setCommunityNotice("");
    setCommunityInviteScope("community"); setCommunityInviteGroups([]); setCommunityInviteLinks([]);
    setCommunityHistoryAccess("new");
    setMemberGroupEditorId(null); setMemberGroupOptions([]); setMemberGroupSelection([]);
    if (window.innerWidth <= 760 && mobileMenuOpen) {
      setMobileMenuOpen(false);
      await new Promise((resolve) => window.setTimeout(resolve, 220));
    }
    setCommunitySettingsOpen(true);
    await loadCommunityMembers();
  }

  async function openMemberGroupEditor(member) {
    if (!selectedCommunity || communityBusy) return;
    if (memberGroupEditorId === member.user_id) {
      setMemberGroupEditorId(null); setMemberGroupOptions([]); setMemberGroupSelection([]);
      return;
    }
    setCommunityBusy(true); setCommunityError(""); setCommunityNotice("");
    const { data, error: accessError } = await supabase.rpc("get_community_member_group_access", {
      target_community_id: selectedCommunity.id,
      target_user_id: member.user_id,
    });
    if (accessError) setCommunityError(accessError.message);
    else {
      const options = data || [];
      setMemberGroupEditorId(member.user_id);
      setMemberGroupOptions(options);
      setMemberGroupSelection(options.filter((item) => item.is_member).map((item) => item.conversation_id));
      setMemberGroupHistoryAccess("new");
    }
    setCommunityBusy(false);
  }

  async function saveMemberGroupAccess(member) {
    if (!selectedCommunity || communityBusy || memberGroupEditorId !== member.user_id) return;
    const allowedIds = memberGroupOptions.filter((item) => item.can_manage).map((item) => item.conversation_id);
    const selectedIds = memberGroupSelection.filter((id) => allowedIds.includes(id));
    setCommunityBusy(true); setCommunityError(""); setCommunityNotice("");
    const { error: accessError } = await supabase.rpc("set_community_member_groups", {
      target_community_id: selectedCommunity.id,
      target_user_id: member.user_id,
      target_conversation_ids: selectedIds,
      include_message_history: memberGroupHistoryAccess === "all",
    });
    if (accessError) setCommunityError(accessError.message);
    else {
      setMemberGroupOptions((current) => current.map((item) => ({
        ...item,
        is_member: item.is_admin || item.is_owner || selectedIds.includes(item.conversation_id),
      })));
      setCommunityNotice(l(
        `Clinicile/grupurile vizibile pentru ${member.display_name || member.email} au fost actualizate.`,
        `Visible clinics/groups for ${member.display_name || member.email} were updated.`,
        `Les cliniques/groupes visibles pour ${member.display_name || member.email} ont été mis à jour.`,
        `Se actualizaron las clínicas/grupos visibles para ${member.display_name || member.email}.`,
      ));
    }
    setCommunityBusy(false);
  }

  async function saveCommunity(e) {
    e.preventDefault();
    if (!selectedCommunity || communityBusy || !communityName.trim()) return;
    setCommunityBusy(true); setCommunityError(""); setCommunityNotice("");
    const { error: saveError } = await supabase.rpc("update_community", {
      target_community_id: selectedCommunity.id, new_name: communityName.trim(), new_description: communityDescription.trim(),
    });
    if (saveError) setCommunityError(saveError.message);
    else { await loadCommunities(selectedCommunity.id); setCommunityNotice(l("Detaliile comunității au fost salvate.", "Community details were saved.")); }
    setCommunityBusy(false);
  }

  async function addCommunityMembers(e) {
    e.preventDefault();
    const emails = communityMemberEmails.split(/[,\n;]/).map((x) => x.trim().toLowerCase()).filter(Boolean);
    if (!selectedCommunity || !emails.length || communityBusy) return;
    setCommunityBusy(true); setCommunityError(""); setCommunityNotice("");
    const eligibleGroupIds = bulkEligibleCommunityRooms.map((item) => item.id);
    const targetGroupIds = communityInviteScope === "community"
      ? []
      : communityInviteScope === "all"
        ? eligibleGroupIds
        : communityInviteGroups.filter((id) => eligibleGroupIds.includes(id));
    const results = [];
    let addError = null;
    for (const inviteeEmail of emails) {
      const { data, error: invitationError } = await supabase.rpc("create_community_invitation", {
        target_community_id: selectedCommunity.id,
        invitee_email: inviteeEmail,
        target_conversation_ids: targetGroupIds,
        include_message_history: communityHistoryAccess === "all",
      });
      if (invitationError) { addError = invitationError; break; }
      if (data?.[0]) results.push(data[0]);
    }
    if (addError) setCommunityError(addError.message);
    else {
      const links = results.filter((item) => item.outcome === "invited" && item.invitation_token).map((item) => ({
        email: item.normalized_email,
        url: `${window.location.origin}/?invite=${item.invitation_token}`,
      }));
      const addedCount = results.filter((item) => item.outcome === "added").length;
      setCommunityInviteLinks(links); setCommunityMemberEmails("");
      await Promise.all([loadCommunityMembers(),loadCommunities(selectedCommunity.id),loadRooms()]);
      setCommunityNotice(l(
        `${addedCount ? `${addedCount} conturi existente au fost adăugate. ` : ""}${links.length ? `${links.length} linkuri de invitație au fost create.` : ""}`.trim(),
        `${addedCount ? `${addedCount} existing accounts were added. ` : ""}${links.length ? `${links.length} invitation links were created.` : ""}`.trim(),
        `${addedCount ? `${addedCount} comptes existants ont été ajoutés. ` : ""}${links.length ? `${links.length} liens d’invitation ont été créés.` : ""}`.trim(),
        `${addedCount ? `Se añadieron ${addedCount} cuentas existentes. ` : ""}${links.length ? `Se crearon ${links.length} enlaces de invitación.` : ""}`.trim(),
      ));
    }
    setCommunityBusy(false);
  }

  async function copyInvitation(link) {
    try {
      await navigator.clipboard.writeText(link.url);
      setCommunityNotice(l(`Linkul pentru ${link.email} a fost copiat.`, `The link for ${link.email} was copied.`, `Le lien pour ${link.email} a été copié.`, `Se copió el enlace para ${link.email}.`));
    } catch {
      setCommunityError(l("Linkul nu a putut fi copiat automat. Selectează-l și copiază-l manual.", "The link could not be copied automatically. Select and copy it manually."));
    }
  }

  function invitationShareText(link) {
    const community = selectedCommunity?.name || "eClinTalk";
    return localize(invitationLanguage,
      `Ai fost invitat(ă) în comunitatea „${community}” din eClinTalk. Deschide linkul pentru a-ți crea contul sau pentru a accepta invitația. Linkul este valabil 7 zile:\n${link.url}`,
      `You have been invited to the “${community}” community in eClinTalk. Open the link to create your account or accept the invitation. The link is valid for 7 days:\n${link.url}`,
      `Vous avez été invité(e) dans la communauté « ${community} » sur eClinTalk. Ouvrez le lien pour créer votre compte ou accepter l’invitation. Le lien est valable 7 jours :\n${link.url}`,
      `Has recibido una invitación a la comunidad «${community}» en eClinTalk. Abre el enlace para crear tu cuenta o aceptar la invitación. El enlace es válido durante 7 días:\n${link.url}`,
    );
  }

  function invitationEmailText(link) {
    const community = selectedCommunity?.name || "eClinTalk";
    return localize(invitationLanguage,
      `Bună,\n\nAi fost invitat(ă) în comunitatea „${community}” din eClinTalk.\n\neClinTalk este o aplicație privată de comunicare pentru echipe și comunități. Poți participa la comunitățile și grupurile în care primești acces, poți trimite mesaje și imagini, răspunde la mesaje, folosi mențiuni și emoticoane și poți configura separat notificările fiecărui grup. Accesul la comunități și grupuri este controlat de administratorii lor.\n\nAplicația funcționează pe Mac, Windows, iPhone/iPad și Android. Pe telefon poate fi instalată pe ecranul principal și apoi se deschide din pictograma eClinTalk, asemenea unei aplicații obișnuite:\n• iPhone/iPad: deschide linkul în Safari, apasă Partajare, apoi „Adaugă la ecranul principal”.\n• Android: deschide linkul în Chrome, deschide meniul și alege „Instalează aplicația” sau „Adaugă la ecranul principal”.\n• Mac: folosește Safari sau Chrome și opțiunea „Adaugă în Dock” / „Instalează aplicația”.\n• Windows: folosește Edge sau Chrome și opțiunea „Instalează aplicația”.\n\nDeschide linkul de mai jos pentru a-ți crea contul sau pentru a accepta invitația. Linkul este valabil 7 zile:\n${link.url}\n\nImportant: eClinTalk este încă o versiune de test. Nu introduce date medicale sau personale reale despre pacienți.\n\nDupă instalare, deschide aplicația din pictograma eClinTalk și activează notificările dacă dorești să fii anunțat(ă) când primești mesaje noi.\n\nCreat de eClinic Hub`,
      `Hello,\n\nYou have been invited to the “${community}” community in eClinTalk.\n\neClinTalk is a private communication app for teams and communities. You can participate in the communities and groups you are given access to, send messages and images, reply to messages, use mentions and emoji, and configure notifications separately for each group. Access to communities and groups is controlled by their administrators.\n\nThe app works on Mac, Windows, iPhone/iPad, and Android. On a phone, it can be installed on the Home Screen and then opened from the eClinTalk icon just like a regular app:\n• iPhone/iPad: open the link in Safari, tap Share, then “Add to Home Screen”.\n• Android: open the link in Chrome, open the menu, and choose “Install app” or “Add to Home screen”.\n• Mac: use Safari or Chrome and choose “Add to Dock” / “Install app”.\n• Windows: use Edge or Chrome and choose “Install app”.\n\nOpen the link below to create your account or accept the invitation. The link is valid for 7 days:\n${link.url}\n\nImportant: eClinTalk is still a test version. Do not enter real patient medical or personal data.\n\nAfter installation, open the app from the eClinTalk icon and enable notifications if you want to be notified about new messages.\n\nCreated by eClinic Hub`,
      `Bonjour,\n\nVous avez été invité(e) dans la communauté « ${community} » sur eClinTalk.\n\neClinTalk est une application privée de communication pour les équipes et les communautés. Vous pouvez participer aux communautés et groupes auxquels vous avez accès, envoyer des messages et des images, répondre aux messages, utiliser des mentions et des emoji, et configurer séparément les notifications de chaque groupe. L’accès aux communautés et aux groupes est contrôlé par leurs administrateurs.\n\nL’application fonctionne sur Mac, Windows, iPhone/iPad et Android. Sur un téléphone, elle peut être installée sur l’écran d’accueil, puis ouverte depuis l’icône eClinTalk comme une application classique :\n• iPhone/iPad : ouvrez le lien dans Safari, touchez Partager, puis « Sur l’écran d’accueil ».\n• Android : ouvrez le lien dans Chrome, ouvrez le menu, puis choisissez « Installer l’application » ou « Ajouter à l’écran d’accueil ».\n• Mac : utilisez Safari ou Chrome et choisissez « Ajouter au Dock » / « Installer l’application ».\n• Windows : utilisez Edge ou Chrome et choisissez « Installer l’application ».\n\nOuvrez le lien ci-dessous pour créer votre compte ou accepter l’invitation. Le lien est valable 7 jours :\n${link.url}\n\nImportant : eClinTalk est encore une version de test. Ne saisissez aucune donnée médicale ou personnelle réelle concernant des patients.\n\nAprès l’installation, ouvrez l’application depuis l’icône eClinTalk et activez les notifications si vous souhaitez être averti(e) des nouveaux messages.\n\nCréé par eClinic Hub`,
      `Hola,\n\nHas recibido una invitación a la comunidad «${community}» en eClinTalk.\n\neClinTalk es una aplicación privada de comunicación para equipos y comunidades. Puedes participar en las comunidades y grupos a los que se te dé acceso, enviar mensajes e imágenes, responder a mensajes, usar menciones y emojis, y configurar por separado las notificaciones de cada grupo. El acceso a las comunidades y los grupos está controlado por sus administradores.\n\nLa aplicación funciona en Mac, Windows, iPhone/iPad y Android. En el teléfono se puede instalar en la pantalla de inicio y abrir desde el icono de eClinTalk como una aplicación normal:\n• iPhone/iPad: abre el enlace en Safari, toca Compartir y después «Añadir a pantalla de inicio».\n• Android: abre el enlace en Chrome, abre el menú y elige «Instalar aplicación» o «Añadir a pantalla de inicio».\n• Mac: usa Safari o Chrome y elige «Añadir al Dock» / «Instalar aplicación».\n• Windows: usa Edge o Chrome y elige «Instalar aplicación».\n\nAbre el siguiente enlace para crear tu cuenta o aceptar la invitación. El enlace es válido durante 7 días:\n${link.url}\n\nImportante: eClinTalk todavía es una versión de prueba. No introduzcas datos médicos ni personales reales de pacientes.\n\nDespués de instalarla, abre la aplicación desde el icono de eClinTalk y activa las notificaciones si deseas recibir avisos de mensajes nuevos.\n\nCreado por eClinic Hub`,
    );
  }

  function shareInvitationOnWhatsApp(link) {
    window.open(`https://wa.me/?text=${encodeURIComponent(invitationShareText(link))}`, "_blank", "noopener,noreferrer");
  }

  function shareInvitationByEmail(link) {
    const community = selectedCommunity?.name || "eClinTalk";
    const subject = localize(invitationLanguage,
      `Invitație eClinTalk – ${community}`,
      `eClinTalk invitation – ${community}`,
      `Invitation eClinTalk – ${community}`,
      `Invitación eClinTalk – ${community}`,
    );
    window.location.href = `mailto:${encodeURIComponent(link.email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(invitationEmailText(link))}`;
  }

  async function toggleCommunityAdmin(member) {
    if (!selectedCommunity || communityBusy || !window.confirm(member.is_admin ? l(`Retragi rolul de administrator pentru ${member.email}?`, `Remove administrator access from ${member.email}?`, `Retirer le rôle d’administrateur à ${member.email} ?`, `¿Quitar el rol de administrador a ${member.email}?`) : l(`Acordezi rolul de administrator lui ${member.email}?`, `Grant administrator access to ${member.email}?`, `Accorder le rôle d’administrateur à ${member.email} ?`, `¿Conceder el rol de administrador a ${member.email}?`))) return;
    setCommunityBusy(true); setCommunityError(""); setCommunityNotice("");
    const { error: adminError } = await supabase.rpc("set_community_admin", {
      target_community_id: selectedCommunity.id,target_user_id: member.user_id,make_admin: !member.is_admin,
    });
    if (adminError) setCommunityError(adminError.message); else { await loadCommunityMembers(); setCommunityNotice(l("Rolul membrului a fost actualizat.", "The member role was updated.")); }
    setCommunityBusy(false);
  }

  async function removeCommunityMember(member) {
    if (!selectedCommunity || communityBusy || !window.confirm(l(`Elimini ${member.email} din comunitate și din grupurile ei?`, `Remove ${member.email} from the community and its groups?`, `Retirer ${member.email} de la communauté et de ses groupes ?`, `¿Eliminar a ${member.email} de la comunidad y de sus grupos?`))) return;
    setCommunityBusy(true); setCommunityError(""); setCommunityNotice("");
    const { error: removeError } = await supabase.rpc("remove_community_member", {
      target_community_id: selectedCommunity.id,target_user_id: member.user_id,
    });
    if (removeError) setCommunityError(removeError.message);
    else {
      if (memberGroupEditorId === member.user_id) { setMemberGroupEditorId(null); setMemberGroupOptions([]); setMemberGroupSelection([]); }
      await Promise.all([loadCommunityMembers(),loadCommunities(selectedCommunity.id),loadRooms()]);
      setCommunityNotice(l("Membrul a fost eliminat din comunitate.", "The member was removed from the community."));
    }
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
        .then((subscription) => setPushEnabled(Boolean(subscription) && (typeof Notification === "undefined" || Notification.permission === "granted")))
        .catch(() => setPushEnabled(false));
    }
    setSettingsTitle(room?.title || "");
    setNewMemberEmails("");
    setNewMemberHistoryAccess("new");
    setGroupPassword("");
    setProtectedContent(Boolean(room?.protected_content));
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

  async function openGroupInfo() {
    setGroupInfoTab("members");
    setGroupInfoOpen(true);
    await loadMembers();
  }

  async function saveProtectedContent(e) {
    e.preventDefault();
    if (!roomId || settingsBusy) return;
    setSettingsBusy(true); setSettingsError("");
    const { error: protectionError } = await supabase.rpc("set_conversation_protected_content", {
      target_conversation_id: roomId,
      enabled: protectedContent,
    });
    if (protectionError) setSettingsError(protectionError.message);
    else {
      setImageUrls({});
      await loadRooms(roomId);
    }
    setSettingsBusy(false);
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

  async function togglePushNotifications() {
    if (notificationBusy) return;
    setNotificationBusy(true);
    setSettingsError("");
    try {
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
        throw new Error(l("Acest browser nu acceptă notificări push.", "This browser does not support push notifications."));
      }
      const registration = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      let subscription = await registration.pushManager.getSubscription();

      if (pushEnabled) {
        if (subscription) {
          const response = await fetch("/api/push/subscribe", {
            method: "DELETE",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
            body: JSON.stringify({ endpoint: subscription.endpoint }),
          });
          if (!response.ok) throw new Error(l("Dezactivarea nu a reușit.", "Disabling notifications failed."));
          await subscription.unsubscribe();
        }
        setPushEnabled(false);
        setNotificationBusy(false);
        return;
      }

      const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!publicKey) throw new Error(l("Cheia publică pentru notificări nu este configurată.", "The public notification key is not configured."));
      const permission = await Notification.requestPermission();
      if (permission !== "granted") throw new Error(l("Notificările nu au fost permise.", "Notification permission was not granted."));

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
      target_conversation_id: roomId,
      member_emails: emails,
      include_message_history: newMemberHistoryAccess === "all",
    });
    if (addError) setSettingsError(addError.message);
    else {
      setNewMemberEmails("");
      setNewMemberHistoryAccess("new");
      await Promise.all([loadMembers(), loadRooms(roomId)]);
    }
    setSettingsBusy(false);
  }

  async function removeMember(member) {
    if (settingsBusy || !window.confirm(l(`Elimini ${member.email} din conversație?`, `Remove ${member.email} from the conversation?`, `Retirer ${member.email} de la conversation ?`, `¿Eliminar a ${member.email} de la conversación?`))) return;
    setSettingsBusy(true); setSettingsError("");
    const { error: removeError } = await supabase.rpc("remove_conversation_member", {
      target_conversation_id: roomId, target_user_id: member.user_id,
    });
    if (removeError) setSettingsError(removeError.message);
    else await Promise.all([loadMembers(), loadRooms(roomId)]);
    setSettingsBusy(false);
  }

  async function toggleAdmin(member) {
    if (settingsBusy || !window.confirm(member.is_admin ? l(`Retragi rolul de administrator pentru ${member.email}?`, `Remove administrator access from ${member.email}?`, `Retirer le rôle d’administrateur à ${member.email} ?`, `¿Quitar el rol de administrador a ${member.email}?`) : l(`Acordezi rolul de administrator lui ${member.email}?`, `Grant administrator access to ${member.email}?`, `Accorder le rôle d’administrateur à ${member.email} ?`, `¿Conceder el rol de administrador a ${member.email}?`))) return;
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
    <a className="skipLink" href="#conversation-content">{l("Sari la conversație", "Skip to conversation")}</a>
    <aside id="group-menu" aria-label={l("Comunități și conversații", "Communities and conversations")} className={`side ${mobileMenuOpen ? "open" : ""}`}>
      <div className="brandRow"><div><p className="eyebrow">eClinTalk</p><h2>{t("myConversations")}</h2></div><div className="brandActions"><button className="mobileCloseBtn" onClick={() => setMobileMenuOpen(false)} aria-label={l("Închide meniul", "Close menu")}>×</button></div></div>
      <div className="communityNav">
        <button aria-pressed={selectedCommunityId === "all"} className={selectedCommunityId === "all" ? "selected" : ""} onClick={() => chooseCommunity("all")}>▦ {t("allConversations")}</button>
        <div className="communityNavTitle"><strong>{t("communities")}</strong>{isGeneralAdmin && <button title={l("Creează o comunitate", "Create a community")} aria-label={l("Creează o comunitate", "Create a community")} onClick={() => setCommunityModal(true)}>＋</button>}</div>
        {communities.length === 0 && <p className="communityEmpty">{l("Nu faci parte încă dintr-o comunitate.", "You are not part of a community yet.")}</p>}
        {communities.map((item) => <button key={item.id} aria-pressed={selectedCommunityId === item.id} className={selectedCommunityId === item.id ? "selected" : ""} onClick={() => chooseCommunity(item.id)}>
          <span>◉</span><div><strong>{item.name}</strong><small>{item.group_count} {l("grupuri", "groups")} · {item.member_count} {t("members")}</small></div>
        </button>)}
        {rooms.some((item) => !item.community_id) && <button aria-pressed={selectedCommunityId === "private"} className={selectedCommunityId === "private" ? "selected" : ""} onClick={() => chooseCommunity("private")}>◇ {t("otherGroups")}</button>}
      </div>
      {(selectedCommunity?.my_is_admin || isGeneralAdmin) && <button className="manageCommunityBtn" onClick={openCommunitySettings}><Icon name="users" size={16}/>{l("Membri și setări", "Members and settings")}</button>}
      {canCreateGroup && <button className="primary newBtn" onClick={() => setModal(true)}>{selectedCommunity ? l(`+ Grup nou în ${selectedCommunity.name}`, `+ New group in ${selectedCommunity.name}`, `+ Nouveau groupe dans ${selectedCommunity.name}`, `+ Nuevo grupo en ${selectedCommunity.name}`) : t("newGroup")}</button>}
      <label className="roomSearch"><Icon name="search" size={16}/><input value={roomSearch} onChange={(event) => setRoomSearch(event.target.value)} placeholder={l("Caută grupuri", "Search groups")} aria-label={l("Caută grupuri", "Search groups")} /></label>
      <nav className="conversationList" aria-label={l("Lista conversațiilor", "Conversation list")}>
        {loading && <p className="status">{t("loading")}</p>}
        {!loading && filteredVisibleRooms.length === 0 && <p className="emptySide">{roomSearch ? l("Niciun grup nu corespunde căutării.", "No groups match your search.") : l("Nu ai conversații în această secțiune.", "You have no conversations in this section.")}</p>}
        {filteredVisibleRooms.map((item) => <div className="conversationEntry" key={item.id}>
          <button aria-current={item.id === roomId ? "page" : undefined} className={`conv ${item.id === roomId ? "active" : ""} ${!item.password_protected && item.unread_count > 0 ? "unread" : ""}`} onClick={() => chooseRoom(item.id)}>
            <span>{item.title.slice(0, 2).toUpperCase()}</span><div><strong className="conversationTitle">{item.is_pinned && <Icon name="pin" size={12}/>}<span>{item.title}</span>{!item.password_protected && item.unread_count > 0 && <i className="unreadBadge">{item.unread_count > 99 ? "99+" : item.unread_count}</i>}</strong><small>{item.member_count} {t("members")} · {item.community_name || t("groupWithoutCommunity")}</small></div>
          </button>
          <button type="button" className="conversationHoverTrigger" aria-label={l("Acțiuni pentru conversație", "Conversation actions", "Actions de la conversation", "Acciones de la conversación")} aria-expanded={actionRoom?.id === item.id} onClick={() => setActionRoom((current) => current?.id === item.id ? null : item)}><Icon name="chevronDown" size={17}/></button>
          {actionRoom?.id === item.id && <div className="conversationQuickMenu"><button type="button" onClick={() => chooseRoom(item.id)}>{l("Deschide conversația", "Open conversation", "Ouvrir la conversation", "Abrir conversación")}</button><button type="button" onClick={async () => { setActionRoom(null); await toggleGroupPin(item.id); }}>{item.is_pinned ? l("Scoate pinul", "Unpin", "Désépingler", "Desfijar") : l("Fixează conversația", "Pin conversation", "Épingler la conversation", "Fijar conversación")}</button></div>}
        </div>)}
      </nav>
      <div className="sideFooter"><button className="profileBtn" onClick={openProfile}><strong>{profileName || session.user.email}</strong><small>{t("profile")} · {isGeneralAdmin ? t("generalAdmin") : t("connected")}</small></button><button className="logoutBtn" onClick={signOut} title={t("logout")}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 5H5v14h5M14 8l4 4-4 4M8 12h10" /></svg><span>{t("logout")}</span></button><button className="feedbackBtn" onClick={() => { setFeedbackNotice(""); setFeedbackOpen(true); }}>💬 {l("Feedback", "Feedback", "Avis", "Comentarios")}</button><p className="poweredBy sideCredit">{t("createdBy")}</p></div>
    </aside>
    {mobileMenuOpen && <button className="sideBackdrop" onClick={() => setMobileMenuOpen(false)} aria-label={l("Închide meniul", "Close menu")} />}
    {inviteStatus && <div className="inviteToast" role="status"><span>{inviteStatus}</span><button onClick={() => setInviteStatus("")} aria-label={l("Închide", "Close")}>×</button></div>}
    <section id="conversation-content" tabIndex="-1" aria-label={room ? l(`Conversația ${room.title}`, `${room.title} conversation`, `Conversation ${room.title}`, `Conversación ${room.title}`) : t("yourConversations")} className={`chat ${room ? "" : "chatEmpty"} ${conversationSearchOpen ? "searchOpen" : ""}`} onTouchStart={chatTouchStart} onTouchEnd={chatTouchEnd}>
      {room ? <><header><button className="mobileMenuBtn iconTextBtn" onClick={() => setMobileMenuOpen(true)} aria-controls="group-menu" aria-expanded={mobileMenuOpen}><Icon name="menu"/><span className="srOnly">{l("Meniu", "Menu")}</span></button><div className="headerMain"><button className="groupInfoButton" onClick={openGroupInfo} title={l("Deschide informațiile grupului", "Open group information", "Ouvrir les informations du groupe", "Abrir la información del grupo")}><strong>{room.title}</strong><small>{room.member_count} {t("members")} · {room.community_name || t("groupWithoutCommunity")} · {room.protected_content ? `🛡 ${l("conținut protejat", "protected content", "contenu protégé", "contenido protegido")}` : l("numai membrii au acces", "members only")}</small></button></div><div className="headerActions"><b>● {l("Privat", "Private")}</b><button className={`iconTextBtn ${conversationSearchOpen ? "active" : ""}`} onClick={() => setConversationSearchOpen((current) => !current)}><Icon name="search" size={16}/>{l("Caută", "Search", "Rechercher", "Buscar")}</button><button className={`iconTextBtn ${pinnedOnly ? "active" : ""}`} onClick={() => setPinnedOnly((current) => !current)}><Icon name="pin" size={16}/>{l("Fixate", "Pinned", "Épinglés", "Fijados")}</button><button className="iconTextBtn" onClick={() => toggleGroupPin()}><Icon name="pin" size={16}/>{room.is_pinned ? l("Fixat", "Pinned") : "Pin"}</button><button className="iconTextBtn" onClick={openSettings}><Icon name="settings" size={16}/>{l("Setări", "Settings")}</button></div></header>
        <div className="warning" role="note"><span aria-hidden="true">⚠</span>{t("testWarning")}</div>
        {conversationSearchOpen && <div className="conversationSearchBar"><Icon name="search" size={17}/><input autoFocus value={conversationSearch} onChange={(event) => setConversationSearch(event.target.value)} placeholder={l("Caută mesaje, persoane sau fișiere", "Search messages, people, or files", "Rechercher des messages, personnes ou fichiers", "Buscar mensajes, personas o archivos")} /><button onClick={() => { setConversationSearch(""); setConversationSearchOpen(false); }} aria-label={l("Închide căutarea", "Close search", "Fermer la recherche", "Cerrar búsqueda")}>×</button></div>}
        <div className="msgs" role="log" aria-live="polite" aria-relevant="additions text" aria-label={l("Mesaje", "Messages")}>
          {pinnedMessages.length > 0 && <div className="pinnedArea">
            <button className="pinnedBanner" onClick={() => pinnedMessages.length === 1 ? scrollToMessage(pinnedMessages[0].id) : setPinnedOpen(!pinnedOpen)}>
              <Icon name="pin" size={17}/><span>{pinnedMessages.length} {pinnedMessages.length === 1 ? l("mesaj fixat", "pinned message") : l("mesaje fixate", "pinned messages")}</span><span className="pinChevron">{pinnedMessages.length > 1 ? (pinnedOpen ? "▲" : "▼") : "›"}</span>
            </button>
            {pinnedOpen && pinnedMessages.length > 1 && <div className="pinnedList">
              {pinnedMessages.map((item, index) => <button key={item.id} onClick={() => scrollToMessage(item.id)}>
                <span>📌</span><div><strong>{l("Mesaj fixat", "Pinned message")} {index + 1}</strong><small>{item.body || (item.attachment_path ? l("📷 Imagine", "📷 Image") : item.attachment_name || l("Mesaj", "Message"))}</small></div>
              </button>)}
            </div>}
          </div>}
          {visibleMessages.length === 0 && !error && <p className="status">{messages.length ? l("Nu mai există mesaje vizibile pentru tine.", "There are no messages visible to you.", "Il n’y a plus de messages visibles pour vous.", "Ya no hay mensajes visibles para ti.") : l("Trimite primul mesaj.", "Send the first message.")}</p>}
          {visibleMessages.length > 0 && displayedMessages.length === 0 && <p className="status">{l("Nu există mesaje care corespund filtrului.", "No messages match this filter.", "Aucun message ne correspond à ce filtre.", "Ningún mensaje coincide con este filtro.")}</p>}
          {displayedMessages.map((item,index) => { const mine = item.user_id === session.user.id; const replied = messages.find((x) => x.id === item.reply_to_id); const itemReactions = groupedReactions(item.id); const receipt = receiptForMessage(item); const showDay = index===0 || new Date(displayedMessages[index-1].created_at).toDateString()!==new Date(item.created_at).toDateString(); return <Fragment key={item.id}>
            {showDay && <div className="dayDivider" role="separator"><span>{dayLabel(item.created_at,language)}</span></div>}
            {item.id===unreadBoundaryId && <div className="unreadDivider" role="separator"><span>{l("Mesaje noi", "New messages")}</span></div>}
            <div ref={(node) => { messageRefs.current[item.id] = node; }} className={`messageWrap ${mine ? "mine" : ""}`} onPointerDown={(event) => startMessageLongPress(event,item)} onPointerMove={moveMessageLongPress} onPointerUp={endMessageLongPress} onPointerCancel={endMessageLongPress} onClickCapture={suppressLongPressClick} onContextMenu={(event) => { event.preventDefault(); setActionMessage(item); }}>
            <div className={`bubble ${mine ? "mine" : ""} ${item.attachment_path ? "hasImage" : ""} ${isMessagePinned(item) ? "pinnedMessage" : ""} ${item.deleted_at ? "deletedMessage" : ""}`}>
              {item.deleted_at ? <p className="deletedText">{l("Mesaj șters", "Deleted message")}</p> : <>
                {!mine && <strong className="sender">{displayNameForUser(item.user_id, item.sender_email)}</strong>}
                {item.forwarded_from_message_id && <span className="forwardedMark"><Icon name="forward" size={13}/>{l("Redirecționat", "Forwarded", "Transféré", "Reenviado")} · {item.forwarded_from_sender}</span>}
                {isMessagePinned(item) && <span className="pinMark"><Icon name="pin" size={14}/></span>}
                {item.reply_to_id && <button className="replyQuote" onClick={() => scrollToMessage(item.reply_to_id)}>
                  <strong>{replied ? displayNameForUser(replied.user_id, replied.sender_email) : l("Mesaj anterior", "Previous message")}</strong><span>{replied?.deleted_at ? l("Mesaj șters", "Deleted message") : replied?.body || replied?.attachment_name || (replied?.attachment_path ? l("Fișier atașat", "Attached file", "Fichier joint", "Archivo adjunto") : l("Mesaj indisponibil", "Message unavailable"))}</span>
                  {!replied?.deleted_at && replied?.attachment_path && (replied.attachment_type || "").startsWith("image/") && imageUrls[replied.attachment_path] && <img draggable={room.protected_content ? false : undefined} src={imageUrls[replied.attachment_path]} alt={l("Imagine citată", "Quoted image")} />}
                </button>}
                {item.attachment_path && imageUrls[item.attachment_path] && ((item.attachment_type || "").startsWith("image/") ? (room.protected_content ? <button type="button" className="mediaViewerButton protectedMedia" onContextMenu={(e) => e.preventDefault()} onClick={() => openImageViewer(item)}><img draggable="false" className="chatImage" src={imageUrls[item.attachment_path]} alt={item.attachment_name || l("Imagine atașată", "Attached image")} /><span className="mediaWatermark" aria-hidden="true">{protectedWatermark}</span><span className="openMediaHint"><Icon name="zoom" size={15}/></span></button> : <button type="button" className="mediaViewerButton" onClick={() => openImageViewer(item)}><img className="chatImage" src={imageUrls[item.attachment_path]} alt={item.attachment_name || l("Imagine atașată", "Attached image")} /><span className="openMediaHint"><Icon name="zoom" size={15}/></span></button>) : <a className="fileAttachment" href={imageUrls[item.attachment_path]} target="_blank" rel="noreferrer" onContextMenu={room.protected_content ? (e) => e.preventDefault() : undefined}><span aria-hidden="true">📄</span><span><strong>{item.attachment_name || l("Fișier atașat", "Attached file")}</strong><small>{item.attachment_size ? `${Math.max(1, Math.round(item.attachment_size / 1024))} KB` : l("Deschide fișierul", "Open file")}</small></span></a>)}
                {item.attachment_path && !imageUrls[item.attachment_path] && <p className="imageLoading">{l("Se încarcă fișierul...", "Loading file...", "Chargement du fichier…", "Cargando archivo…")}</p>}
                {item.body && <p><LinkifiedText text={item.body} /></p>}
              </>}<small className="messageMeta">{time(item.created_at, language)} {mine && <button type="button" className={receipt.seen.length ? "readReceipt seen" : "readReceipt"} onClick={() => openReceipts(item)} aria-label={l("Informații de citire", "Read information", "Informations de lecture", "Información de lectura")}>{receipt.seen.length ? "✓✓" : "✓"}</button>}</small>
            </div>
            {!item.deleted_at && <button type="button" className="messageHoverTrigger" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); setActionMessage(item); }} aria-label={l("Acțiuni pentru mesaj", "Message actions", "Actions du message", "Acciones del mensaje")}><Icon name="chevronDown" size={17}/></button>}
            {!item.deleted_at && Object.keys(itemReactions).length > 0 && <div className="reactionSummary">{Object.entries(itemReactions).map(([emoji, info]) => <button aria-label={l(`${info.count} reacții ${emoji}`, `${info.count} ${emoji} reactions`, `${info.count} réactions ${emoji}`, `${info.count} reacciones ${emoji}`)} className={info.mine ? "mine" : ""} key={emoji} onClick={() => reactToMessage(item.id, emoji)}>{emoji} {info.count}</button>)}</div>}
          </div></Fragment>; })}<div ref={bottom} />
        </div>
        <div>{error && <p className="chatError" role="alert">{error}</p>}<form className="composer" onSubmit={send} aria-label={l("Scrie un mesaj", "Write a message")}>
	          {replyTo && <div className="selectedReply"><div><strong>{l("Răspuns către", "Reply to")} {displayNameForUser(replyTo.user_id, replyTo.sender_email)}</strong><span>{replyTo.body || replyTo.attachment_name || (replyTo.attachment_path ? l("Fișier atașat", "Attached file", "Fichier joint", "Archivo adjunto") : l("Mesaj", "Message"))}</span></div>{replyTo.attachment_path && (replyTo.attachment_type || "").startsWith("image/") && imageUrls[replyTo.attachment_path] && <img draggable={room.protected_content ? false : undefined} src={imageUrls[replyTo.attachment_path]} alt={l("Imagine selectată pentru răspuns", "Image selected for reply")} />}<button type="button" onClick={() => setReplyTo(null)} aria-label={l("Anulează răspunsul", "Cancel reply")}>×</button></div>}
          <input ref={fileInput} className="fileInput" type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf,.doc,.docx,.xls,.xlsx,.txt" onChange={chooseFile} />
          <button className="attachBtn" type="button" onClick={() => fileInput.current?.click()} disabled={sending} title={l("Atașează imagine sau fișier", "Attach image or file", "Joindre une image ou un fichier", "Adjuntar imagen o archivo")} aria-label={l("Atașează imagine sau fișier", "Attach image or file", "Joindre une image ou un fichier", "Adjuntar imagen o archivo")}><Icon name="attachment" size={20}/></button>
          <button className={`emojiBtn ${emojiOpen ? "active" : ""}`} type="button" onClick={() => setEmojiOpen(!emojiOpen)} disabled={sending} title={l("Emoticoane", "Emoji")} aria-label={l("Emoticoane", "Emoji")}><Icon name="smile" size={20}/></button>
	          <input ref={messageInput} aria-label={l("Mesaj", "Message")} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={t("messagePlaceholder")} maxLength={4000} disabled={sending} autoComplete="off" />
	          <button className="primary sendBtn iconTextBtn" disabled={sending || (!draft.trim() && !attachment)}><Icon name="send" size={17}/><span>{sending ? t("sending") : t("send")}</span></button>
	          {mentionMatch && <div className="mentionPicker" role="listbox" aria-label={t("mentionHint")}>
	            {mentionSuggestions.length ? mentionSuggestions.map((member) => <button type="button" key={member.user_id} onClick={() => insertMention(member)}><span className="mentionAvatar">{(member.display_name || member.email).slice(0, 2).toUpperCase()}</span><span><strong>{member.display_name || member.email.split("@")[0]}</strong><small>{member.email}</small></span></button>) : <p>{l("Niciun membru găsit", "No matching member", "Aucun membre trouvé", "No se encontró ningún miembro")}</p>}
	          </div>}
          {emojiOpen && <div className="emojiPicker" role="dialog" aria-label={l("Selector de emoticoane", "Emoji picker")}><div className="emojiTabs" role="tablist">{emojiTabs.map((category) => <button role="tab" aria-selected={emojiCategory===category.id} className={emojiCategory===category.id ? "active" : ""} type="button" key={category.id} onClick={() => setEmojiCategory(category.id)} title={l(category.ro,category.en,category.fr,category.es)}>{category.icon}<span>{l(category.ro,category.en,category.fr,category.es)}</span></button>)}</div><div className="emojiGrid">{activeEmojiItems.map((emoji) => <button aria-label={l(`Adaugă ${emoji}`, `Add ${emoji}`, `Ajouter ${emoji}`, `Añadir ${emoji}`)} type="button" key={emoji} onClick={() => insertEmoji(emoji)}>{emoji}</button>)}</div></div>}
          {attachment && <div className="selectedFile"><span>{attachment.name}</span><button type="button" aria-label={l("Elimină atașamentul", "Remove attachment")} onClick={() => { setAttachment(null); if (fileInput.current) fileInput.current.value = ""; }}>×</button></div>}
        </form></div></> :
	        <><div className="mobileWelcomeBar"><button className="mobileMenuBtn iconTextBtn" onClick={() => setMobileMenuOpen(true)} aria-controls="group-menu" aria-expanded={mobileMenuOpen}><Icon name="menu"/><span>{t("myConversations")}</span></button></div><div className="welcome conversationHome"><div className="logo">eC</div><h2>{selectedCommunity?.name || t("yourConversations")}</h2><p>{visibleRooms.length ? t("chooseConversation") : t("noConversations")}</p>
	          {visibleRooms.length > 0 && <div className="homeConversationList">{visibleRooms.map((item) => <div className="conversationEntry homeConversationEntry" key={item.id}><button className={`homeConversationButton ${!item.password_protected && item.unread_count > 0 ? "unread" : ""}`} onClick={() => chooseRoom(item.id)}><span>{item.title.slice(0,2).toUpperCase()}</span><div><strong className="conversationTitle">{item.is_pinned && <Icon name="pin" size={12}/>}<span>{item.title}</span>{!item.password_protected && item.unread_count > 0 && <i className="unreadBadge">{item.unread_count > 99 ? "99+" : item.unread_count}</i>}</strong><small>{item.member_count} {t("members")} · {item.community_name || t("groupWithoutCommunity")}</small></div></button><button type="button" className="conversationHoverTrigger" aria-label={l("Acțiuni pentru conversație", "Conversation actions", "Actions de la conversation", "Acciones de la conversación")} aria-expanded={actionRoom?.id === item.id} onClick={() => setActionRoom((current) => current?.id === item.id ? null : item)}><Icon name="chevronDown" size={17}/></button>{actionRoom?.id === item.id && <div className="conversationQuickMenu"><button type="button" onClick={() => chooseRoom(item.id)}>{l("Deschide conversația", "Open conversation", "Ouvrir la conversation", "Abrir conversación")}</button><button type="button" onClick={async () => { setActionRoom(null); await toggleGroupPin(item.id); }}>{item.is_pinned ? l("Scoate pinul", "Unpin", "Désépingler", "Desfijar") : l("Fixează conversația", "Pin conversation", "Épingler la conversation", "Fijar conversación")}</button></div>}</div>)}</div>}
	          {!visibleRooms.length && canCreateGroup && <button className="primary" onClick={() => setModal(true)}>{t("firstGroup")}</button>}{error && <p className="chatError" role="alert">{error}</p>}</div></>}
    </section>
    {viewerMessage && imageUrls[viewerMessage.attachment_path] && <div className="mediaViewerBackdrop" onMouseDown={closeImageViewer}><section className="mediaViewer" style={{ transform: `translateY(${viewerDismissY}px)`, opacity: Math.max(.35,1-viewerDismissY/500) }} role="dialog" aria-modal="true" aria-label={l("Vizualizator imagine", "Image viewer", "Visionneuse d’image", "Visor de imágenes")} onMouseDown={(event) => event.stopPropagation()}>
      <div className="mediaViewerToolbar"><span>{viewerMessage.attachment_name || l("Imagine", "Image", "Image", "Imagen")}</span><div><small className="viewerTouchHint">{l("Zoom cu două degete · glisează în jos pentru închidere", "Pinch to zoom · swipe down to close", "Pincez pour zoomer · glissez vers le bas pour fermer", "Pellizca para ampliar · desliza hacia abajo para cerrar")}</small><small className="viewerDesktopHint">{l("Mărește, apoi trage imaginea pentru deplasare", "Zoom, then drag the image to pan", "Zoomez, puis faites glisser l’image", "Amplía y arrastra la imagen para moverla")}</small><div className="viewerDesktopControls" role="group" aria-label={l("Comenzi zoom", "Zoom controls", "Commandes de zoom", "Controles de zoom")}><button type="button" disabled={viewerZoom <= 1} onClick={() => changeViewerZoom(-0.25)} aria-label={l("Micșorează", "Zoom out", "Réduire", "Alejar")}>−</button><button type="button" className="viewerZoomValue" disabled={viewerZoom === 1} onClick={resetViewerZoom} aria-label={l("Revino la dimensiunea inițială", "Reset zoom", "Réinitialiser le zoom", "Restablecer zoom")}>{Math.round(viewerZoom*100)}%</button><button type="button" disabled={viewerZoom >= 4} onClick={() => changeViewerZoom(0.25)} aria-label={l("Mărește", "Zoom in", "Agrandir", "Acercar")}>+</button></div><strong className="viewerTouchZoom">{Math.round(viewerZoom*100)}%</strong>{!room?.protected_content && <button type="button" className="viewerShareButton" aria-label={l("Distribuie sau caută imaginea", "Share or search image", "Partager ou rechercher l’image", "Compartir o buscar imagen")} aria-expanded={viewerShareOpen} onClick={() => { setViewerShareNotice(""); setViewerShareOpen((current) => !current); }}><Icon name="share" size={19}/></button>}<button type="button" className="viewerDesktopClose" onClick={closeImageViewer} aria-label={l("Închide imaginea", "Close image", "Fermer l’image", "Cerrar imagen")}><Icon name="close" size={18}/></button></div></div>
      {viewerShareOpen && !room?.protected_content && <div className="viewerShareMenu" role="dialog" aria-label={l("Opțiuni pentru imagine", "Image options", "Options de l’image", "Opciones de imagen")} onMouseDown={(event) => event.stopPropagation()}>
        <div className="viewerShareTitle"><div><strong>{l("Distribuie imaginea", "Share image", "Partager l’image", "Compartir imagen")}</strong><small>{l("Alege destinația", "Choose a destination", "Choisissez une destination", "Elige un destino")}</small></div><button type="button" onClick={() => setViewerShareOpen(false)} aria-label={l("Închide", "Close", "Fermer", "Cerrar")}><Icon name="close" size={17}/></button></div>
        <button type="button" disabled={viewerShareBusy} onClick={shareViewerImage}><Icon name="share" size={19}/><span><strong>{l("WhatsApp sau altă aplicație", "WhatsApp or another app", "WhatsApp ou une autre application", "WhatsApp u otra aplicación")}</strong><small>{l("Folosește meniul dispozitivului", "Use the device share menu", "Utilise le menu de partage de l’appareil", "Usa el menú para compartir del dispositivo")}</small></span></button>
        <button type="button" disabled={viewerShareBusy} onClick={() => openExternalImageTool("web")}><Icon name="search" size={19}/><span><strong>{l("Caută imaginea pe web", "Search image on the web", "Rechercher l’image sur le web", "Buscar imagen en la web")}</strong><small>Google Lens</small></span></button>
        <button type="button" disabled={viewerShareBusy} onClick={() => openExternalImageTool("chatgpt")}><span className="viewerToolMark">C</span><span><strong>ChatGPT</strong><small>{l("Deschide și atașează imaginea", "Open and attach the image", "Ouvrir et joindre l’image", "Abrir y adjuntar la imagen")}</small></span></button>
        <button type="button" disabled={viewerShareBusy} onClick={() => openExternalImageTool("claude")}><span className="viewerToolMark">A</span><span><strong>Claude</strong><small>{l("Deschide și atașează imaginea", "Open and attach the image", "Ouvrir et joindre l’image", "Abrir y adjuntar la imagen")}</small></span></button>
        {viewerShareNotice && <p role="status">{viewerShareNotice}</p>}
        <small className="viewerPrivacyNote">{l("Nu distribui date medicale sau personale fără o bază legală și acordurile necesare.", "Do not share medical or personal data without a lawful basis and the required approvals.", "Ne partagez pas de données médicales ou personnelles sans base légale et autorisations nécessaires.", "No compartas datos médicos o personales sin una base legal y las autorizaciones necesarias.")}</small>
      </div>}
      <div className={`mediaViewerCanvas ${room?.protected_content ? "protected" : ""}`} onPointerDown={viewerPointerDown} onPointerMove={viewerPointerMove} onPointerUp={viewerPointerUp} onPointerCancel={viewerPointerUp} onContextMenu={room?.protected_content ? (event) => event.preventDefault() : undefined}><img draggable={false} style={{ transform: `translate3d(${viewerPan.x}px,${viewerPan.y}px,0) scale(${viewerZoom})` }} src={imageUrls[viewerMessage.attachment_path]} alt={viewerMessage.attachment_name || l("Imagine", "Image")} />{room?.protected_content && <span className="viewerWatermark">{protectedWatermark}</span>}</div>
    </section></div>}
    {actionMessage && !actionMessage.deleted_at && <div className="messageActionBackdrop" onMouseDown={() => setActionMessage(null)}><section className="messageActionSheet" role="dialog" aria-modal="true" aria-label={l("Acțiuni pentru mesaj", "Message actions", "Actions du message", "Acciones del mensaje")} onMouseDown={(event) => event.stopPropagation()}>
      <div className="quickReactions" role="group" aria-label={l("Reacții rapide", "Quick reactions", "Réactions rapides", "Reacciones rápidas")}>{REACTION_EMOJIS.slice(0,5).map((emoji) => <button type="button" aria-label={l(`Reacție ${emoji}`, `React ${emoji}`, `Réagir avec ${emoji}`, `Reaccionar con ${emoji}`)} key={emoji} onClick={() => { reactToMessage(actionMessage.id, emoji); setActionMessage(null); }}>{emoji}</button>)}<button type="button" className="moreReactionsBtn" aria-expanded={actionReactionsExpanded} aria-label={l("Mai multe reacții", "More reactions", "Plus de réactions", "Más reacciones")} onClick={() => setActionReactionsExpanded((current) => !current)}>＋</button></div>
      {actionReactionsExpanded && <div className="allReactionGrid" role="group" aria-label={l("Toate reacțiile", "All reactions", "Toutes les réactions", "Todas las reacciones")}>{ALL_REACTION_EMOJIS.map((emoji) => <button type="button" aria-label={l(`Reacție ${emoji}`, `React ${emoji}`, `Réagir avec ${emoji}`, `Reaccionar con ${emoji}`)} key={emoji} onClick={() => { reactToMessage(actionMessage.id, emoji); setActionMessage(null); }}>{emoji}</button>)}</div>}
      <div className="messageActionList">
        <button type="button" onClick={() => { setReplyTo(actionMessage); setActionMessage(null); }}><Icon name="reply" size={19}/><span>{l("Răspunde", "Reply", "Répondre", "Responder")}</span></button>
        <button type="button" onClick={() => { const selected = actionMessage; setActionMessage(null); openForward(selected); }}><Icon name="forward" size={19}/><span>{l("Redirecționează", "Forward", "Transférer", "Reenviar")}</span></button>
        {!room?.protected_content && <button type="button" onClick={() => shareMessage(actionMessage)}><Icon name="share" size={19}/><span>{l("Distribuie", "Share", "Partager", "Compartir")}</span></button>}
        {actionMessage.body && <button type="button" onClick={() => copyMessageText(actionMessage)}><Icon name="copy" size={19}/><span>{l("Copiază textul", "Copy text", "Copier le texte", "Copiar texto")}</span></button>}
        <button type="button" onClick={() => { const selected = actionMessage; setActionMessage(null); openReceipts(selected); }}><Icon name="info" size={19}/><span>{l("Informații", "Information", "Informations", "Información")}</span></button>
        <button type="button" onClick={() => { togglePersonalMessagePin(actionMessage.id); setActionMessage(null); }}><Icon name="pin" size={19}/><span>{preferenceForMessage(actionMessage.id)?.pinned_at ? l("Scoate din fixatele mele", "Unpin for me", "Désépingler pour moi", "Desfijar para mí") : l("Fixează pentru mine", "Pin for me", "Épingler pour moi", "Fijar para mí")}</span></button>
        <button type="button" onClick={() => { toggleGlobalMessagePin(actionMessage.id); setActionMessage(null); }}><Icon name="pin" size={19}/><span>{actionMessage.pinned_at ? l("Scoate din fixatele tuturor", "Unpin for everyone", "Désépingler pour tous", "Desfijar para todos") : l("Fixează pentru toți", "Pin for everyone", "Épingler pour tous", "Fijar para todos")}</span></button>
        <button type="button" className="dangerAction" onClick={() => { const selected = actionMessage; setActionMessage(null); hideMessageForMe(selected); }}><Icon name="trash" size={19}/><span>{l("Șterge pentru mine", "Delete for me", "Supprimer pour moi", "Eliminar para mí")}</span></button>
        {actionMessage.user_id === session.user.id && <button type="button" className="dangerAction" disabled={deletingMessageId === actionMessage.id} onClick={() => { const selected = actionMessage; setActionMessage(null); deleteMessage(selected); }}><Icon name="trash" size={19}/><span>{l("Șterge pentru toți", "Delete for everyone", "Supprimer pour tous", "Eliminar para todos")}</span></button>}
      </div>
      <button type="button" className="messageActionCancel" onClick={() => setActionMessage(null)}>{l("Închide", "Close", "Fermer", "Cerrar")}</button>
    </section></div>}
    {forwardMessage && <div className="modalBackdrop" onMouseDown={() => !forwardBusy && setForwardMessage(null)}>
      <section className="modal passwordModal forwardModal" role="dialog" aria-modal="true" aria-labelledby="forward-title" onMouseDown={(event) => event.stopPropagation()}>
        <div className="modalTitle"><div><p className="eyebrow">eClinTalk</p><h2 id="forward-title">{l("Redirecționează", "Forward", "Transférer", "Reenviar")}</h2></div><button className="iconBtn" disabled={forwardBusy} onClick={() => setForwardMessage(null)}>×</button></div>
        <form className="form" onSubmit={confirmForward}>
          <p className="muted forwardPreview">{forwardMessage.body || forwardMessage.attachment_name || l("Mesaj cu atașament", "Message with attachment", "Message avec pièce jointe", "Mensaje con archivo adjunto")}</p>
          <label className="forwardSearchLabel">{l("Caută grupul destinație", "Search destination group", "Rechercher le groupe de destination", "Buscar grupo de destino")}
            <span className="forwardSearchField"><Icon name="search" size={18}/><input autoFocus type="search" value={forwardSearch} onChange={(event) => setForwardSearch(event.target.value)} placeholder={l("Scrie numele grupului sau comunității", "Type a group or community name", "Saisissez le nom du groupe ou de la communauté", "Escribe el nombre del grupo o comunidad")} /></span>
          </label>
          <div className="forwardTargetList" role="radiogroup" aria-label={l("Grupul destinație", "Destination group", "Groupe de destination", "Grupo de destino")}>
            {filteredForwardTargets.map((target) => <button type="button" role="radio" aria-checked={forwardTargetId === target.id} className={forwardTargetId === target.id ? "selected" : ""} key={target.id} onClick={() => setForwardTargetId(target.id)}><span className="forwardTargetAvatar">{target.title.slice(0,2).toUpperCase()}</span><span><strong>{target.protected_content ? "🛡 " : ""}{target.title}</strong><small>{target.community_name || t("groupWithoutCommunity")}</small></span><b>{forwardTargetId === target.id ? "✓" : ""}</b></button>)}
            {forwardTargets.length > 0 && filteredForwardTargets.length === 0 && <p className="forwardEmpty">{l("Nu am găsit niciun grup.", "No groups found.", "Aucun groupe trouvé.", "No se encontró ningún grupo.")}</p>}
          </div>
          {room?.protected_content && <p className="protectedContentNotice">🛡 {l("Acest mesaj poate fi redirecționat numai către un alt grup cu Conținut protejat activ.", "This message can only be forwarded to another group with Protected content enabled.", "Ce message ne peut être transféré que vers un autre groupe protégé.", "Este mensaje solo puede reenviarse a otro grupo protegido.")}</p>}
          {!forwardTargets.length && <p className="error">{l("Nu există niciun grup eligibil pentru redirecționare.", "There is no eligible group for forwarding.", "Aucun groupe n’est disponible pour le transfert.", "No hay ningún grupo disponible para reenviar.")}</p>}
          <div className="modalActions"><button type="button" disabled={forwardBusy} onClick={() => setForwardMessage(null)}>{t("cancel")}</button><button className="primary" disabled={forwardBusy || !forwardTargetId}>{forwardBusy ? l("Se redirecționează...", "Forwarding...", "Transfert…", "Reenviando…") : l("Redirecționează", "Forward", "Transférer", "Reenviar")}</button></div>
        </form>
      </section>
    </div>}
    {receiptMessage && (() => { const details=receiptForMessage(receiptMessage); return <div className="modalBackdrop" onMouseDown={() => setReceiptMessage(null)}><section className="modal receiptModal" role="dialog" aria-modal="true" aria-labelledby="receipt-title" onMouseDown={(event) => event.stopPropagation()}><div className="modalTitle"><div><p className="eyebrow">{l("Mesaj", "Message", "Message", "Mensaje")}</p><h2 id="receipt-title">{l("Informații de citire", "Read information", "Informations de lecture", "Información de lectura")}</h2></div><button className="iconBtn" onClick={() => setReceiptMessage(null)}>×</button></div><div className="receiptSection"><h3>✓✓ {l("Văzut de", "Seen by", "Vu par", "Visto por")} <small>{details.seen.length}</small></h3>{details.seen.length ? details.seen.map((marker) => <div className="receiptPerson" key={marker.user_id}><span className="memberAvatar">{(marker.display_name || marker.email).slice(0,2).toUpperCase()}</span><div><strong>{marker.display_name || marker.email}</strong><small>{new Date(marker.last_read_at).toLocaleString(LANGUAGE_LOCALES[language])}</small></div></div>) : <p className="muted">{l("Niciun destinatar nu a văzut încă mesajul.", "No recipient has seen the message yet.", "Aucun destinataire n’a encore vu le message.", "Ningún destinatario ha visto aún el mensaje.")}</p>}</div><div className="receiptSection"><h3>○ {l("Nevăzut de", "Not seen by", "Non vu par", "No visto por")} <small>{details.unseen.length}</small></h3>{details.unseen.map((marker) => <div className="receiptPerson" key={marker.user_id}><span className="memberAvatar">{(marker.display_name || marker.email).slice(0,2).toUpperCase()}</span><div><strong>{marker.display_name || marker.email}</strong><small>{marker.email}</small></div></div>)}</div></section></div>; })()}
    {feedbackOpen && <div className="modalBackdrop" onMouseDown={() => !feedbackBusy && setFeedbackOpen(false)}><section className="modal passwordModal" role="dialog" aria-modal="true" aria-labelledby="feedback-title" onMouseDown={(event) => event.stopPropagation()}><div className="modalTitle"><div><p className="eyebrow">eClinTalk</p><h2 id="feedback-title">{l("Trimite feedback", "Send feedback", "Envoyer un avis", "Enviar comentarios")}</h2></div><button className="iconBtn" disabled={feedbackBusy} onClick={() => setFeedbackOpen(false)}>×</button></div><form className="form" onSubmit={submitFeedback}><label>{l("Descrie problema sau sugestia", "Describe the issue or suggestion", "Décrivez le problème ou la suggestion", "Describe el problema o la sugerencia")}<textarea rows={6} maxLength={2000} required value={feedbackText} onChange={(event) => setFeedbackText(event.target.value)} placeholder={l("Ce s-a întâmplat și pe ce dispozitiv?", "What happened and on which device?", "Que s’est-il passé et sur quel appareil ?", "¿Qué ocurrió y en qué dispositivo?")} /></label>{feedbackNotice && <p className={feedbackNotice.includes("Mulțumim") || feedbackNotice.includes("Thank") || feedbackNotice.includes("Merci") || feedbackNotice.includes("Gracias") ? "success" : "error"}>{feedbackNotice}</p>}<div className="modalActions"><button type="button" onClick={() => setFeedbackOpen(false)}>{t("cancel")}</button><button className="primary" disabled={feedbackBusy || feedbackText.trim().length<3}>{feedbackBusy ? l("Se trimite...", "Sending...", "Envoi…", "Enviando…") : l("Trimite feedback", "Send feedback", "Envoyer", "Enviar")}</button></div></form></section></div>}
    {modal && <NewConversation language={language} close={() => setModal(false)} communities={communities} selectedCommunityId={selectedCommunityId} isGeneralAdmin={isGeneralAdmin} created={(id) => { setModal(false); loadRooms(id); loadCommunities(); }} />}
    {communityModal && <NewCommunity language={language} close={() => setCommunityModal(false)} created={(id) => { setCommunityModal(false); loadCommunities(id); }} />}
    {groupInfoOpen && room && <div className="modalBackdrop groupInfoBackdrop" onMouseDown={() => setGroupInfoOpen(false)}><section className="modal manageModal groupInfoModal" role="dialog" aria-modal="true" aria-labelledby="group-info-title" onMouseDown={(e) => e.stopPropagation()}>
      <div className="groupInfoHeader"><span className="groupInfoAvatar">{room.title.slice(0,2).toUpperCase()}</span><div><p className="eyebrow">{room.community_name || l("Grup independent", "Independent group", "Groupe indépendant", "Grupo independiente")}</p><h2 id="group-info-title">{room.title}</h2><small>{room.member_count} {t("members")} · {l("grup privat", "private group", "groupe privé", "grupo privado")}</small></div><button className="iconBtn" aria-label={l("Închide", "Close", "Fermer", "Cerrar")} onClick={() => setGroupInfoOpen(false)}>×</button></div>
      <div className="groupSecurityGrid" aria-label={l("Securitatea grupului", "Group security", "Sécurité du groupe", "Seguridad del grupo")}>
        <article><Icon name="users" size={19}/><span><strong>{l("Acces", "Access", "Accès", "Acceso")}</strong><small>{l("Numai membrii adăugați", "Added members only", "Membres ajoutés uniquement", "Solo miembros añadidos")}</small></span></article>
        <article><Icon name="lock" size={19}/><span><strong>{l("Parolă", "Password", "Mot de passe", "Contraseña")}</strong><small>{room.password_protected ? l("Activă", "Enabled", "Activé", "Activada") : l("Nu este necesară", "Not required", "Non requis", "No requerida")}</small></span></article>
        <article className={room.protected_content ? "protected" : ""}><Icon name="shield" size={19}/><span><strong>{l("Conținut", "Content", "Contenu", "Contenido")}</strong><small>{room.protected_content ? l("Protejat", "Protected", "Protégé", "Protegido") : l("Protecție standard", "Standard protection", "Protection standard", "Protección estándar")}</small></span></article>
      </div>
      <div className="groupPermissionLine"><span>{l("Rolul tău", "Your role", "Votre rôle", "Tu función")}: <strong>{isOwner ? l("Proprietar", "Owner", "Propriétaire", "Propietario") : isAdmin ? "Administrator" : l("Membru", "Member", "Membre", "Miembro")}</strong></span>{isAdmin && <button type="button" onClick={() => { setGroupInfoOpen(false); openSettings(); }}><Icon name="settings" size={15}/>{l("Setări grup", "Group settings", "Paramètres du groupe", "Ajustes del grupo")}</button>}</div>
      <div className="groupInfoTabs" role="tablist">
        <button type="button" role="tab" aria-selected={groupInfoTab === "members"} className={groupInfoTab === "members" ? "active" : ""} onClick={() => setGroupInfoTab("members")}><Icon name="users" size={16}/><span>{l("Membri", "Members", "Membres", "Miembros")}</span><small>{members.length}</small></button>
        <button type="button" role="tab" aria-selected={groupInfoTab === "media"} className={groupInfoTab === "media" ? "active" : ""} onClick={() => setGroupInfoTab("media")}><Icon name="image" size={16}/><span>{l("Imagini", "Images", "Images", "Imágenes")}</span><small>{sharedMedia.length}</small></button>
        <button type="button" role="tab" aria-selected={groupInfoTab === "files"} className={groupInfoTab === "files" ? "active" : ""} onClick={() => setGroupInfoTab("files")}><Icon name="file" size={16}/><span>{l("Fișiere", "Files", "Fichiers", "Archivos")}</span><small>{sharedFiles.length}</small></button>
        <button type="button" role="tab" aria-selected={groupInfoTab === "links"} className={groupInfoTab === "links" ? "active" : ""} onClick={() => setGroupInfoTab("links")}><Icon name="link" size={16}/><span>{l("Linkuri", "Links", "Liens", "Enlaces")}</span><small>{sharedLinks.length}</small></button>
      </div>
      <div className="groupInfoContent" role="tabpanel">
        {groupInfoTab === "members" && <div className="memberList groupMemberList">{members.map((member) => <div className="memberRow groupMemberInfo" key={member.user_id}><span className="memberAvatar">{(member.display_name || member.email).slice(0,2).toUpperCase()}</span><div><strong>{member.display_name || member.email}{member.user_id === session.user.id && <em>{l("Tu", "You", "Vous", "Tú")}</em>}</strong><small>{member.email}</small></div><span className={`memberRole ${member.is_owner || member.is_admin ? "admin" : ""}`}>{member.is_owner ? l("Proprietar", "Owner", "Propriétaire", "Propietario") : member.is_admin ? "Administrator" : l("Membru", "Member", "Membre", "Miembro")}</span></div>)}</div>}
        {groupInfoTab === "media" && (sharedMedia.length ? <div className="mediaGallery">{sharedMedia.map((item) => imageUrls[item.attachment_path] && <button type="button" className="galleryMediaCard" key={item.id} onContextMenu={room.protected_content ? (e) => e.preventDefault() : undefined} onClick={() => { setGroupInfoOpen(false); openImageViewer(item); }}><span className={`galleryMedia ${room.protected_content ? "protectedMedia" : ""}`}><img draggable={room.protected_content ? "false" : undefined} src={imageUrls[item.attachment_path]} alt={item.attachment_name || l("Imagine", "Image")} />{room.protected_content && <span className="mediaWatermark" aria-hidden="true">{protectedWatermark}</span>}</span><span className="galleryMeta"><strong>{displayNameForUser(item.user_id,item.sender_email)}</strong><small>{new Date(item.created_at).toLocaleDateString(LANGUAGE_LOCALES[language])}</small></span></button>)}</div> : <p className="emptyInfo"><Icon name="image" size={28}/><strong>{l("Nicio imagine", "No images", "Aucune image", "Sin imágenes")}</strong><span>{l("Imaginile trimise în grup vor apărea aici.", "Images shared in the group will appear here.", "Les images partagées apparaîtront ici.", "Las imágenes compartidas aparecerán aquí.")}</span></p>)}
        {groupInfoTab === "files" && (sharedFiles.length ? <div className="sharedItemList">{sharedFiles.map((item) => <a href={imageUrls[item.attachment_path] || "#"} target="_blank" rel="noreferrer" className="sharedFileRow" key={item.id}><Icon name="file" size={20}/><span><strong>{item.attachment_name || l("Fișier", "File")}</strong><small>{displayNameForUser(item.user_id,item.sender_email)} · {new Date(item.created_at).toLocaleDateString(LANGUAGE_LOCALES[language])}{item.attachment_size ? ` · ${Math.max(1,Math.round(item.attachment_size/1024))} KB` : ""}</small></span></a>)}</div> : <p className="emptyInfo"><Icon name="file" size={28}/><strong>{l("Niciun fișier", "No files", "Aucun fichier", "Sin archivos")}</strong><span>{l("Fișierele trimise în grup vor apărea aici.", "Files shared in the group will appear here.", "Les fichiers partagés apparaîtront ici.", "Los archivos compartidos aparecerán aquí.")}</span></p>)}
        {groupInfoTab === "links" && (sharedLinks.length ? <div className="sharedItemList">{sharedLinks.map((item,index) => <a href={item.url} target="_blank" rel="noreferrer" className="sharedLinkRow" key={`${item.messageId}-${index}`}><Icon name="link" size={20}/><span><strong>{item.url}</strong><small>{item.sender} · {new Date(item.createdAt).toLocaleDateString(LANGUAGE_LOCALES[language])}</small></span></a>)}</div> : <p className="emptyInfo"><Icon name="link" size={28}/><strong>{l("Niciun link", "No links", "Aucun lien", "Sin enlaces")}</strong><span>{l("Linkurile trimise în grup vor apărea aici.", "Links shared in the group will appear here.", "Les liens partagés apparaîtront ici.", "Los enlaces compartidos aparecerán aquí.")}</span></p>)}
      </div>
      {room.protected_content && <div className="protectedContentDetails"><div><Icon name="shield" size={20}/><strong>{l("Reguli pentru conținutul protejat", "Protected content rules", "Règles du contenu protégé", "Reglas del contenido protegido")}</strong></div><ul><li>{l("Salvarea obișnuită a imaginilor este restricționată.", "Standard image saving is restricted.", "L’enregistrement habituel des images est limité.", "El guardado habitual de imágenes está restringido.")}</li><li>{l("Imaginile afișează identitatea utilizatorului ca watermark.", "Images display the viewer’s identity as a watermark.", "Les images affichent l’identité de l’utilisateur en filigrane.", "Las imágenes muestran la identidad del usuario como marca de agua.")}</li><li>{l("Redirecționarea este permisă numai către alte grupuri protejate.", "Forwarding is limited to other protected groups.", "Le transfert est limité aux autres groupes protégés.", "El reenvío se limita a otros grupos protegidos.")}</li></ul><small>{l("Fotografierea ecranului cu alt dispozitiv nu poate fi împiedicată complet.", "Photographing the screen with another device cannot be completely prevented.", "Photographier l’écran avec un autre appareil ne peut pas être totalement empêché.", "No se puede impedir por completo fotografiar la pantalla con otro dispositivo.")}</small></div>}
    </section></div>}
    {settingsOpen && room && <div className="modalBackdrop" onMouseDown={() => !settingsBusy && setSettingsOpen(false)}><section className="modal manageModal" role="dialog" aria-modal="true" aria-labelledby="group-settings-title" onMouseDown={(e) => e.stopPropagation()}>
      <div className="modalTitle"><div><p className="eyebrow">{l("Grup privat", "Private group")}</p><h2 id="group-settings-title">{l("Setări", "Settings")}</h2></div><button className="iconBtn" aria-label={l("Închide", "Close")} disabled={settingsBusy} onClick={() => setSettingsOpen(false)}>×</button></div>
      {isAdmin && <form className="manageSection" onSubmit={renameConversation}>
        <label>{l("Numele grupului", "Group name")}<div className="inlineForm"><input required maxLength={80} value={settingsTitle} onChange={(e) => setSettingsTitle(e.target.value)} /><button className="primary" disabled={settingsBusy || !settingsTitle.trim()}>{t("save")}</button></div></label>
      </form>}
      {isAdmin && <form className="manageSection" onSubmit={saveProtectedContent}>
        <div className="sectionHeading"><strong>{l("Protecția conținutului", "Content protection", "Protection du contenu", "Protección del contenido")}</strong><small>{protectedContent ? l("Activă", "Active", "Active", "Activa") : l("Inactivă", "Inactive", "Inactive", "Inactiva")}</small></div>
        <label className="checkLabel"><input type="checkbox" checked={protectedContent} onChange={(e) => setProtectedContent(e.target.checked)} />{l("Restricționează salvarea imaginilor din acest grup", "Restrict saving images from this group", "Limiter l’enregistrement des images de ce groupe", "Restringir el guardado de imágenes de este grupo")}</label>
        <p className="helper">{l("Imaginile primesc watermark cu identitatea utilizatorului, nu pot fi deschise direct pentru descărcare și folosesc linkuri temporare de 5 minute. Protecția nu poate împiedica fotografierea ecranului cu alt dispozitiv.", "Images receive a watermark with the viewer’s identity, cannot be opened directly for download, and use 5-minute temporary links. This cannot prevent someone photographing the screen with another device.", "Les images reçoivent un filigrane avec l’identité de l’utilisateur, ne peuvent pas être ouvertes directement pour être téléchargées et utilisent des liens temporaires de 5 minutes. Cela ne peut pas empêcher de photographier l’écran avec un autre appareil.", "Las imágenes reciben una marca de agua con la identidad del usuario, no pueden abrirse directamente para descargarlas y usan enlaces temporales de 5 minutos. Esto no impide fotografiar la pantalla con otro dispositivo.")}</p>
        <button className="primary" disabled={settingsBusy}>{settingsBusy ? l("Se salvează...", "Saving...", "Enregistrement…", "Guardando…") : t("save")}</button>
      </form>}
      <form className="manageSection" onSubmit={saveNotificationPreferences}>
        <div className="sectionHeading"><strong>{l("Notificări", "Notifications")}</strong><small>{l("Numai pentru contul tău", "Only for your account")}</small></div>
        <label className="checkLabel"><input type="checkbox" checked={notificationsEnabled} onChange={(e) => setNotificationsEnabled(e.target.checked)} />{l("Primește notificări pentru acest grup", "Receive notifications for this group")}</label>
        {notificationsEnabled && !pushEnabled && <p className="pushWarning" role="status"><span aria-hidden="true">⚠</span>{l("Notificările sunt oprite pe acest dispozitiv.", "Notifications are off on this device.")}</p>}
        <label className="checkLabel"><input type="checkbox" checked={soundEnabled} disabled={!notificationsEnabled} onChange={(e) => setSoundEnabled(e.target.checked)} />{l("Sunet pentru mesajele noi", "Sound for new messages")}</label>
        <label className="checkLabel"><input type="checkbox" checked={mentionsOnly} disabled={!notificationsEnabled} onChange={(e) => setMentionsOnly(e.target.checked)} />{l("Notifică-mă numai când sunt menționat", "Notify me only when mentioned")}</label>
        <div className="memberActions notificationActions">
          <button type="button" onClick={() => setMutedUntil(new Date(Date.now() + 60 * 60 * 1000).toISOString())}>{l("Silențios 1 oră", "Mute for 1 hour")}</button>
          <button type="button" onClick={() => setMutedUntil(new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString())}>{l("Silențios 8 ore", "Mute for 8 hours")}</button>
	          <button type="button" disabled={!mutedUntil || new Date(mutedUntil) <= new Date()} onClick={() => setMutedUntil("")}>{t("resumeNotifications")}</button>
        </div>
        <p className="helper">
          {mutedUntil && new Date(mutedUntil) > new Date()
            ? l(`Notificări oprite până la ${new Date(mutedUntil).toLocaleString("ro-RO")}`, `Notifications muted until ${new Date(mutedUntil).toLocaleString("en-GB")}`, `Notifications suspendues jusqu’au ${new Date(mutedUntil).toLocaleString("fr-FR")}`, `Notificaciones silenciadas hasta ${new Date(mutedUntil).toLocaleString("es-ES")}`)
            : l("Notificările nu sunt suspendate temporar.", "Notifications are not temporarily muted.")}
        </p>
        <button type="button" onClick={togglePushNotifications} disabled={notificationBusy}>
          {pushEnabled ? l("✓ Notificări active — apasă pentru dezactivare", "✓ Notifications active — tap to disable") : l("Activează pe acest dispozitiv", "Enable on this device")}
        </button>
        <p className="helper">{l("Setarea rămâne activă după delogare. Sunetul și vibrația urmează modul dispozitivului. Pe iPhone, activează notificările din aplicația deschisă prin pictograma de pe ecranul principal.", "This setting remains active after sign-out. Sound and vibration follow the device mode. On iPhone, enable notifications from the app opened through its Home Screen icon.")}</p>
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
        <fieldset className="inviteGroups historyChoice"><legend>{l("Ce istoric vor putea vedea?", "What message history can they see?", "Quel historique pourront-ils voir ?", "¿Qué historial podrán ver?")}</legend>
          <label className="checkLabel"><input type="radio" name="newMemberHistory" value="new" checked={newMemberHistoryAccess === "new"} onChange={() => setNewMemberHistoryAccess("new")} />{l("Numai mesajele trimise după înscriere", "Only messages sent after joining", "Uniquement les messages envoyés après l’inscription", "Solo los mensajes enviados después de unirse")}</label>
          <label className="checkLabel"><input type="radio" name="newMemberHistory" value="all" checked={newMemberHistoryAccess === "all"} onChange={() => setNewMemberHistoryAccess("all")} />{l("Tot istoricul grupului", "Full group history", "Tout l’historique du groupe", "Todo el historial del grupo")}</label>
        </fieldset>
        <button className="primary" disabled={settingsBusy || !newMemberEmails.trim()}>{l("Adaugă", "Add")}</button>
      </form>}
      {isAdmin && <form className="manageSection" onSubmit={saveGroupPassword}>
        <div className="sectionHeading"><strong>{l("Parolă suplimentară", "Additional password")}</strong><small>{passwordProtected ? l("Activă", "Active") : l("Inactivă", "Inactive")}</small></div>
        <label>{passwordProtected ? l("Schimbă parola grupului", "Change group password") : l("Protejează grupul cu parolă", "Protect group with password")}<input type="password" minLength={6} maxLength={64} placeholder={l("Minimum 6 caractere", "Minimum 6 characters")} value={groupPassword} onChange={(e) => setGroupPassword(e.target.value)} /></label>
        <p className="helper">{l("Va fi cerută membrilor la fiecare deschidere a grupului. Parola nu este afișată și nu este stocată în clar.", "Members will be asked for it every time they open the group. The password is never displayed or stored in plain text.")}</p>
        <div className="passwordActions"><button className="primary" disabled={settingsBusy || groupPassword.length < 6}>{passwordProtected ? l("Schimbă parola", "Change password") : l("Activează parola", "Enable password")}</button>
          {passwordProtected && <button type="button" disabled={settingsBusy} onClick={removeGroupPassword}>{l("Elimină parola", "Remove password")}</button>}</div>
      </form>}
      {settingsError && <p className="error manageError" role="alert">{settingsError}</p>}
      <div className="dangerZone">{isOwner ? <button className="dangerBtn" disabled={settingsBusy} onClick={deleteConversation}>{l("Șterge conversația", "Delete conversation")}</button> : <button className="dangerBtn" disabled={settingsBusy} onClick={leaveConversation}>{l("Părăsește conversația", "Leave conversation")}</button>}</div>
    </section></div>}
    {communitySettingsOpen && selectedCommunity && <div className="modalBackdrop" onMouseDown={() => !communityBusy && setCommunitySettingsOpen(false)}><section className="modal manageModal" role="dialog" aria-modal="true" aria-labelledby="community-settings-title" onMouseDown={(e) => e.stopPropagation()}>
      <div className="modalTitle"><div><p className="eyebrow">{selectedCommunity.name}</p><h2 id="community-settings-title">{l("Administrează comunitatea", "Manage community")}</h2></div><button className="iconBtn" disabled={communityBusy} onClick={() => setCommunitySettingsOpen(false)} aria-label={l("Închide", "Close")}>×</button></div>
      <p className="communityIntro">{l("Adaugă direct conturile existente sau creează un link pentru persoanele care nu au încă un cont. Poți alege și grupurile în care vor intra.", "Add existing accounts directly or create a link for people who do not have an account yet. You can also choose which groups they will join.")}</p>
      <form className="manageSection" onSubmit={saveCommunity}>
        <label>{l("Numele comunității", "Community name")}<input required maxLength={80} value={communityName} onChange={(e) => setCommunityName(e.target.value)} /></label>
        <label>{l("Descriere", "Description")}<textarea rows={2} maxLength={500} value={communityDescription} onChange={(e) => setCommunityDescription(e.target.value)} /></label>
        <button className="primary" disabled={communityBusy || !communityName.trim()}>{t("save")}</button>
      </form>
      <form className="manageSection" onSubmit={addCommunityMembers}>
        <div className="sectionHeading"><strong>{l("Adaugă membri sau creează invitații", "Add members or create invitations", "Ajouter des membres ou créer des invitations", "Añadir miembros o crear invitaciones")}</strong><small>{l("după email", "by email")}</small></div>
        <label>{l("Adresele de email ale persoanelor", "People's email addresses")}<textarea rows={2} placeholder={l("nume@exemplu.ro, alt.nume@exemplu.ro", "name@example.com, another@example.com")} value={communityMemberEmails} onChange={(e) => setCommunityMemberEmails(e.target.value)} /></label>
        {selectedCommunityRooms.length > 0 && <fieldset className="inviteGroups inviteScope"><legend>{l("Unde sunt adăugate persoanele", "Where people are added")}</legend>
          <label className="checkLabel"><input type="radio" name="communityInviteScope" value="community" checked={communityInviteScope === "community"} onChange={() => { setCommunityInviteScope("community"); setCommunityInviteGroups([]); }} />{l("Numai în comunitate", "Community only")}</label>
          <label className="checkLabel"><input type="radio" name="communityInviteScope" value="all" checked={communityInviteScope === "all"} disabled={!bulkEligibleCommunityRooms.length} onChange={() => { setCommunityInviteScope("all"); setCommunityInviteGroups(bulkEligibleCommunityRooms.map((item) => item.id)); }} />{l(`În toate grupurile existente fără parolă (${bulkEligibleCommunityRooms.length})`, `All existing groups without a password (${bulkEligibleCommunityRooms.length})`, `Tous les groupes existants sans mot de passe (${bulkEligibleCommunityRooms.length})`, `Todos los grupos existentes sin contraseña (${bulkEligibleCommunityRooms.length})`)}</label>
          <label className="checkLabel"><input type="radio" name="communityInviteScope" value="selected" checked={communityInviteScope === "selected"} disabled={!bulkEligibleCommunityRooms.length} onChange={() => setCommunityInviteScope("selected")} />{l("În grupurile selectate", "Selected groups")}</label>
          {communityInviteScope === "selected" && <div className="groupChoiceList">{bulkEligibleCommunityRooms.map((item) => <label className="checkLabel" key={item.id}><input type="checkbox" checked={communityInviteGroups.includes(item.id)} onChange={(e) => setCommunityInviteGroups((current) => e.target.checked ? [...current,item.id] : current.filter((id) => id !== item.id))} />{item.title}</label>)}</div>}
          {protectedCommunityRooms.length > 0 && <p className="protectedGroupNote"><span aria-hidden="true">🔒</span>{l(`${protectedCommunityRooms.length} grupuri cu parolă sunt excluse. Membrii se adaugă separat din setările fiecărui grup.`, `${protectedCommunityRooms.length} password-protected groups are excluded. Add members separately from each group's settings.`, `${protectedCommunityRooms.length} groupes protégés par mot de passe sont exclus. Ajoutez les membres séparément dans les paramètres de chaque groupe.`, `${protectedCommunityRooms.length} grupos protegidos con contraseña están excluidos. Añade los miembros por separado desde los ajustes de cada grupo.`)}</p>}
        </fieldset>}
        {communityInviteScope !== "community" && <fieldset className="inviteGroups historyChoice"><legend>{l("Ce istoric vor putea vedea în grupurile selectate?", "What history can they see in the selected groups?", "Quel historique pourront-ils voir dans les groupes sélectionnés ?", "¿Qué historial podrán ver en los grupos seleccionados?")}</legend>
          <label className="checkLabel"><input type="radio" name="communityHistory" value="new" checked={communityHistoryAccess === "new"} onChange={() => setCommunityHistoryAccess("new")} />{l("Numai mesajele trimise după înscriere", "Only messages sent after joining", "Uniquement les messages envoyés après l’inscription", "Solo los mensajes enviados después de unirse")}</label>
          <label className="checkLabel"><input type="radio" name="communityHistory" value="all" checked={communityHistoryAccess === "all"} onChange={() => setCommunityHistoryAccess("all")} />{l("Tot istoricul grupurilor", "Full group history", "Tout l’historique des groupes", "Todo el historial de los grupos")}</label>
        </fieldset>}
        <p className="helper">{l("Conturile existente sunt adăugate imediat. Pentru celelalte adrese se creează un link valabil 7 zile, pe care îl poți trimite prin WhatsApp sau e-mail.", "Existing accounts are added immediately. For other addresses, a link valid for 7 days is created and can be sent by WhatsApp or email.", "Les comptes existants sont ajoutés immédiatement. Pour les autres adresses, un lien valable 7 jours est créé et peut être envoyé par WhatsApp ou e-mail.", "Las cuentas existentes se añaden inmediatamente. Para las demás direcciones se crea un enlace válido durante 7 días que puedes enviar por WhatsApp o correo electrónico.")}</p>
        <button className="primary" disabled={communityBusy || !communityMemberEmails.trim()}>{l("Adaugă / creează invitațiile", "Add / create invitations", "Ajouter / créer les invitations", "Añadir / crear invitaciones")}</button>
      </form>
      {communityInviteLinks.length>0 && <div className="manageSection invitationResults"><div className="sectionHeading"><strong>{l("Linkuri de trimis", "Links to share", "Liens à partager", "Enlaces para compartir")}</strong><small>{communityInviteLinks.length}</small></div>
        <label className="invitationLanguageLabel">{l("Limba invitației", "Invitation language", "Langue de l’invitation", "Idioma de la invitación")}<select value={invitationLanguage} onChange={(e) => setInvitationLanguage(e.target.value)}><option value="ro">Română</option><option value="en">English</option><option value="fr">Français</option><option value="es">Español</option></select></label>
        {communityInviteLinks.map((link) => <div className="invitationRow" key={link.email}><div><strong>{link.email}</strong><input readOnly value={link.url} onFocus={(e) => e.target.select()} /></div><div className="invitationActions"><button type="button" className="whatsappBtn" onClick={() => shareInvitationOnWhatsApp(link)}><span aria-hidden="true">◉</span>{l("WhatsApp", "WhatsApp")}</button><button type="button" onClick={() => shareInvitationByEmail(link)}><span aria-hidden="true">✉</span>{l("E-mail", "Email")}</button><button type="button" onClick={() => copyInvitation(link)}>{l("Copiază", "Copy")}</button></div></div>)}
      </div>}
      <div className="manageSection"><div className="sectionHeading"><strong>{l("Membrii comunității", "Community members")}</strong><small>{communityMembers.length}</small></div>
        <div className="memberList">{communityMembers.map((member) => <Fragment key={member.user_id}><div className="memberRow"><div><strong>{member.display_name || member.email}</strong><small>{member.email} · {member.is_admin ? l("Administrator de comunitate", "Community administrator") : l("Membru", "Member")}</small></div>
          <div className="memberActions"><button disabled={communityBusy} onClick={() => openMemberGroupEditor(member)}><Icon name="settings" size={15}/>{l("Clinici / grupuri", "Clinics / groups", "Cliniques / groupes", "Clínicas / grupos")}</button>{isGeneralAdmin && member.user_id !== session.user.id && <button disabled={communityBusy} onClick={() => toggleCommunityAdmin(member)}>{member.is_admin ? l("Retrage admin", "Remove admin") : l("Fă admin", "Make admin")}</button>}
          {member.user_id !== session.user.id && (!member.is_admin || isGeneralAdmin) && <button disabled={communityBusy} onClick={() => removeCommunityMember(member)}>{l("Elimină", "Remove")}</button>}</div>
        </div>{memberGroupEditorId === member.user_id && <div className="memberGroupEditor"><div className="sectionHeading"><strong>{l("Clinici / grupuri vizibile", "Visible clinics / groups", "Cliniques / groupes visibles", "Clínicas / grupos visibles")}</strong><small>{memberGroupSelection.length}</small></div>
          {memberGroupOptions.length ? <div className="memberGroupChoices">{memberGroupOptions.map((item) => {
            const fixedAccess = item.is_admin || item.is_owner;
            return <label className={`checkLabel ${item.password_protected ? "protectedChoice" : ""}`} key={item.conversation_id}><input type="checkbox" checked={memberGroupSelection.includes(item.conversation_id)} disabled={communityBusy || !item.can_manage || fixedAccess} onChange={(e) => setMemberGroupSelection((current) => e.target.checked ? [...current,item.conversation_id] : current.filter((id) => id !== item.conversation_id))} /><span>{item.password_protected ? "🔒 " : ""}{item.title}{fixedAccess ? l(" · acces de administrator", " · administrator access", " · accès administrateur", " · acceso de administrador") : ""}</span></label>;
          })}</div> : <p className="helper">{l("Comunitatea nu are încă nicio clinică/grup.", "This community has no clinics/groups yet.", "Cette communauté ne contient encore aucune clinique ni aucun groupe.", "Esta comunidad todavía no tiene clínicas ni grupos.")}</p>}
          {memberGroupOptions.some((item) => item.password_protected) && <p className="protectedGroupNote"><span aria-hidden="true">🔒</span>{l("Grupurile cu parolă sunt vizibile numai după invitație. Accesul poate fi acordat doar de administratorul grupului sau de administratorul general.", "Password-protected groups are visible only after an invitation. Access can be granted only by the group administrator or the general administrator.", "Les groupes protégés par mot de passe ne sont visibles qu’après une invitation. L’accès ne peut être accordé que par l’administrateur du groupe ou l’administrateur général.", "Los grupos protegidos con contraseña solo son visibles después de una invitación. El acceso solo puede concederlo el administrador del grupo o el administrador general.")}</p>}
          <fieldset className="inviteGroups historyChoice"><legend>{l("Pentru grupurile adăugate acum", "For groups added now", "Pour les groupes ajoutés maintenant", "Para los grupos añadidos ahora")}</legend>
            <label className="checkLabel"><input type="radio" name={`memberGroupHistory-${member.user_id}`} value="new" checked={memberGroupHistoryAccess === "new"} onChange={() => setMemberGroupHistoryAccess("new")} />{l("Numai mesajele viitoare", "New messages only", "Nouveaux messages uniquement", "Solo mensajes nuevos")}</label>
            <label className="checkLabel"><input type="radio" name={`memberGroupHistory-${member.user_id}`} value="all" checked={memberGroupHistoryAccess === "all"} onChange={() => setMemberGroupHistoryAccess("all")} />{l("Tot istoricul", "Full history", "Tout l’historique", "Todo el historial")}</label>
          </fieldset>
          <div className="memberGroupActions"><button type="button" disabled={communityBusy} onClick={() => { setMemberGroupEditorId(null); setMemberGroupOptions([]); setMemberGroupSelection([]); }}>{t("cancel")}</button><button type="button" className="primary" disabled={communityBusy || !memberGroupOptions.length} onClick={() => saveMemberGroupAccess(member)}>{communityBusy ? t("processing") : t("save")}</button></div>
        </div>}</Fragment>)}</div>
      </div>
      {communityNotice && <p className="success communityNotice" role="status">{communityNotice}</p>}
      {communityError && <p className="error manageError" role="alert">{communityError}</p>}
      {isGeneralAdmin && <div className="dangerZone"><button className="dangerBtn" disabled={communityBusy} onClick={deleteCommunity}>{l("Șterge comunitatea", "Delete community")}</button></div>}
    </section></div>}
    {profileOpen && <div className="modalBackdrop" onMouseDown={() => !profileBusy && setProfileOpen(false)}><section className="modal profileModal" role="dialog" aria-modal="true" aria-labelledby="profile-settings-title" onMouseDown={(e) => e.stopPropagation()}>
      <div className="modalTitle"><div><p className="eyebrow">eClinTalk</p><h2 id="profile-settings-title">{t("accountSettings")}</h2></div><button className="iconBtn" aria-label={l("Închide", "Close")} disabled={profileBusy} onClick={() => setProfileOpen(false)}>×</button></div>
      <form className="form" onSubmit={saveProfile}>
        <label>{t("displayName")}<input required minLength={2} maxLength={80} value={profileName} onChange={(e) => setProfileName(e.target.value)} /></label>
        <label>{t("email")}<input value={session.user.email || ""} disabled /></label>
        <label>{t("language")}<select value={language} onChange={(e) => setLanguage(e.target.value)}><option value="ro">Română</option><option value="en">English</option><option value="fr">Français</option><option value="es">Español</option></select></label>
        <label>{l("Tema interfeței", "Interface theme")}<select value={themePreference} onChange={(e) => setThemePreference(e.target.value)}>
          <option value="auto">{l("Automat — urmează dispozitivul", "Automatic — follow device")}</option>
          <option value="light">{l("Luminoasă", "Light")}</option>
          <option value="dark">{l("Întunecată", "Dark")}</option>
        </select></label>
        <p className="helper">{l("Tema aleasă rămâne salvată pe acest dispozitiv și după delogare.", "Your theme choice remains saved on this device after sign-out.")}</p>
        {profileError && <p className="error" role="alert">{profileError}</p>}
        <div className="modalActions"><button type="button" disabled={profileBusy} onClick={() => setProfileOpen(false)}>{t("cancel")}</button><button className="primary" disabled={profileBusy || profileName.trim().length < 2}>{profileBusy ? t("processing") : t("save")}</button></div>
      </form>
    </section></div>}
    {passwordOpen && room && <div className="modalBackdrop"><section className="modal passwordModal" role="dialog" aria-modal="true" aria-labelledby="password-dialog-title">
      <div className="lockMark" aria-hidden="true">🔒</div><p className="eyebrow">{l("Grup protejat", "Protected group")}</p><h2 id="password-dialog-title">{room.title}</h2>
      <p className="muted">{l("Introdu parola suplimentară pentru a deschide conversația.", "Enter the additional password to open this conversation.")}</p>
      <form className="form" onSubmit={unlockConversation}><label>{l("Parola grupului", "Group password")}<input autoFocus type="password" value={roomPassword} onChange={(e) => setRoomPassword(e.target.value)} /></label>
        {passwordError && <p className="error" role="alert">{passwordError}</p>}
        <div className="modalActions"><button type="button" disabled={passwordBusy} onClick={cancelPassword}>{t("cancel")}</button><button className="primary" disabled={passwordBusy || !roomPassword}>{passwordBusy ? l("Se verifică...", "Checking...") : l("Deschide grupul", "Open group")}</button></div>
      </form>
    </section></div>}
    {logoutWarning && <div className="modalBackdrop"><section className="modal timeoutModal" role="alertdialog" aria-modal="true" aria-labelledby="timeout-dialog-title">
      <p className="eyebrow">{l("Sesiune inactivă", "Inactive session")}</p><h2 id="timeout-dialog-title" aria-live="polite">{l(`Vei fi delogat în ${logoutCountdown} secunde`, `You will be signed out in ${logoutCountdown} seconds`, `Vous serez déconnecté dans ${logoutCountdown} secondes`, `La sesión se cerrará en ${logoutCountdown} segundos`)}</h2>
      <p className="muted">{l("Pentru protejarea contului, sesiunea se închide automat după 15 minute fără activitate.", "To protect your account, the session closes automatically after 15 minutes of inactivity.")}</p>
      <div className="modalActions"><button onClick={signOut}>{l("Ieșire acum", "Sign out now")}</button><button className="primary" onClick={() => window.dispatchEvent(new Event("pointerdown"))}>{l("Rămân conectat", "Stay signed in")}</button></div>
    </section></div>}
  </main>;
}

export default function Home() {
  const [session, setSession] = useState(null);
  const [checking, setChecking] = useState(true);
  const [passwordRecovery, setPasswordRecovery] = useState(false);
  const [inviteToken, setInviteToken] = useState("");
  const [language, setLanguageState] = useState("ro");
  const [themePreference, setThemePreferenceState] = useState("auto");
  function setLanguage(nextLanguage) {
    const safeLanguage = SUPPORTED_LANGUAGES.includes(nextLanguage) ? nextLanguage : "ro";
    setLanguageState(safeLanguage);
    if (typeof window !== "undefined") window.localStorage.setItem("eclintalk-language", safeLanguage);
    if (typeof document !== "undefined") document.documentElement.lang = safeLanguage;
  }
  function setThemePreference(nextTheme) {
    const safeTheme = ["auto", "light", "dark"].includes(nextTheme) ? nextTheme : "auto";
    setThemePreferenceState(safeTheme);
    if (typeof window !== "undefined") window.localStorage.setItem("eclintalk-theme", safeTheme);
    if (typeof document !== "undefined") {
      const resolvedTheme = safeTheme === "auto"
        ? (window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark")
        : safeTheme;
      document.documentElement.dataset.theme = resolvedTheme;
      document.documentElement.style.colorScheme = resolvedTheme;
      const themeMeta = document.querySelector('meta[name="theme-color"]');
      if (themeMeta) themeMeta.setAttribute("content", resolvedTheme === "light" ? "#edf3f8" : "#07111d");
    }
  }
  useEffect(() => {
    const storedLanguage = window.localStorage.getItem("eclintalk-language");
    const browserLanguage = navigator.language?.slice(0, 2).toLowerCase();
    setLanguage(storedLanguage || (SUPPORTED_LANGUAGES.includes(browserLanguage) ? browserLanguage : "ro"));
    setThemePreference(window.localStorage.getItem("eclintalk-theme") || "auto");
    const query = new URLSearchParams(window.location.search);
    setInviteToken(query.get("invite") || "");
    if (query.get("recovery") === "1") {
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
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: light)");
    const syncAutomaticTheme = () => {
      if (themePreference !== "auto") return;
      const resolvedTheme = media.matches ? "light" : "dark";
      document.documentElement.dataset.theme = resolvedTheme;
      document.documentElement.style.colorScheme = resolvedTheme;
      const themeMeta = document.querySelector('meta[name="theme-color"]');
      if (themeMeta) themeMeta.setAttribute("content", resolvedTheme === "light" ? "#edf3f8" : "#07111d");
    };
    syncAutomaticTheme();
    media.addEventListener?.("change", syncAutomaticTheme);
    return () => media.removeEventListener?.("change", syncAutomaticTheme);
  }, [themePreference]);
  if (checking) return <main className="center">{localize(language, "Se verifică sesiunea...", "Checking session...", "Vérification de la session…", "Comprobando la sesión…")}</main>;
  if (passwordRecovery && session) return <UpdatePassword language={language} completed={() => {
    window.history.replaceState({}, "", "/");
    setPasswordRecovery(false);
  }} />;
  return session ? <Chat session={session} language={language} setLanguage={setLanguage} themePreference={themePreference} setThemePreference={setThemePreference} inviteToken={inviteToken} invitationCompleted={() => {
    window.history.replaceState({}, "", "/");
    setInviteToken("");
  }} /> : <Login language={language} setLanguage={setLanguage} inviteToken={inviteToken} />;
}
