import { suggestNearbyStarts } from "@/lib/nearby-starts";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const lat = Number(searchParams.get("lat"));
  const lng = Number(searchParams.get("lng"));
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return Response.json({ error: "lat and lng required" }, { status: 400 });
  }
  const results = await suggestNearbyStarts(lat, lng);
  return Response.json({ results });
}
