import { logger, schemaTask, schedules } from "@trigger.dev/sdk";
import { z } from "zod";
import { upsertWeatherGridRows } from "@/lib/clickhouse";
import {
  AMS_WEATHER_BBOX,
  buildTileGrid,
  fetchOpenMeteoCurrent,
  type WeatherGridRow,
} from "@/lib/weather-grid";

async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = [];
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      results[idx] = await fn(items[idx]);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => worker()),
  );
  return results;
}

export const ingestWeatherGridTask = schemaTask({
  id: "ingest-weather-grid",
  schema: z.object({
    region: z.enum(["amsterdam"]).default("amsterdam"),
  }),
  run: async ({ region }) => {
    const bbox = region === "amsterdam" ? AMS_WEATHER_BBOX : AMS_WEATHER_BBOX;
    const tiles = buildTileGrid(bbox);
    logger.info("Ingesting weather grid", { region, tiles: tiles.length });

    const settled = await mapPool(tiles, 4, async (tile) => {
      const row = await fetchOpenMeteoCurrent(tile.lat, tile.lng);
      return row;
    });

    const rows = settled.filter((r): r is WeatherGridRow => r !== null);
    await upsertWeatherGridRows(rows);

    logger.info("Weather grid ingest complete", {
      requested: tiles.length,
      written: rows.length,
    });
    return { requested: tiles.length, written: rows.length, region };
  },
});

/** Refresh Amsterdam weather tiles every 6 hours when the worker is running. */
export const ingestWeatherGridSchedule = schedules.task({
  id: "ingest-weather-grid-schedule",
  cron: "0 */6 * * *",
  run: async () => {
    const result = await ingestWeatherGridTask.triggerAndWait({
      region: "amsterdam",
    });
    if (!result.ok) {
      throw new Error("Scheduled weather ingest failed");
    }
    return result.output;
  },
});
