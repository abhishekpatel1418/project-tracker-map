// Browser-only map. Uses Leaflet + OpenStreetMap tiles for the prototype;
// swap the TileLayer for Mapbox tiles (or mapbox-gl) later without touching pages.
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { MapContainer, TileLayer, Marker, Popup, CircleMarker, useMap } from "react-leaflet";
import { useEffect } from "react";
import { Link } from "@tanstack/react-router";
import { DEPT_COLOR, type RoadProject } from "@/lib/demo-data";

function icon(color: string, active: boolean) {
  return L.divIcon({
    className: "",
    html: `<div class="rt-marker" style="background:${color};${active ? "transform:scale(1.4)" : ""}"></div>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });
}

function Recenter({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => { map.flyTo(center, map.getZoom(), { duration: 0.6 }); }, [center, map]);
  return null;
}

export default function ProjectMap({
  projects, center, user, selected, onSelect,
}: {
  projects: RoadProject[];
  center: [number, number];
  user: [number, number] | null;
  selected: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <MapContainer center={center} zoom={11} className="h-full w-full" scrollWheelZoom>
      <TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <Recenter center={center} />
      {user && <CircleMarker center={user} radius={8} pathOptions={{ color: "#fff", weight: 3, fillColor: "#2563eb", fillOpacity: 1 }} />}
      {projects.map((p) => (
        <Marker key={p.id} position={[p.lat, p.lng]} icon={icon(DEPT_COLOR[p.department], selected === p.id)} eventHandlers={{ click: () => onSelect(p.id) }}>
          <Popup>
            <div className="text-xs">
              <div className="font-semibold">{p.name}</div>
              <div>{p.department} · {p.status}</div>
              <div className="mt-1 font-mono text-[10px] uppercase">Demo / Prototype Data</div>
              <Link to="/projects/$id" params={{ id: p.id }} className="mt-1 inline-block font-semibold underline">View details</Link>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
