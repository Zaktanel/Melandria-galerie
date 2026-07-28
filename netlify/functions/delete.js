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

  const { id } = body;
  if (!id) return new Response(JSON.stringify({ error: "Identifiant manquant" }), { status: 400 });

  const store = getStore("gallery");
  await store.delete(`images/${id}`);

  const manifest = (await store.get("manifest", { type: "json" })) || [];
  const updated = manifest.filter((entry) => entry.id !== id);
  await store.setJSON("manifest", updated);

  return new Response(JSON.stringify({ success: true }), {
    headers: { "content-type": "application/json" },
  });
};

export const config = { path: "/api/delete" };
