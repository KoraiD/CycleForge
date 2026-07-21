"use client";

import { LngLatBounds } from "maplibre-gl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Map, {
  Layer,
  Marker,
  NavigationControl,
  Source,
  type MapRef,
} from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import { ROUTE_COLORS } from "@/lib/constants";
import { nearestKmAlongLine, pointAtKm } from "@/lib/geometry";
import {
  roadMixForRoute,
  roadTypeGeometries,
  ROAD_TYPE_META,
} from "@/lib/road-types";
import type { RouteCandidate } from "@/lib/types";
import {
  buildWindSegments,
  windSegmentColor,
} from "@/lib/wind-segments";

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
  morphFrom = null,
}: {
  routes: RouteCandidate[];
  selectedRouteId: string;
  onSelect: (routeId: string) => void;
  hoverKm?: number | null;
  onHoverKm?: (km: number | null) => void;
  previewRouteId?: string | null;
  onPreviewRoute?: (routeId: string | null) => void;
  /** Previous selected geometry for regenerate morph ghost. */
  morphFrom?: GeoJSON.LineString | null;
}) {
  const mapRef = useRef<MapRef>(null);
  const [hintVisible, setHintVisible] = useState(true);
  const [legendOpen, setLegendOpen] = useState(true);
  const [morphOpacity, setMorphOpacity] = useState(0);
  const [showRoadTypes, setShowRoadTypes] = useState(true);

  useEffect(() => {
    if (!morphFrom) {
      const clear = window.setTimeout(() => setMorphOpacity(0), 0);
      return () => window.clearTimeout(clear);
    }
    const fadeIn = window.setTimeout(() => setMorphOpacity(0.55), 0);
    const fadeOut = window.setTimeout(() => setMorphOpacity(0), 1200);
    return () => {
      window.clearTimeout(fadeIn);
      window.clearTimeout(fadeOut);
    };
  }, [morphFrom, selectedRouteId]);

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
  const weather = selected?.weather ?? null;
  const windDir = weather?.windDirDeg ?? 0;
  const windKmh = weather?.windKmh ?? 0;
  const windSegments = useMemo(() => {
    if (!selected || windKmh < 8) return [];
    return buildWindSegments(selected, windDir);
  }, [selected, windDir, windKmh]);

  const hoverPoint = useMemo(() => {
    if (hoverKm === null || hoverKm === undefined || !selected) return null;
    return pointAtKm(selected.geometry.coordinates, hoverKm);
  }, [hoverKm, selected]);

  const roadTypeSegs = useMemo(() => {
    if (!selected || !showRoadTypes) return [];
    return roadTypeGeometries(selected, roadMixForRoute(selected));
  }, [selected, showRoadTypes]);

  const roadTypesPresent = useMemo(() => {
    if (!selected) return [];
    return [...new Set(roadMixForRoute(selected).kmByType.map((t) => t.type))];
  }, [selected]);

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

  /** Fit the selected route specifically — the Fit button's visible action. */
  const fitSelected = useCallback(() => {
    const map = mapRef.current;
    if (!map || !selected) return;
    const coords = selected.geometry.coordinates;
    if (!coords.length) return;
    const first = coords[0] as [number, number];
    const bounds = coords.reduce(
      (b, c) => b.extend(c as [number, number]),
      new LngLatBounds(first, first),
    );
    map.fitBounds(bounds, { padding: 64, duration: 550, maxZoom: 14 });
  }, [selected]);

  // Refit when regenerate swaps geometry (e.g. Amsterdam → Budapest).
  useEffect(() => {
    const t = window.setTimeout(() => fitAll(), 50);
    return () => window.clearTimeout(t);
  }, [fitAll, selectedRouteId]);

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
        <NavigationControl position="bottom-right" showCompass={false} />
        {morphFrom && morphOpacity > 0.02 ? (
          <Source
            id="morph-ghost"
            type="geojson"
            data={{
              type: "Feature",
              properties: {},
              geometry: morphFrom,
            }}
          >
            <Layer
              id="morph-ghost-line"
              type="line"
              paint={{
                "line-color": "#1c211c",
                "line-width": 4,
                "line-opacity": morphOpacity,
                "line-dasharray": [1.5, 1.5],
              }}
              layout={{ "line-cap": "round", "line-join": "round" }}
            />
          </Source>
        ) : null}
        {roadTypeSegs.map((seg, i) => (
          <Source
            key={`road-${i}-${seg.type}`}
            id={`road-seg-${i}`}
            type="geojson"
            data={{
              type: "Feature",
              properties: {},
              geometry: { type: "LineString", coordinates: seg.coordinates },
            }}
          >
            <Layer
              id={`road-line-${i}`}
              type="line"
              paint={{
                "line-color": ROAD_TYPE_META[seg.type].color,
                "line-width": 3.2,
                "line-opacity": 0.9,
                ...(ROAD_TYPE_META[seg.type].pattern
                  ? { "line-dasharray": ROAD_TYPE_META[seg.type].pattern === "dot" ? [0.6, 1.6] : [2.2, 1.4] }
                  : {}),
              }}
              layout={{ "line-cap": "round", "line-join": "round" }}
            />
          </Source>
        ))}
        {windSegments.map((seg, i) => (
          <Source
            key={`wind-${i}-${seg.fromKm}`}
            id={`wind-seg-${i}`}
            type="geojson"
            data={{
              type: "Feature",
              properties: {},
              geometry: { type: "LineString", coordinates: seg.coordinates },
            }}
          >
            <Layer
              id={`wind-line-${i}`}
              type="line"
              paint={{
                "line-color": windSegmentColor(seg.headwind),
                "line-width": 7,
                "line-opacity": 0.55,
              }}
              layout={{ "line-cap": "round", "line-join": "round" }}
            />
          </Source>
        ))}
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
        {weather ? (
          <div
            className="weather-badge"
            title={`${weather.summary} · wind from ${Math.round(windDir)}°`}
          >
            <span className="weather-badge__temp">
              {Math.round(weather.tempC)}°
            </span>
            <span className="weather-badge__meta">
              {weather.summary}
              {windKmh > 0 ? (
                <span
                  className="wind-inline"
                  style={{ ["--wind-rot" as string]: `${windDir}deg` }}
                >
                  <span className="wind-badge__arrow" aria-hidden>
                    ↑
                  </span>
                  {Math.round(windKmh)} km/h
                </span>
              ) : null}
            </span>
          </div>
        ) : null}
        {windSegments.length > 0 ? (
          <div className="wind-legend" title="Route tinted by wind relative to travel">
            <span className="wind-legend__h">Head</span>
            <span className="wind-legend__c">Cross</span>
            <span className="wind-legend__t">Tail</span>
          </div>
        ) : null}
        <button
          type="button"
          className={showRoadTypes ? "map-road-toggle on" : "map-road-toggle"}
          onClick={() => setShowRoadTypes((v) => !v)}
          title="Toggle road-type coloring on the selected route"
          aria-pressed={showRoadTypes}
        >
          Roads
        </button>
        {showRoadTypes && roadTypesPresent.length > 0 ? (
          <div className="road-legend" title="Road types under the route line">
            {roadTypesPresent.map((t) => (
              <span key={t} className="road-legend__item">
                <span
                  className={`road-legend__swatch${ROAD_TYPE_META[t].pattern ? ` road-legend__swatch--${ROAD_TYPE_META[t].pattern}` : ""}`}
                  style={{ backgroundColor: ROAD_TYPE_META[t].color }}
                />
                {ROAD_TYPE_META[t].label}
              </span>
            ))}
          </div>
        ) : null}
        <button
          type="button"
          className="map-fit-btn"
          onClick={fitSelected}
          title="Zoom to fit the selected route"
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
