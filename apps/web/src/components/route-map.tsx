"use client";

import { LngLatBounds } from "maplibre-gl";
import { useCallback, useMemo, useRef } from "react";
import Map, { Layer, Marker, Source, type MapRef } from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import { ROUTE_COLORS } from "@/lib/constants";
import type { RouteCandidate } from "@/lib/types";

function endpoint(
  route: RouteCandidate,
  which: "start" | "end",
): [number, number] | null {
  const coords = route.geometry.coordinates;
  if (!coords.length) return null;
  const c = which === "start" ? coords[0] : coords[coords.length - 1];
  return [c[0], c[1]];
}

function boundsFromRoutes(routes: RouteCandidate[]) {
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
}

export function RouteMap({
  routes,
  selectedRouteId,
  onSelect,
}: {
  routes: RouteCandidate[];
  selectedRouteId: string;
  onSelect: (routeId: string) => void;
}) {
  const mapRef = useRef<MapRef>(null);

  const selected = useMemo(
    () => routes.find((r) => r.routeId === selectedRouteId) ?? routes[0],
    [routes, selectedRouteId],
  );

  const initialView = useMemo(() => boundsFromRoutes(routes), [routes]);

  const interactiveLayerIds = useMemo(
    () => routes.map((r) => `route-hit-${r.routeId}`),
    [routes],
  );

  const start = selected ? endpoint(selected, "start") : null;
  const end = selected ? endpoint(selected, "end") : null;
  const windDir = selected?.weather?.windDirDeg ?? 0;
  const windKmh = selected?.weather?.windKmh ?? 0;

  const fitAll = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    const coords = routes.flatMap((r) => r.geometry.coordinates);
    if (!coords.length) return;
    const first = coords[0] as [number, number];
    const bounds = coords.reduce(
      (b, c) => b.extend(c as [number, number]),
      new LngLatBounds(first, first),
    );
    map.fitBounds(bounds, { padding: 56, duration: 450, maxZoom: 13 });
  }, [routes]);

  const onMapClick = (e: {
    features?: Array<{ properties?: Record<string, unknown> | null }>;
  }) => {
    const feature = e.features?.[0];
    const id = feature?.properties?.id;
    if (typeof id === "string") onSelect(id);
  };

  return (
    <div className="route-map">
      <Map
        ref={mapRef}
        initialViewState={initialView}
        style={{ width: "100%", height: "100%" }}
        mapStyle="https://basemaps.cartocdn.com/gl/positron-gl-style/style.json"
        attributionControl={false}
        interactiveLayerIds={interactiveLayerIds}
        cursor="pointer"
        onClick={onMapClick}
        onLoad={fitAll}
      >
        {routes.map((route, index) => {
          const isSelected = route.routeId === selectedRouteId;
          const color = ROUTE_COLORS[index % ROUTE_COLORS.length];
          const feature = {
            type: "Feature" as const,
            properties: { id: route.routeId },
            geometry: route.geometry,
          };
          return (
            <Source
              key={route.routeId}
              id={`route-${route.routeId}`}
              type="geojson"
              data={feature}
            >
              <Layer
                id={`route-hit-${route.routeId}`}
                type="line"
                paint={{
                  "line-color": color,
                  "line-width": 18,
                  "line-opacity": 0,
                }}
                layout={{
                  "line-cap": "round",
                  "line-join": "round",
                }}
              />
              {isSelected ? (
                <Layer
                  id={`route-outline-${route.routeId}`}
                  type="line"
                  paint={{
                    "line-color": "#1c211c",
                    "line-width": 9,
                    "line-opacity": 0.22,
                  }}
                  layout={{
                    "line-cap": "round",
                    "line-join": "round",
                  }}
                />
              ) : null}
              <Layer
                id={`route-line-${route.routeId}`}
                type="line"
                paint={{
                  "line-color": color,
                  "line-width": isSelected ? 5.5 : 3,
                  "line-opacity": isSelected ? 0.95 : 0.4,
                }}
                layout={{
                  "line-cap": "round",
                  "line-join": "round",
                }}
              />
            </Source>
          );
        })}

        {start && (
          <Marker longitude={start[0]} latitude={start[1]} anchor="center">
            <span className="map-marker map-marker--start" title="Start">
              S
            </span>
          </Marker>
        )}
        {end && (
          <Marker longitude={end[0]} latitude={end[1]} anchor="center">
            <span className="map-marker map-marker--end" title="Finish">
              F
            </span>
          </Marker>
        )}
      </Map>

      {windKmh > 0 && (
        <div
          className="wind-badge"
          title={`Wind ${Math.round(windKmh)} km/h`}
          style={{ ["--wind-rot" as string]: `${windDir}deg` }}
        >
          <span className="wind-badge__arrow" aria-hidden>
            ↑
          </span>
          <span>{Math.round(windKmh)} km/h</span>
        </div>
      )}

      <button
        type="button"
        className="map-fit-btn"
        onClick={fitAll}
        title="Fit all routes"
      >
        Fit
      </button>

      <div
        className="route-map__legend"
        role="listbox"
        aria-label="Route candidates"
      >
        {routes.map((route, index) => {
          const active = route.routeId === selectedRouteId;
          return (
            <button
              key={route.routeId}
              type="button"
              role="option"
              aria-selected={active}
              className={active ? "active" : ""}
              onClick={() => onSelect(route.routeId)}
            >
              <span
                className="swatch"
                style={{
                  background: ROUTE_COLORS[index % ROUTE_COLORS.length],
                }}
              />
              <span className="legend-label">{route.label}</span>
              <span className="legend-fit">
                {Math.round(route.score.total * 100)}
              </span>
              <span className={`legend-source legend-source--${route.source}`}>
                {route.source}
              </span>
            </button>
          );
        })}
      </div>
      <p className="route-map__hint">
        Click a route on the map or in the legend
      </p>
    </div>
  );
}
