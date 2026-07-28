import { getStore } from "@netlify/blobs";

export default async (req) => {
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return new Response("Identifiant manquant", { status: 400 });

  const store = getStore({ name: "gallery", consistency: "strong" });
  const result = await store.getWithMetadata(`images/${id}`, { type: "arrayBuffer" });
  if (!result) return new Response("Introuvable", { status: 404 });

  const contentType = result.metadata?.contentType || "application/octet-stream";
  return new Response(result.data, {
    headers: {
      "content-type": contentType,
      "cache-control": "public, max-age=31536000, immutable",
    },
  });
};

export const config = { path: "/api/image" };
