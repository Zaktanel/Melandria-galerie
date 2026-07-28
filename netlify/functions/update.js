import { getStore } from "@netlify/blobs";

export default async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Méthode non autorisée" }), { status: 405 });
  }

  const password = req.headers.get("x-admin-password");
  if (!password || password !== process.env.ADMIN_PASSWORD) {
    return new Response(JSON.stringify({ error: "Mot de passe incorrect" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Corps de requête invalide" }), { status: 400 });
  }

  const { id, tags, caption, campaign } = body;
  if (!id) return new Response(JSON.stringify({ error: "Identifiant manquant" }), { status: 400 });

  const store = getStore("gallery");
  const manifest = (await store.get("manifest", { type: "json" })) || [];
  const idx = manifest.findIndex((e) => e.id === id);
  if (idx === -1) {
    return new Response(JSON.stringify({ error: "Illustration introuvable" }), { status: 404 });
  }

  if (Array.isArray(tags)) manifest[idx].tags = tags;
  if (typeof caption === "string") manifest[idx].caption = caption;
  if (typeof campaign === "string") manifest[idx].campaign = campaign;

  await store.setJSON("manifest", manifest);

  return new Response(JSON.stringify({ success: true, entry: manifest[idx] }), {
    headers: { "content-type": "application/json" },
  });
};

export const config = { path: "/api/update" };
