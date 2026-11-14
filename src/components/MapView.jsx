import { useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, Circle, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { DEFAULT_CENTER } from '../lib/geo';

const pin = (label, bg) =>
  L.divIcon({
    className: '',
    html: `<div class="map-pin" style="--c:${bg}"><span>${label}</span></div>`,
    iconSize: [34, 42],
    iconAnchor: [17, 40],
  });

const PICKUP = pin('A', '#2563eb');
const DROPOFF = pin('B', '#16a34a');
const PERSON = L.divIcon({ className: '', html: '<div class="map-person">🙋</div>', iconSize: [36, 36], iconAnchor: [18, 18] });
const ME = L.divIcon({ className: '', html: '<div class="map-me"></div>', iconSize: [18, 18], iconAnchor: [9, 9] });

const driverIcon = (heading = 0) =>
  L.divIcon({
    className: 'drv',
    html: `<div class="map-driver"><div class="map-driver-arrow" style="transform:rotate(${heading}deg)"></div><span>🛵</span></div>`,
    iconSize: [44, 44],
    iconAnchor: [22, 22],
  });

function FitBounds({ points, follow }) {
  const map = useMap();
  const key = points.map((p) => p && `${p.lat.toFixed(4)},${p.lng.toFixed(4)}`).join('|');
  useEffect(() => {
    const valid = points.filter(Boolean);
    if (!valid.length) return;
    if (follow) {
      map.panTo([follow.lat, follow.lng], { animate: true });
      return;
    }
    if (valid.length === 1) map.setView([valid[0].lat, valid[0].lng], 15);
    else map.fitBounds(L.latLngBounds(valid.map((p) => [p.lat, p.lng])), { padding: [40, 40], maxZoom: 16 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, follow?.lat, follow?.lng]);
  return null;
}

function ClickHandler({ onClick }) {
  useMapEvents({ click: (e) => onClick?.({ lat: e.latlng.lat, lng: e.latlng.lng }) });
  return null;
}

function InvalidateOnResize() {
  const map = useMap();
  useEffect(() => {
    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(map.getContainer());
    return () => ro.disconnect();
  }, [map]);
  return null;
}

export default function MapView({ pickup, dropoff, driver, drivers, person, me, route, track, onClick, follow, radius, height = 320, center }) {
  const fitPoints = useMemo(() => [pickup, dropoff, driver, me, person, ...(drivers || [])].filter(Boolean), [pickup, dropoff, driver, me, person, drivers]);
  const start = center || fitPoints[0] || DEFAULT_CENTER;
  return (
    <div className="map-wrap" style={{ height }}>
      <MapContainer center={[start.lat, start.lng]} zoom={14} style={{ height: '100%', width: '100%' }} zoomControl={false}>
        <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <InvalidateOnResize />
        <FitBounds points={fitPoints} follow={follow && driver ? driver : null} />
        {onClick && <ClickHandler onClick={onClick} />}
        {track?.length > 1 && <Polyline positions={track} pathOptions={{ color: '#94a3b8', weight: 4, dashArray: '4 8' }} />}
        {route?.coords?.length > 1 && (
          <>
            <Polyline positions={route.coords} pathOptions={{ color: '#ffffff', weight: 9, opacity: 0.9 }} />
            <Polyline positions={route.coords} pathOptions={{ color: '#0f766e', weight: 5, dashArray: route.approx ? '8 8' : null }} />
          </>
        )}
        {dropoff && radius && <Circle center={[dropoff.lat, dropoff.lng]} radius={radius} pathOptions={{ color: '#16a34a', weight: 1, fillOpacity: 0.08 }} />}
        {pickup && <Marker position={[pickup.lat, pickup.lng]} icon={PICKUP} />}
        {dropoff && <Marker position={[dropoff.lat, dropoff.lng]} icon={DROPOFF} />}
        {person && <Marker position={[person.lat, person.lng]} icon={PERSON} />}
        {me && <Marker position={[me.lat, me.lng]} icon={ME} />}
        {drivers?.map((d, i) => d && <Marker key={i} position={[d.lat, d.lng]} icon={driverIcon(d.heading)} />)}
        {driver && <Marker position={[driver.lat, driver.lng]} icon={driverIcon(driver.heading)} zIndexOffset={1000} />}
      </MapContainer>
    </div>
  );
}
