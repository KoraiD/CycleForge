"use client";

import { LngLatBounds } from "maplibre-gl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Map, { Layer, Marker, Source, type MapRef } from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import { ROUTE_COLORS } from "@/lib/constants";
import { nearestKmAlongLine, pointAtKm } from "@/lib/geometry";
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
  hoverKm = null,
  onHoverKm,
  previewRouteId = null,
  onPreviewRoute,
}: {
  routes: RouteCandidate[];
  selectedRouteId: string;
  onSelect: (routeId: string) => void;
  hoverKm?: number | null;
  onHoverKm?: (km: number | null) => void;
  previewRouteId?: string | null;
  onPreviewRoute?: (routeId: string | null) => void;
}) {
  const mapRef = useRef<MapRef>(null);
  const [hintVisible, setHintVisible] = useState(true);
  const [legendOpen, setLegendOpen] = useState(true);

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

  const hoverPoint = useMemo(() => {
    if (hoverKm === null || hoverKm === undefined || !selected) return null;
    return pointAtKm(selected.geometry.coordinates, hoverKm);
  }, [hoverKm, selected]);

  useEffect(() => {
    if (!hintVisible) return;
    const t = window.setTimeout(() => setHintVisible(false), 5000);
    return () => window.clearTimeout(t);
  }, [hintVisible]);

  const dismissHint = useCallback(() => setHintVisible(false), []);

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
    dismissHint();
    const feature = e.features?.[0];
    const id = feature?.properties?.id;
    if (typeof id === "string") onSelect(id);
  };

  const onMapMouseMove = (e: {
    features?: Array<{ properties?: Record<string, unknown> | null }>;
    lngLat: { lng: number; lat: number };
  }) => {
    const feature = e.features?.[0];
    const id = feature?.properties?.id;
    if (typeof id === "string") {
      onPreviewRoute?.(id === selectedRouteId ? null : id);
      if (id === selectedRouteId && selected) {
        const km = nearestKmAlongLine(
          selected.geometry.coordinates,
          e.lngLat.lng,
          e.lngLat.lat,
        );
        onHoverKm?.(km);
      } else {
        onHoverKm?.(null);
      }
    }
  };

  const onMapMouseLeave = () => {
    onHoverKm?.(null);
    onPreviewRoute?.(null);
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
        onMouseMove={onMapMouseMove}
        onMouseLeave={onMapMouseLeave}
        onLoad={fitAll}
      >
        {routes.map((route, index) => {
          const isSelected = route.routeId === selectedRouteId;
          const isPreview = route.routeId === previewRouteId;
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
                  "line-width": isSelected ? 5.5 : isPreview ? 4 : 3,
                  "line-opacity": isSelected ? 0.95 : isPreview ? 0.75 : 0.35,
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
        {hoverPoint && (
          <Marker
            longitude={hoverPoint[0]}
            latitude={hoverPoint[1]}
            anchor="center"
          >
            <span className="map-hover-dot" title="Elevation sync" />
          </Marker>
        )}
      </Map>

      <div className="map-chrome">
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
        <button
          type="button"
          className="map-legend-toggle"
          aria-expanded={legendOpen}
          onClick={() => setLegendOpen((v) => !v)}
        >
          {legendOpen ? "Hide routes" : "Routes"}
        </button>
      </div>

      {legendOpen ? (
        <div
          className="route-map__legend"
          role="listbox"
          aria-label="Route candidates"
        >
          {routes.map((route, index) => {
            const active = route.routeId === selectedRouteId;
            const preview = route.routeId === previewRouteId;
            return (
              <button
                key={route.routeId}
                type="button"
                role="option"
                aria-selected={active}
                className={
                  active ? "active" : preview ? "preview" : undefined
                }
                onClick={() => {
                  dismissHint();
                  onSelect(route.routeId);
                }}
                onMouseEnter={() =>
                  onPreviewRoute?.(
                    route.routeId === selectedRouteId ? null : route.routeId,
                  )
                }
                onMouseLeave={() => onPreviewRoute?.(null)}
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
      ) : null}

      {hintVisible ? (
        <p className="route-map__hint">
          Hover the route for elevation · click to select
        </p>
      ) : null}
    </div>
  );
}
