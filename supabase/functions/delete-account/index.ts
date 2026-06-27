// delete-account — the server side of account deletion (Apple 5.1.1(v)).
//
// The client (Settings → Delete All My Data) invokes this with the signed-in
// user's JWT. We identify the caller from that JWT, remove every save object in
// their Storage folder, then delete the auth user itself (which needs the
// service-role key — hence an Edge Function rather than a client call). The
// client also wipes all on-device data separately (deleteAllDynastyData).
//
// Deployed to project `ucfqhluvuvakfordrexr` with verify_jwt = true, so the
// platform rejects unauthenticated calls before this runs.

import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json({ error: 'missing authorization' }, 401);

  const url = Deno.env.get('SUPABASE_URL')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  // Identify the caller from their own JWT (never trust a uid from the body).
  const userClient = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } });
  const { data: { user }, error: userErr } = await userClient.auth.getUser();
  if (userErr || !user) return json({ error: 'invalid session' }, 401);

  const admin = createClient(url, serviceKey);

  // 1) Remove every object in the user's Storage folder (saves + meta sidecars).
  try {
    const { data: objects } = await admin.storage.from('saves').list(user.id, { limit: 100 });
    if (objects && objects.length > 0) {
      await admin.storage.from('saves').remove(objects.map(o => `${user.id}/${o.name}`));
    }
  } catch (_) {
    // Best-effort: a storage hiccup must not block deleting the auth user.
  }

  // 2) Delete the auth user itself (irreversible). This is the part that needs
  //    the service role and can't be done from the client.
  const { error: delErr } = await admin.auth.admin.deleteUser(user.id);
  if (delErr) return json({ error: delErr.message }, 500);

  return json({ ok: true });
});
