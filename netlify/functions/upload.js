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

  const { filename, contentType, dataBase64, tags, caption, campaign } = body;
  if (!dataBase64 || !contentType) {
    return new Response(JSON.stringify({ error: "Données manquantes" }), { status: 400 });
  }

  const store = getStore({ name: "gallery", consistency: "strong" });
  const id = crypto.randomUUID();
  const buffer = Buffer.from(dataBase64, "base64");

  await store.set(`images/${id}`, buffer, {
    metadata: { contentType, filename: filename || "illustration" },
  });

  const manifest = (await store.get("manifest", { type: "json" })) || [];
  const entry = {
    id,
    filename: filename || "illustration",
    tags: Array.isArray(tags) ? tags : [],
    caption: caption || "",
    campaign: campaign || "",
    uploadedAt: new Date().toISOString(),
  };
  manifest.unshift(entry);
  await store.setJSON("manifest", manifest);

  return new Response(JSON.stringify({ success: true, entry }), {
    headers: { "content-type": "application/json" },
  });
};

export const config = { path: "/api/upload" };
