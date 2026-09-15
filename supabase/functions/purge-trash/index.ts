import { createClient } from "npm:@supabase/supabase-js@2.57.4";

Deno.serve(async (request) => {
  if (request.headers.get("authorization") !== `Bearer ${Deno.env.get("CRON_SECRET")}`) return new Response("Unauthorized", { status: 401 });
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const cutoff = new Date(Date.now() - 30 * 86400000).toISOString();
  const { data, error } = await admin.from("label_records").select("id, photo_path").lt("deleted_at", cutoff);
  if (error) return new Response(error.message, { status: 500 });
  const paths = (data || []).map((row) => row.photo_path).filter(Boolean);
  if (paths.length) await admin.storage.from("label-photos").remove(paths);
  if (data?.length) await admin.from("label_records").delete().in("id", data.map((row) => row.id));
  await admin.from("submission_attempts").delete().lt("created_at", new Date(Date.now() - 86400000).toISOString());
  return Response.json({ removed: data?.length || 0 });
});
