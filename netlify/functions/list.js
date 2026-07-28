import { getStore } from "@netlify/blobs";

export default async () => {
  try {
    const store = getStore({ name: "gallery", consistency: "strong" });
    const manifest = (await store.get("manifest", { type: "json" })) || [];
    return new Response(JSON.stringify(manifest), {
      headers: { "content-type": "application/json", "cache-control": "no-store" },
    });
  } catch (err) {
    return new Response(JSON.stringify([]), {
      headers: { "content-type": "application/json" },
    });
  }
};

export const config = { path: "/api/list" };
