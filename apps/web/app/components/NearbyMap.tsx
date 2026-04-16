"use client";

import { useEffect, useRef, useState, useCallback } from "react";

interface Clinic {
  id: number;
  name: string;
  type: string;
  lat: number;
  lng: number;
}

const TYPE_COLORS: Record<string, string> = {
  hospital: "#E14B4B", clinic: "#2DD4BF", doctors: "#60A5FA", pharmacy: "#A78BFA",
};
const TYPE_ICONS: Record<string, string> = {
  hospital: "🏥", clinic: "🏨", doctors: "👨‍⚕️", pharmacy: "💊",
};

export default function NearbyMap() {
  const containerRef   = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef         = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const layerGroupRef  = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const routeLayerRef  = useRef<any>(null);   // holds the drawn route polyline
  const userLocRef     = useRef<{ lat: number; lng: number } | null>(null);

  const [query, setQuery]         = useState("");
  const [status, setStatus]       = useState<"locating"|"searching"|"done"|"error">("locating");
  const [statusMsg, setStatusMsg] = useState("Detecting your location…");
  const [clinics, setClinics]     = useState<Clinic[]>([]);
  const [selected, setSelected]   = useState<Clinic | null>(null);
  const [routeInfo, setRouteInfo] = useState<{ distance: string; duration: string } | null>(null);
  const [routing, setRouting]     = useState(false);

  // ─── Fetch clinics ─────────────────────────────────────────────────────────
  const fetchClinics = useCallback(async (lat: number, lng: number, label: string) => {
    const L = await import("leaflet");
    const map   = mapRef.current;
    const group = layerGroupRef.current;
    if (!map || !group) return;

    // Store user location for routing
    userLocRef.current = { lat, lng };

    group.clearLayers();
    map.setView([lat, lng], 14);

    // Blue pulsing dot — current position
    const youIcon = L.divIcon({
      className: "",
      iconSize: [20, 20], iconAnchor: [10, 10],
      html: `<div style="width:20px;height:20px;background:#2563EB;border-radius:50%;border:3px solid #fff;box-shadow:0 0 0 6px rgba(37,99,235,0.18);"></div>`,
    });
    L.marker([lat, lng], { icon: youIcon })
      .addTo(group)
      .bindPopup(`<strong>📍 You are here</strong><br/><span style="font-size:.75rem;color:#6B7280">${label}</span>`)
      .openPopup();

    setStatus("searching");
    setStatusMsg("Searching for nearby clinics…");

    try {
      const res  = await fetch(`/api/nearby-clinics?lat=${lat}&lng=${lng}&radius=5000`);
      const data = await res.json();

      // Distinguish API error from genuinely empty results
      if (data.error && (!data.elements || data.elements.length === 0)) {
        setStatus("done");
        setStatusMsg("Live clinic service is busy right now. You can search another place or retry in a moment.");
        return;
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const results: Clinic[] = (data.elements ?? []).map((el: any) => ({
        id: el.id,
        name: el.tags?.name || el.tags?.amenity || "Unnamed facility",
        type: el.tags?.amenity || el.tags?.healthcare || "clinic",
        lat: el.lat ?? el.center?.lat,
        lng: el.lon ?? el.center?.lon,
      })).filter((c: Clinic) => c.lat && c.lng);

      setClinics(results);

      results.forEach((c) => {
        const color = TYPE_COLORS[c.type] ?? "#0F4C5C";
        const emoji = TYPE_ICONS[c.type] ?? "🏥";
        const icon  = L.divIcon({
          className: "",
          iconSize: [34, 34], iconAnchor: [17, 34], popupAnchor: [0, -38],
          html: `<div style="width:34px;height:34px;background:${color};border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:3px solid #fff;box-shadow:0 3px 10px rgba(0,0,0,.25);display:flex;align-items:center;justify-content:center;">
                   <span style="transform:rotate(45deg);font-size:14px;display:block;line-height:28px;text-align:center">${emoji}</span>
                 </div>`,
        });
        L.marker([c.lat, c.lng], { icon })
          .addTo(group)
          .bindPopup(`
            <div style="font-family:system-ui,sans-serif;min-width:160px">
              <div style="font-size:.9rem;margin-bottom:3px">${emoji}</div>
              <strong style="font-size:.86rem;color:#0A1628">${c.name}</strong>
              <div style="font-size:.72rem;color:${color};font-weight:700;margin-top:3px;text-transform:capitalize">${c.type}</div>
            </div>
          `);
      });

      setStatus("done");
      setStatusMsg(results.length > 0
        ? `Found ${results.length} nearby healthcare providers. Click one to get directions.`
        : "No clinics found nearby. Try a different area.");
    } catch {
      setStatus("error");
      setStatusMsg("Could not fetch nearby clinics.");
    }
  }, []);

  // ─── Draw route on map ─────────────────────────────────────────────────────
  const drawRoute = useCallback(async (clinic: Clinic) => {
    const userLoc = userLocRef.current;
    if (!userLoc || !mapRef.current) return;

    setRouting(true);
    setRouteInfo(null);

    try {
      const res  = await fetch(
        `/api/route-direction?startLat=${userLoc.lat}&startLng=${userLoc.lng}&endLat=${clinic.lat}&endLng=${clinic.lng}`
      );
      const data = await res.json();

      if (!data.routes?.[0]) { setRouting(false); return; }

      const L    = await import("leaflet");
      const map  = mapRef.current;
      const route = data.routes[0];

      // Remove previous route if any
      if (routeLayerRef.current) {
        routeLayerRef.current.remove();
        routeLayerRef.current = null;
      }

      // GeoJSON coords are [lng, lat] — flip to [lat, lng] for Leaflet
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const latlngs = route.geometry.coordinates.map((c: any) => [c[1], c[0]]);

      const polyline = L.polyline(latlngs, {
        color: "#2563EB",
        weight: 5,
        opacity: 0.85,
        dashArray: undefined,
        lineJoin: "round",
      }).addTo(map);

      routeLayerRef.current = polyline;
      map.fitBounds(polyline.getBounds(), { padding: [40, 40] });

      // Distance & duration
      const dist = route.legs[0].distance;
      const dur  = route.legs[0].duration;
      setRouteInfo({
        distance: dist >= 1000 ? `${(dist / 1000).toFixed(1)} km` : `${Math.round(dist)} m`,
        duration: dur  >= 3600
          ? `${Math.floor(dur / 3600)}h ${Math.floor((dur % 3600) / 60)}min`
          : `${Math.ceil(dur / 60)} min`,
      });
    } catch {
      // silently fail — still selects the clinic
    } finally {
      setRouting(false);
    }
  }, []);

  // ─── Clear route ───────────────────────────────────────────────────────────
  const clearRoute = useCallback(() => {
    if (routeLayerRef.current) {
      routeLayerRef.current.remove();
      routeLayerRef.current = null;
    }
    setSelected(null);
    setRouteInfo(null);
  }, []);

  // ─── Card click — select + draw route ─────────────────────────────────────
  const selectClinic = useCallback((c: Clinic) => {
    setSelected(c);
    mapRef.current?.setView([c.lat, c.lng], 16, { animate: true });
    drawRoute(c);
  }, [drawRoute]);

  // ─── Leaflet init + auto-geolocation ──────────────────────────────────────
  useEffect(() => {
    if (mapRef.current || !containerRef.current) return;

    import("leaflet").then((L) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl:       "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl:     "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });

      const map = L.map(containerRef.current!, {
        center: [20.5937, 78.9629], zoom: 5,
        scrollWheelZoom: false, zoomControl: true,
      });
      mapRef.current       = map;
      layerGroupRef.current = L.layerGroup().addTo(map);

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap contributors", maxZoom: 19,
      }).addTo(map);

      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => fetchClinics(pos.coords.latitude, pos.coords.longitude, "Your current location"),
          () => { setStatus("error"); setStatusMsg("Location denied. Search for a place above."); },
          { timeout: 12000 }
        );
      } else {
        setStatus("error");
        setStatusMsg("Geolocation not supported. Search for a place above.");
      }
    });

    return () => { if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; } };
  }, [fetchClinics]);

  // ─── GPS button ────────────────────────────────────────────────────────────
  const handleLocate = useCallback(() => {
    if (!navigator.geolocation) return;
    setStatus("locating"); setStatusMsg("Getting your location…");
    clearRoute();
    navigator.geolocation.getCurrentPosition(
      (pos) => fetchClinics(pos.coords.latitude, pos.coords.longitude, "Your current location"),
      () => { setStatus("error"); setStatusMsg("Location denied. Please search manually."); },
      { timeout: 12000 }
    );
  }, [fetchClinics, clearRoute]);

  // ─── Place search ──────────────────────────────────────────────────────────
  const handleSearch = useCallback(async () => {
    if (!query.trim()) return;
    setStatus("locating"); setStatusMsg(`Searching for "${query}"…`);
    clearRoute();
    try {
      const res  = await fetch(`/api/geocode?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      if (!Array.isArray(data) || !data.length) {
        setStatus("error"); setStatusMsg("Place not found. Try a more specific name."); return;
      }
      fetchClinics(parseFloat(data[0].lat), parseFloat(data[0].lon), data[0].display_name);
    } catch {
      setStatus("error"); setStatusMsg("Search failed. Please try again.");
    }
  }, [query, fetchClinics, clearRoute]);

  const isLoading = status === "locating" || status === "searching";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

      {/* Search bar */}
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <button onClick={handleLocate} title="Use my location"
          style={{ width: 46, height: 46, borderRadius: 12, border: "1.5px solid rgba(15,76,92,0.18)", background: "rgba(255,255,255,0.9)", cursor: "pointer", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.2rem", boxShadow: "0 2px 8px rgba(0,0,0,.06)", transition: "all 0.2s" }}>
          {isLoading ? "⏳" : "📍"}
        </button>
        <div style={{ flex: 1, position: "relative" }}>
          <input type="text" value={query} onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            placeholder="Search a city, area, or address…"
            style={{ width: "100%", height: 46, borderRadius: 12, boxSizing: "border-box", border: "1.5px solid rgba(15,76,92,0.18)", padding: "0 50px 0 16px", fontSize: "0.875rem", color: "#0A1628", background: "rgba(255,255,255,0.9)", outline: "none", boxShadow: "0 2px 8px rgba(0,0,0,.06)" }}
            onFocus={(e) => { e.currentTarget.style.borderColor = "#0F4C5C"; }}
            onBlur={(e)  => { e.currentTarget.style.borderColor = "rgba(15,76,92,0.18)"; }}
          />
          <button onClick={handleSearch} title="Search"
            style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", width: 32, height: 32, borderRadius: 8, border: "none", background: "linear-gradient(135deg, #0f4c5c, #2579c7)", cursor: "pointer", fontSize: "0.9rem", display: "flex", alignItems: "center", justifyContent: "center" }}>
            🔍
          </button>
        </div>
      </div>

      {/* Status / route info bar */}
      {routeInfo ? (
        <div style={{ padding: "10px 16px", borderRadius: 10, background: "rgba(37,99,235,0.08)", border: "1px solid rgba(37,99,235,0.2)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: "1.1rem" }}>🛣️</span>
            <div>
              <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "#1d4ed8" }}>{selected?.name}</span>
              <div style={{ display: "flex", gap: 16, marginTop: 2 }}>
                <span style={{ fontSize: "0.78rem", color: "#2563EB", fontWeight: 600 }}>📏 {routeInfo.distance}</span>
                <span style={{ fontSize: "0.78rem", color: "#2563EB", fontWeight: 600 }}>🕐 {routeInfo.duration} by car</span>
              </div>
            </div>
          </div>
          <button onClick={clearRoute}
            style={{ padding: "5px 12px", borderRadius: 8, border: "1px solid rgba(37,99,235,0.3)", background: "rgba(255,255,255,0.8)", color: "#2563EB", fontSize: "0.75rem", fontWeight: 600, cursor: "pointer" }}>
            ✕ Clear
          </button>
        </div>
      ) : (
        <div style={{ padding: "9px 16px", borderRadius: 10, display: "flex", alignItems: "center", gap: 8,
          background: status === "error" ? "rgba(225,75,75,0.08)" : status === "done" ? "rgba(34,197,94,0.08)" : "rgba(15,76,92,0.06)",
          border: `1px solid ${status === "error" ? "rgba(225,75,75,0.2)" : status === "done" ? "rgba(34,197,94,0.2)" : "rgba(15,76,92,0.1)"}`,
          fontSize: "0.8rem", color: status === "error" ? "#B91C1C" : status === "done" ? "#15803D" : "#4B5563" }}>
          <span>{isLoading ? "⏳" : status === "error" ? "⚠️" : "✅"}</span>
          {statusMsg}
        </div>
      )}

      {/* Map + sidebar */}
      <div style={{ display: "flex", gap: 20, alignItems: "flex-start" }}>

        {/* Sidebar */}
        <div style={{ width: 280, flexShrink: 0, display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <p style={{ fontSize: "0.7rem", fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.1em", margin: 0 }}>
              {clinics.length > 0 ? `${clinics.length} providers found` : "Nearby Providers"}
            </p>
            {clinics.length > 0 && !routing && (
              <span style={{ fontSize: "0.65rem", color: "#2563EB", fontWeight: 600 }}>🗺️ Click for directions</span>
            )}
            {routing && <span style={{ fontSize: "0.65rem", color: "#9CA3AF" }}>Routing…</span>}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 440, overflowY: "auto" }}>

            {/* Skeletons */}
            {isLoading && Array.from({ length: 5 }).map((_, i) => (
              <div key={i} style={{ padding: "13px 15px", borderRadius: 12, border: "1.5px solid rgba(15,76,92,0.08)", background: "rgba(255,255,255,0.6)", display: "flex", gap: 10, alignItems: "center" }}>
                <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#e8eef2", flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ height: 10, borderRadius: 6, background: "#e8eef2", marginBottom: 7 }} />
                  <div style={{ height: 8, width: "60%", borderRadius: 6, background: "#e8eef2" }} />
                </div>
              </div>
            ))}

            {/* Clinic cards */}
            {!isLoading && clinics.map((c) => {
              const color = TYPE_COLORS[c.type] ?? "#0F4C5C";
              const emoji = TYPE_ICONS[c.type] ?? "🏥";
              const isSelected = selected?.id === c.id;
              return (
                <div key={c.id} onClick={() => selectClinic(c)}
                  style={{ padding: "11px 13px", borderRadius: 12, cursor: "pointer",
                    border: `1.5px solid ${isSelected ? "#2563EB" : "rgba(15,76,92,0.12)"}`,
                    background: isSelected ? "rgba(37,99,235,0.06)" : "rgba(255,255,255,0.9)",
                    boxShadow: isSelected ? "0 4px 18px rgba(37,99,235,0.15)" : "0 2px 8px rgba(0,0,0,.04)",
                    transition: "all 0.18s" }}
                  onMouseEnter={(e) => { if (!isSelected) { e.currentTarget.style.borderColor = color; e.currentTarget.style.background = `${color}0d`; }}}
                  onMouseLeave={(e) => { if (!isSelected) { e.currentTarget.style.borderColor = "rgba(15,76,92,0.12)"; e.currentTarget.style.background = "rgba(255,255,255,0.9)"; }}}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                    <span style={{ fontSize: "1.3rem", flexShrink: 0 }}>{emoji}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "#0A1628", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</div>
                      <div style={{ fontSize: "0.68rem", color, fontWeight: 600, textTransform: "capitalize", marginTop: 2 }}>{c.type}</div>
                    </div>
                    <span style={{ fontSize: "0.75rem", color: isSelected ? "#2563EB" : "#9CA3AF" }}>
                      {isSelected ? "🗺️" : "→"}
                    </span>
                  </div>
                </div>
              );
            })}

            {/* Empty */}
            {!isLoading && status === "done" && clinics.length === 0 && (
              <div style={{ padding: "28px 16px", textAlign: "center", borderRadius: 14, border: "1.5px dashed rgba(15,76,92,0.15)", background: "rgba(255,255,255,0.5)" }}>
                <div style={{ fontSize: "1.6rem", marginBottom: 8 }}>🔍</div>
                <p style={{ fontSize: "0.8rem", color: "#9CA3AF", margin: 0 }}>No clinics found nearby. Try a different area.</p>
              </div>
            )}

            {/* Error */}
            {!isLoading && status === "error" && (
              <div style={{ padding: "28px 16px", textAlign: "center", borderRadius: 14, border: "1.5px dashed rgba(15,76,92,0.15)", background: "rgba(255,255,255,0.5)" }}>
                <div style={{ fontSize: "1.6rem", marginBottom: 8 }}>📍</div>
                <p style={{ fontSize: "0.8rem", color: "#9CA3AF", margin: 0, lineHeight: 1.6 }}>Allow location access or search a city to find nearby clinics.</p>
              </div>
            )}
          </div>
        </div>

        {/* Map */}
        <div style={{ flex: 1, height: 480, borderRadius: 20, overflow: "hidden", border: "1px solid rgba(15,76,92,0.14)", boxShadow: "0 8px 32px rgba(15,76,92,0.08)" }}>
          <div ref={containerRef} style={{ width: "100%", height: "100%" }} />
        </div>
      </div>
    </div>
  );
}
