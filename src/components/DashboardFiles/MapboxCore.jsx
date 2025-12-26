import React, { useEffect, useRef, memo, useCallback } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

// Your Mapbox access token
mapboxgl.accessToken = "pk.eyJ1Ijoic2h1YmhhbWd2IiwiYSI6ImNtZDV2cmJneDAydngyanFzaW1oNTM3M24ifQ.7Jb5OXpznWqjyMeAuiXhrQ";

const MapboxCore = ({
  mapRef,
  centerToRestore,
  zoomToRestore,
  styleUrl,
  manholeGeoJSON,
  wardGeoJSON,
  buildingGeoJSON,
  statusFilter,
  selectedManholeId,
  flyToLocation,
  formatExcelDate,
  onManholeClick,
  onManholeDeselect,
  onBuildingClick, // <--- Ensure this prop is received
  getManholeDateById
}) => {
  const mapContainer = useRef(null);
  const popup = useRef(new mapboxgl.Popup({ offset: 15, closeOnClick: false, closeButton: false }));
  const selectedManholeIdRef = useRef(null);
  const isPopupPinned = useRef(false);

  // Refs for data stability
  const manholeDataRef = useRef(manholeGeoJSON);
  const wardDataRef = useRef(wardGeoJSON);
  const buildingDataRef = useRef(buildingGeoJSON);
  const statusFilterRef = useRef(statusFilter);

  // Sync Refs
  useEffect(() => { manholeDataRef.current = manholeGeoJSON; }, [manholeGeoJSON]);
  useEffect(() => { wardDataRef.current = wardGeoJSON; }, [wardGeoJSON]);
  useEffect(() => { buildingDataRef.current = buildingGeoJSON; }, [buildingGeoJSON]);
  useEffect(() => { statusFilterRef.current = statusFilter; }, [statusFilter]);

  // --- DRAW LAYERS FUNCTION ---
  const drawLayers = useCallback(() => {
    // 🛑 SAFEGUARD: Ensure map exists before trying to draw
    if (!mapRef.current || !mapRef.current.isStyleLoaded()) return;

    // Define mapInstance LOCALLY from the ref
    const mapInstance = mapRef.current;

    // 1. WARD POLYGONS
    try {
      const currentWardData = wardDataRef.current;
      const hasData = currentWardData?.geometry?.coordinates?.[0]?.length >= 4;
      let wardSource = mapInstance.getSource("ward-polygon-source");

      if (wardSource && !hasData) {
        if (mapInstance.getLayer("ward-polygon-layer")) mapInstance.removeLayer("ward-polygon-layer");
        if (mapInstance.getLayer("ward-outline-layer")) mapInstance.removeLayer("ward-outline-layer");
        mapInstance.removeSource("ward-polygon-source");
      } else if (hasData) {
        if (!wardSource) mapInstance.addSource("ward-polygon-source", { type: "geojson", data: currentWardData });
        else wardSource.setData(currentWardData);

        // if (!mapInstance.getLayer("ward-polygon-layer")) {
        //   mapInstance.addLayer({
        //     id: "ward-polygon-layer", type: "fill", source: "ward-polygon-source",
        //     paint: { "fill-color": "#1d4ed8", "fill-opacity": 0.1 }
        //   });
        // }
        // if (!mapInstance.getLayer("ward-outline-layer")) {
        //   mapInstance.addLayer({
        //     id: "ward-outline-layer", type: "line", source: "ward-polygon-source",
        //     paint: { "line-color": "#1d4ed8", "line-width": 2 }
        //   });
        // }
      }
    } catch (e) { console.error("Ward Error:", e); }

    // 2. BUILDINGS
    try {
      const buildings = buildingDataRef.current;
      let bSource = mapInstance.getSource("buildings-source");

      if (buildings && buildings.features && buildings.features.length > 0) {
        if (!bSource) {
          mapInstance.addSource("buildings-source", { type: "geojson", data: buildings });

          mapInstance.addLayer({
            id: "buildings-fill",
            type: "fill",
            source: "buildings-source",
            paint: {
              "fill-color": [
                "match", ["get", "landuse"],
                "residential", "#22c55e",
                "urban", "#3b82f6",
                "industry", "#6b7280",
                "#fbbf24"
              ],
              "fill-opacity": 0.5,
              "fill-outline-color": "#ffffff"
            }
          });
        } else {
          bSource.setData(buildings);
        }
      }
    } catch (e) { console.error("Building Error:", e); }

    // 3. MANHOLES
    try {
      let manholeSource = mapInstance.getSource("manholes");
      if (manholeSource) {
        manholeSource.setData(manholeDataRef.current);
      } else {
        mapInstance.addSource("manholes", { type: "geojson", data: manholeDataRef.current, promoteId: "id" });
        mapInstance.addLayer({
          id: "manhole-dots", type: "circle", source: "manholes",
          paint: {
            "circle-radius": 5, "circle-stroke-width": 1.5, "circle-stroke-color": "#fff",
            "circle-color": [
              "case", ["boolean", ["feature-state", "selected"], false], "#3b82f6",
              ["match", ["get", "status"], "safe", "#22c55e", "warning", "#fbbf24", "danger", "#ef4444", "#ccc"],
            ],
          },
        });
      }
      // Apply filters
      if (mapInstance.getLayer("manhole-dots")) {
        const filterExpr = statusFilterRef.current === "all" ? null : ["==", ["get", "status"], statusFilterRef.current];
        try { mapInstance.setFilter("manhole-dots", filterExpr); } catch (e) { }
      }
      // Apply selection
      try { mapInstance.removeFeatureState({ source: 'manholes' }); } catch (e) { }
      if (selectedManholeIdRef.current !== null) {
        const features = mapInstance.querySourceFeatures('manholes', { filter: ['==', 'id', selectedManholeIdRef.current] });
        if (features.length > 0) {
          try { mapInstance.setFeatureState({ source: 'manholes', id: selectedManholeIdRef.current }, { selected: true }); } catch (e) { }
        }
      }
    } catch (e) { console.error("Manhole Error:", e); }

  }, [mapRef]);

  // --- MAP INITIALIZATION & EVENT LISTENERS ---
  useEffect(() => {
    if (mapRef.current) return;
    if (!styleUrl) return;

    // Create Map
    const mapInstance = new mapboxgl.Map({
      container: mapContainer.current,
      style: styleUrl,
      center: [78.4794, 17.3940],
      zoom: 9.40,
    });
    mapRef.current = mapInstance;
    mapInstance.addControl(new mapboxgl.NavigationControl(), "top-left");

    const handleStyleLoad = () => {
      drawLayers();
      if (centerToRestore?.current) {
        mapInstance?.jumpTo({ center: centerToRestore.current, zoom: zoomToRestore.current });
        centerToRestore.current = null;
      }
    };

    mapInstance.on("load", drawLayers);
    mapInstance.on("style.load", handleStyleLoad);

    // Helpers
    const resolveDate = (feature) => {
      const popupId = String(feature.properties.id);
      let resolvedDate = getManholeDateById(popupId);
      if (!resolvedDate) resolvedDate = feature.properties.date_for_status;
      return resolvedDate;
    };

    const createPopupHTML = (id, dateValue) => {
      let displayDate = dateValue ? formatExcelDate(dateValue) : "No Record";
      return `<div id="mhpop" style="font-size:12px;padding:4px;text-align:center;background:white;color:#333;"><strong>ID:</strong> ${id}<br/><strong>Last Cleaned:</strong> ${displayDate}</div>`;
    };

    // --- EVENT: CLICK MANHOLE ---
    mapInstance.on("click", "manhole-dots", (e) => {
      const feature = e.features[0];
      if (!feature || !onManholeClick) return;
      popup.current.remove();
      onManholeClick(feature);
      const popupId = String(feature.properties.id ?? 'N/A');
      popup.current.setLngLat(feature.geometry.coordinates).setHTML(createPopupHTML(popupId, resolveDate(feature))).addTo(mapInstance);
      isPopupPinned.current = true;
    });

    // --- EVENT: CLICK BUILDING ---
    // --- EVENT: CLICK BUILDING (Show Popup on Map) ---
    mapInstance.on("click", "buildings-fill", (e) => {

      // 1. Priority Check: Don't open if a manhole was clicked on top
      const manholeFeatures = mapInstance.queryRenderedFeatures(e.point, { layers: ['manhole-dots'] });
      if (manholeFeatures.length > 0) return;

      const feature = e.features[0];
      if (!feature) return;

      // 2. Prepare Data
      const p = feature.properties;

      // 3. Build Popup HTML
      const popupHtml = `
            <div style="font-family: sans-serif; min-width: 180px; padding: 2px;">
                <h3 style="margin: 0 0 8px 0; font-size: 13px; font-weight: bold; border-bottom: 1px solid #ccc; padding-bottom: 4px;">Building Information</h3>
                <div style="font-size: 12px; display: grid; grid-template-columns: 60px 1fr; gap: 4px;">
                    <span style="color: #666; font-weight: 600;">Use:</span>
                    <span style="text-transform: capitalize;">${p.landuse || 'N/A'}</span>
                    
                    <span style="color: #666; font-weight: 600;">Address:</span>
                    <span>${p.address || 'N/A'}</span>
                </div>
            </div>
        `;

      // 4. Show Popup at Click Location
      popup.current
        .setLngLat(e.lngLat)
        .setHTML(popupHtml)
        .addTo(mapInstance);

      // 5. Pin it so it doesn't disappear on mouseleave
      isPopupPinned.current = true;
    });

    // --- CURSOR POINTERS ---
    mapInstance.on("mouseenter", "buildings-fill", () => mapInstance.getCanvas().style.cursor = "pointer");
    mapInstance.on("mouseleave", "buildings-fill", () => mapInstance.getCanvas().style.cursor = "");

    mapInstance.on("mouseenter", "manhole-dots", (e) => {
      if (isPopupPinned.current) return;
      mapInstance.getCanvas().style.cursor = "pointer";
      const f = e.features[0];
      const pid = String(f.properties.id ?? 'N/A');
      popup.current.setLngLat(f.geometry.coordinates).setHTML(createPopupHTML(pid, resolveDate(f))).addTo(mapInstance);
    });

    mapInstance.on("mouseleave", "manhole-dots", () => {
      mapInstance.getCanvas().style.cursor = "";
      if (!isPopupPinned.current) popup.current.remove();
    });

    // --- EVENT: CLICK EMPTY SPACE ---
    mapInstance.on('click', (e) => {
      const features = mapInstance.queryRenderedFeatures(e.point, { layers: ['manhole-dots', 'buildings-fill'] });
      if (!features.length) {
        popup.current.remove();
        isPopupPinned.current = false;
        if (selectedManholeIdRef.current && onManholeDeselect) onManholeDeselect();
      }
    });

    return () => { if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; } };
  }, [styleUrl, mapRef, centerToRestore, zoomToRestore, onManholeClick, onManholeDeselect, onBuildingClick, formatExcelDate, drawLayers, getManholeDateById]);

  // --- UPDATES ---
  // Re-draw layers when data changes
  useEffect(() => { if (mapRef.current && mapRef.current.isStyleLoaded()) drawLayers(); }, [manholeGeoJSON, wardGeoJSON, buildingGeoJSON, mapRef, drawLayers]);

  // Style Update
  useEffect(() => { if (mapRef.current?.isStyleLoaded()) mapRef.current.setStyle(styleUrl); }, [styleUrl, mapRef]);

  // Filter Update
  useEffect(() => {
    if (!mapRef.current || !mapRef.current.isStyleLoaded() || !mapRef.current.getLayer("manhole-dots")) return;
    try {
      const filterExpr = statusFilter === "all" ? null : ["==", ["get", "status"], statusFilter];
      mapRef.current.setFilter("manhole-dots", filterExpr);
    } catch (e) { }
  }, [statusFilter, mapRef]);

  // Selection Update
  useEffect(() => {
    selectedManholeIdRef.current = selectedManholeId;
    if (mapRef.current && mapRef.current.isStyleLoaded()) drawLayers(); // Use drawLayers to update state
    if (selectedManholeId === null) {
      isPopupPinned.current = false;
      popup.current.remove();
    }
  }, [selectedManholeId, mapRef, drawLayers]);

  // FlyTo Update
  useEffect(() => {
    if (!mapRef.current || !flyToLocation) return;
    const mapInstance = mapRef.current; // Define local var
    try {
      if (flyToLocation.bounds) {
        isPopupPinned.current = false;
        popup.current.remove();
        mapInstance.fitBounds(flyToLocation.bounds, { padding: flyToLocation.padding || 40, duration: 1000 });
      } else if (flyToLocation.center) {
        const currentCenter = mapInstance.getCenter();
        const targetCenter = flyToLocation.center;
        const dist = Math.sqrt(Math.pow(currentCenter.lng - targetCenter[0], 2) + Math.pow(currentCenter.lat - targetCenter[1], 2));
        if (dist > 0.00001) mapInstance.flyTo({ center: targetCenter, zoom: flyToLocation.zoom || 18, duration: 1000 });
        else if (mapInstance.getZoom() !== (flyToLocation.zoom || 18)) mapInstance.zoomTo(flyToLocation.zoom || 18, { duration: 500 });
      }
    } catch (e) { }
  }, [flyToLocation, mapRef]);

  return <div ref={mapContainer} className="h-full w-full " />;
};

export default memo(MapboxCore);