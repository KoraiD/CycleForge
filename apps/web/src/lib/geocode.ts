export type GeocodeHit = {
  label: string;
  lat: number;
  lng: number;
  country?: string;
};

/** Open-Meteo geocoding — no API key required. */
export async function geocodeAddress(
  query: string,
  limit = 5,
): Promise<GeocodeHit[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  const url = new URL("https://geocoding-api.open-meteo.com/v1/search");
  url.searchParams.set("name", q);
  url.searchParams.set("count", String(limit));
  url.searchParams.set("language", "en");
  url.searchParams.set("format", "json");

  const res = await fetch(url.toString());
  if (!res.ok) return [];

  const data = (await res.json()) as {
    results?: Array<{
      name?: string;
      latitude?: number;
      longitude?: number;
      country?: string;
      admin1?: string;
    }>;
  };

  return (data.results ?? [])
    .filter(
      (r) =>
        typeof r.latitude === "number" && typeof r.longitude === "number" && r.name,
    )
    .map((r) => ({
      label: [r.name, r.admin1, r.country].filter(Boolean).join(", "),
      lat: r.latitude as number,
      lng: r.longitude as number,
      country: r.country,
    }));
}
