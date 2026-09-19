import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";

export const runtime = "nodejs";

function configuredClients(token) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anonKey || !serviceKey || !token) return null;
  return {
    userClient: createClient(url, anonKey, { auth: { persistSession: false } }),
    adminClient: createClient(url, serviceKey, { auth: { persistSession: false } }),
  };
}

export async function POST(request) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const clients = configuredClients(token);
  if (!clients) return Response.json({ error: "Configurare incompletă" }, { status: 503 });

  const { data: authData, error: authError } = await clients.userClient.auth.getUser(token);
  const sender = authData?.user;
  if (authError || !sender) return Response.json({ error: "Neautorizat" }, { status: 401 });

  const { messageId } = await request.json().catch(() => ({}));
  if (!messageId) return Response.json({ error: "Mesaj lipsă" }, { status: 400 });

  const { data: message } = await clients.adminClient
    .from("private_messages")
    .select("id, conversation_id, user_id, body, attachment_path, mentioned_user_ids")
    .eq("id", messageId)
    .maybeSingle();
  if (!message || message.user_id !== sender.id) {
    return Response.json({ error: "Mesaj invalid" }, { status: 403 });
  }

  const [{ data: membership }, { data: conversation }, { data: members }] = await Promise.all([
    clients.adminClient.from("conversation_members").select("user_id").eq("conversation_id", message.conversation_id).eq("user_id", sender.id).maybeSingle(),
    clients.adminClient.from("conversations").select("title").eq("id", message.conversation_id).maybeSingle(),
    clients.adminClient.from("conversation_members").select("user_id").eq("conversation_id", message.conversation_id),
  ]);
  if (!membership) return Response.json({ error: "Acces interzis" }, { status: 403 });

  const { error: dispatchError } = await clients.adminClient
    .from("push_dispatches")
    .insert({ message_id: message.id });
  if (dispatchError?.code === "23505") return Response.json({ ok: true, sent: 0, duplicate: true });
  if (dispatchError) return Response.json({ error: "Notificarea nu a putut fi inițiată" }, { status: 500 });

  const recipientIds = (members || []).map((item) => item.user_id).filter((id) => id !== sender.id);
  if (!recipientIds.length) return Response.json({ ok: true, sent: 0 });

  const [{ data: preferences }, { data: mutedUsers }] = await Promise.all([
    clients.adminClient.from("notification_preferences").select("user_id, notifications_enabled, sound_enabled, mentions_only, muted_until").eq("conversation_id", message.conversation_id).in("user_id", recipientIds),
    clients.adminClient.from("muted_users").select("user_id, muted_until").eq("muted_user_id", sender.id).in("user_id", recipientIds),
  ]);
  const preferenceByUser = new Map((preferences || []).map((item) => [item.user_id, item]));
  const mutedByUser = new Map((mutedUsers || []).map((item) => [item.user_id, item]));
  const now = new Date();
  const body = message.body || "";

  const eligibleIds = [];
  for (const userId of recipientIds) {
    const preference = preferenceByUser.get(userId);
    if (preference?.notifications_enabled === false) continue;
    if (preference?.muted_until && new Date(preference.muted_until) > now) continue;
    const muted = mutedByUser.get(userId);
    if (muted && (!muted.muted_until || new Date(muted.muted_until) > now)) continue;

    if (preference?.mentions_only) {
      if ((message.mentioned_user_ids || []).includes(userId)) {
        eligibleIds.push(userId);
        continue;
      }
      const { data: recipientData } = await clients.adminClient.auth.admin.getUserById(userId);
      const email = (recipientData?.user?.email || "").toLowerCase();
      const username = email.split("@")[0];
      const text = body.toLowerCase();
      if (!email || (!text.includes(`@${email}`) && !text.includes(`@${username}`))) continue;
    }
    eligibleIds.push(userId);
  }
  if (!eligibleIds.length) return Response.json({ ok: true, sent: 0 });

  const [{ data: subscriptions }, { data: recipientProfiles }] = await Promise.all([
    clients.adminClient.from("push_subscriptions")
      .select("id, user_id, endpoint, p256dh, auth")
      .in("user_id", eligibleIds),
    clients.adminClient.from("profiles")
      .select("user_id, preferred_language")
      .in("user_id", eligibleIds),
  ]);
  if (!subscriptions?.length) return Response.json({ ok: true, sent: 0 });
  const languageByUser = new Map((recipientProfiles || []).map((item) => [item.user_id, item.preferred_language]));

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return Response.json({ error: "Cheile push lipsesc" }, { status: 503 });
  webpush.setVapidDetails(new URL(request.url).origin, publicKey, privateKey);

  let sent = 0;
  await Promise.all((subscriptions || []).map(async (subscription) => {
    try {
      const preference = preferenceByUser.get(subscription.user_id);
      const recipientLanguage = languageByUser.get(subscription.user_id) || "ro";
      const payload = JSON.stringify({
        title: conversation?.title || "eClinTalk",
        body: recipientLanguage === "en" ? "You received a new message." : "Ai primit un mesaj nou.",
        tag: `message-${message.id}`,
        url: "/",
        silent: preference?.sound_enabled === false,
      });
      await webpush.sendNotification({
        endpoint: subscription.endpoint,
        keys: { p256dh: subscription.p256dh, auth: subscription.auth },
      }, payload, { TTL: 60 * 60 });
      sent += 1;
    } catch (error) {
      if (error?.statusCode === 404 || error?.statusCode === 410) {
        await clients.adminClient.from("push_subscriptions").delete().eq("id", subscription.id);
      }
    }
  }));

  return Response.json({ ok: true, sent });
}
