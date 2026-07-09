import type { GeneralRequest } from './types';

/**
 * Generates a Google Maps navigation URL supporting single or multiple destinations.
 * Uses 'directions' mode if multiple stops are present.
 */
export function getNavigationUrl(req: GeneralRequest): string {
  const stops = req.destinations && req.destinations.length > 0
    ? req.destinations
    : [{ address: req.destination, latLng: req.destinationLatLng }];

  const validStops = stops.filter(s => s.address || s.latLng);
  if (validStops.length === 0) return '#';

  const lastStop = validStops[validStops.length - 1];
  const waypoints = validStops.slice(0, -1);

  const destQuery = lastStop.address 
    ? encodeURIComponent(lastStop.address) 
    : `${lastStop.latLng?.lat},${lastStop.latLng?.lng}`;

  let url = `https://www.google.com/maps/dir/?api=1&destination=${destQuery}`;

  if (waypoints.length > 0) {
    const waypointsQuery = waypoints
      .map(w => w.address ? encodeURIComponent(w.address) : `${w.latLng?.lat},${w.latLng?.lng}`)
      .join('|');
    url += `&waypoints=${waypointsQuery}`;
  }

  return url;
}
