import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

function clientsForRequest(request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!url || !anonKey || !serviceKey || !token) return null;
  return {
    token,
    userClient: createClient(url, anonKey, { auth: { persistSession: false } }),
    adminClient: createClient(url, serviceKey, { auth: { persistSession: false } }),
  };
}

async function authenticatedUser(request) {
  const clients = clientsForRequest(request);
  if (!clients) return {};
  const { data, error } = await clients.userClient.auth.getUser(clients.token);
  if (error || !data.user) return {};
  return { user: data.user, adminClient: clients.adminClient };
}

export async function POST(request) {
  const { user, adminClient } = await authenticatedUser(request);
  if (!user) return Response.json({ error: "Neautorizat" }, { status: 401 });

  const subscription = await request.json().catch(() => null);
  const endpoint = subscription?.endpoint;
  const p256dh = subscription?.keys?.p256dh;
  const auth = subscription?.keys?.auth;
  if (!endpoint || !p256dh || !auth) {
    return Response.json({ error: "Abonament push invalid" }, { status: 400 });
  }

  await adminClient.from("push_subscriptions").delete().eq("endpoint", endpoint);
  const { error } = await adminClient.from("push_subscriptions").insert({
    user_id: user.id,
    endpoint,
    p256dh,
    auth,
    user_agent: request.headers.get("user-agent") || null,
    updated_at: new Date().toISOString(),
  });
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}

export async function DELETE(request) {
  const { user, adminClient } = await authenticatedUser(request);
  if (!user) return Response.json({ error: "Neautorizat" }, { status: 401 });
  const { endpoint } = await request.json().catch(() => ({}));
  if (!endpoint) return Response.json({ ok: true });
  await adminClient.from("push_subscriptions").delete().eq("user_id", user.id).eq("endpoint", endpoint);
  return Response.json({ ok: true });
}
