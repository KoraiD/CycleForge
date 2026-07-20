import { queryStackStats } from "@/lib/clickhouse";

export async function GET() {
  const stats = await queryStackStats();
  return Response.json(stats);
}
