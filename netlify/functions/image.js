import { getStore } from "@netlify/blobs";

export default async (req) => {
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  const size = url.searchParams.get("size");
  if (!id) return new Response("Identifiant manquant", { status: 400 });

  const store = getStore({ name: "gallery", consistency: "strong" });

  if (size === "thumb") {
    const thumbResult = await store.getWithMetadata(`images/${id}-thumb`, { type: "arrayBuffer" });
    if (thumbResult) {
      const contentType = thumbResult.metadata?.contentType || "application/octet-stream";
      return new Response(thumbResult.data, {
        headers: {
          "content-type": contentType,
          "cache-control": "public, max-age=31536000, immutable",
        },
      });
    }
    // Pas encore de vignette pour cette image (déposée avant la mise en place
    // des vignettes) : on retombe sur l'image complète plutôt que d'échouer.
  }

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
