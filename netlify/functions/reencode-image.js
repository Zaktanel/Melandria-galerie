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

  const { id, contentType, dataBase64, thumbContentType, thumbDataBase64 } = body;
  if (!id || !dataBase64 || !contentType) {
    return new Response(JSON.stringify({ error: "Données manquantes" }), { status: 400 });
  }

  const store = getStore({ name: "gallery", consistency: "strong" });
  const manifest = (await store.get("manifest", { type: "json" })) || [];
  const idx = manifest.findIndex((e) => e.id === id);
  if (idx === -1) {
    return new Response(JSON.stringify({ error: "Illustration introuvable" }), { status: 404 });
  }

  const filename = manifest[idx].filename || "illustration";
  const buffer = Buffer.from(dataBase64, "base64");
  await store.set(`images/${id}`, buffer, { metadata: { contentType, filename } });

  if (thumbDataBase64 && thumbContentType) {
    const thumbBuffer = Buffer.from(thumbDataBase64, "base64");
    await store.set(`images/${id}-thumb`, thumbBuffer, {
      metadata: { contentType: thumbContentType, filename },
    });
  }

  manifest[idx].contentType = contentType;
  await store.setJSON("manifest", manifest);

  return new Response(JSON.stringify({ success: true }), {
    headers: { "content-type": "application/json" },
  });
};

export const config = { path: "/api/reencode-image" };
