import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const catalog: Record<string, string[]> = {
  "m-10": ["Exaustor Q-904", "Ventilador Q-902-1", "Ventilador Q-902-2", "Queimador F-901-x-1", "Queimador F-901-x-2"],
  "rk-1": ["Correia T-2302", "Correia T-2304", "Correia T-2306", "Correia T-2307"],
};

const fail = (message: string, status = 400) => new Response(JSON.stringify({ error: message }), { status, headers: { ...cors, "Content-Type": "application/json" } });
const sha256 = async (value: string) => Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)))).map((byte) => byte.toString(16).padStart(2, "0")).join("");

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (request.method !== "POST") return fail("Método não permitido.", 405);

  try {
    const body = await request.formData();
    const value = (key: string) => String(body.get(key) || "").trim();
    const collaboratorName = value("collaborator_name");
    const registrationNumber = value("registration_number");
    const areaId = value("area_id");
    const equipmentName = value("equipment_id");
    const tagType = value("tag_type");
    const anomalyDescription = value("anomaly_description");
    const locationDescription = value("location_description");
    const photo = body.get("photo");

    if (!collaboratorName || collaboratorName.length > 120 || !registrationNumber || registrationNumber.length > 30) return fail("Revise a identificação do colaborador.");
    if (!catalog[areaId]?.includes(equipmentName)) return fail("Área ou equipamento inválido.");
    if (!["vermelha", "amarela", "azul"].includes(tagType)) return fail("Escolha uma etiqueta válida.");
    if (!anomalyDescription || anomalyDescription.length > 1000 || !locationDescription || locationDescription.length > 500) return fail("Revise a descrição e a localização.");
    if (photo instanceof File && (photo.size > 1048576 || photo.type !== "image/jpeg")) return fail("A foto processada deve ser JPEG e ter até 1 MB.");

    const turnstileSecret = Deno.env.get("TURNSTILE_SECRET_KEY");
    if (turnstileSecret) {
      const token = value("turnstile_token");
      const verifyData = new FormData(); verifyData.set("secret", turnstileSecret); verifyData.set("response", token);
      const verify = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body: verifyData }).then((res) => res.json());
      if (!verify.success) return fail("A verificação de segurança não foi concluída.", 403);
    }

    const url = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
    const clientIp = request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for")?.split(",")[0] || "unknown";
    const ipHash = await sha256(`${Deno.env.get("RATE_LIMIT_SECRET") || serviceKey}:${clientIp}`);
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { count: recentAttempts } = await admin.from("submission_attempts").select("id", { count: "exact", head: true }).eq("ip_hash", ipHash).gte("created_at", tenMinutesAgo);
    if ((recentAttempts || 0) >= 100) return fail("Muitos envios em sequência. Aguarde alguns minutos e tente novamente.", 429);
    let photoPath: string | null = null;

    if (photo instanceof File && photo.size) {
      photoPath = `${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.jpg`;
      const { error: uploadError } = await admin.storage.from("label-photos").upload(photoPath, photo, { contentType: "image/jpeg", upsert: false });
      if (uploadError) return fail("Não foi possível armazenar a foto.", 500);
    }

    const { error } = await admin.from("label_records").insert({
      collaborator_name: collaboratorName,
      registration_number: registrationNumber,
      area_id: areaId,
      equipment_name: equipmentName,
      tag_type: tagType,
      anomaly_description: anomalyDescription,
      location_description: locationDescription,
      photo_path: photoPath,
      photo_size_bytes: photo instanceof File ? photo.size : 0,
    });
    if (error) {
      if (photoPath) await admin.storage.from("label-photos").remove([photoPath]);
      return fail("Não foi possível salvar o registro.", 500);
    }
    await admin.from("submission_attempts").insert({ ip_hash: ipHash });
    return new Response(JSON.stringify({ ok: true }), { status: 201, headers: { ...cors, "Content-Type": "application/json" } });
  } catch {
    return fail("Falha inesperada ao processar o registro.", 500);
  }
});
