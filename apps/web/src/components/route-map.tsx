"use client";

import { useEffect, useMemo } from "react";
import Map, { Layer, Source } from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import { ROUTE_COLORS } from "@/lib/constants";
import type { RouteCandidate } from "@/lib/types";

export function RouteMap({
  routes,
  selectedRouteId,
  onSelect,
}: {
  routes: RouteCandidate[];
  selectedRouteId: string;
  onSelect: (routeId: string) => void;
}) {
  const bounds = useMemo(() => {
    const coords = routes.flatMap((r) => r.geometry.coordinates);
    if (!coords.length) {
      return { longitude: 4.9, latitude: 52.37, zoom: 11 };
    }
    const lngs = coords.map((c) => c[0]);
    const lats = coords.map((c) => c[1]);
    return {
      longitude: (Math.min(...lngs) + Math.max(...lngs)) / 2,
      latitude: (Math.min(...lats) + Math.max(...lats)) / 2,
      zoom: 11,
    };
  }, [routes]);

  useEffect(() => {
    // Ensure map resizes when panel mounts
  }, [routes, selectedRouteId]);

  return (
    <div className="route-map overflow-hidden rounded-xl">
      <Map
        initialViewState={bounds}
        style={{ width: "100%", height: "100%" }}
        mapStyle="https://basemaps.cartocdn.com/gl/positron-gl-style/style.json"
        attributionControl={false}
      >
        {routes.map((route, index) => {
          const selected = route.routeId === selectedRouteId;
          const color = ROUTE_COLORS[index % ROUTE_COLORS.length];
          return (
            <Source
              key={route.routeId}
              id={`route-${route.routeId}`}
              type="geojson"
              data={{
                type: "Feature",
                properties: { id: route.routeId },
                geometry: route.geometry,
              }}
            >
              <Layer
                id={`route-line-${route.routeId}`}
                type="line"
                paint={{
                  "line-color": color,
                  "line-width": selected ? 5 : 3,
                  "line-opacity": selected ? 0.95 : 0.45,
                }}
                layout={{
                  "line-cap": "round",
                  "line-join": "round",
                }}
              />
            </Source>
          );
        })}
      </Map>
      <div className="route-map__legend">
        {routes.map((route, index) => (
          <button
            key={route.routeId}
            type="button"
            className={route.routeId === selectedRouteId ? "active" : ""}
            onClick={() => onSelect(route.routeId)}
          >
            <span
              className="swatch"
              style={{ background: ROUTE_COLORS[index % ROUTE_COLORS.length] }}
            />
            {route.label}
          </button>
        ))}
      </div>
    </div>
  );
}
