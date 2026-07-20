"use client";

import { useEffect, useRef } from "react";
import Map, { Marker, type MapRef } from "react-map-gl/maplibre";
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

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.easeTo({ center: [lng, lat], duration: 280 });
  }, [lat, lng]);

  return (
    <div className="start-picker-map">
      <Map
        ref={mapRef}
        longitude={lng}
        latitude={lat}
        zoom={12}
        style={{ width: "100%", height: "100%" }}
        mapStyle="https://basemaps.cartocdn.com/gl/positron-gl-style/style.json"
        attributionControl={false}
        onClick={(e) => {
          onPick({ lat: e.lngLat.lat, lng: e.lngLat.lng });
        }}
        cursor="crosshair"
      >
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
      <p className="start-picker-hint">Click map or drag the pin</p>
    </div>
  );
}
