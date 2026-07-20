import { geocodeAddress } from "@/lib/geocode";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) {
    return Response.json({ results: [] });
  }
  const results = await geocodeAddress(q, 6);
  return Response.json({ results });
}
