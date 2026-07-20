"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Map, { Marker, NavigationControl, type MapRef } from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";

export function StartPickerMap({
  lat,
  lng,
  onPick,
}: {
  lat: number;
  lng: number;
  onPick: (coords: { lat: number; lng: number }) => void;
}) {
  const mapRef = useRef<MapRef>(null);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const [zoom, setZoom] = useState(13);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.easeTo({ center: [lng, lat], duration: 280 });
  }, [lat, lng]);

  const useMyLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setGeoError("Geolocation is not supported in this browser.");
      return;
    }
    setLocating(true);
    setGeoError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const next = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        };
        onPick(next);
        mapRef.current?.flyTo({
          center: [next.lng, next.lat],
          zoom: 14,
          duration: 800,
        });
        setZoom(14);
        setLocating(false);
      },
      (err) => {
        setGeoError(
          err.code === err.PERMISSION_DENIED
            ? "Location permission denied — enable it in the browser."
            : "Could not read your location.",
        );
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 12000 },
    );
  }, [onPick]);

  return (
    <div className="start-picker-map">
      <Map
        ref={mapRef}
        longitude={lng}
        latitude={lat}
        zoom={zoom}
        onMove={(e) => setZoom(e.viewState.zoom)}
        style={{ width: "100%", height: "100%" }}
        mapStyle="https://basemaps.cartocdn.com/gl/positron-gl-style/style.json"
        attributionControl={false}
        onClick={(e) => {
          onPick({ lat: e.lngLat.lat, lng: e.lngLat.lng });
        }}
        cursor="crosshair"
      >
        <NavigationControl position="top-right" showCompass={false} />
        <Marker
          longitude={lng}
          latitude={lat}
          anchor="center"
          draggable
          onDragEnd={(e) => {
            onPick({ lat: e.lngLat.lat, lng: e.lngLat.lng });
          }}
        >
          <span className="start-pin start-pin--draggable" aria-hidden />
        </Marker>
      </Map>
      <div className="start-picker-toolbar">
        <button
          type="button"
          className="ghost start-locate"
          onClick={useMyLocation}
          disabled={locating}
        >
          {locating ? "Locating…" : "Use my location"}
        </button>
        <p className="start-picker-hint">Scroll to zoom · drag pin · click map</p>
      </div>
      {geoError ? <p className="start-geo-error">{geoError}</p> : null}
    </div>
  );
}
