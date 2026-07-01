'use client';

import { useEffect, useMemo, useState } from 'react';
import { Marker, Polyline, useMap } from 'react-leaflet';
import L, { LatLngExpression } from 'leaflet';
import { leafletToOsrsWorld, osrsWorldToLeaflet } from '@/lib/coordinates';
import { formatRegionName, regionIdFromXY } from '@/lib/regionTools';

export type RegionLabelFormat = 'name' | 'id' | 'name-id';

interface RegionOverlayProps {
  showGrid: boolean;
  showLabels: boolean;
  labelFormat: RegionLabelFormat;
}

interface VisibleRegionRange {
  minRegionX: number;
  maxRegionX: number;
  minRegionY: number;
  maxRegionY: number;
  zoom: number;
}

const MAX_RENDERED_REGIONS = 1800;

export default function RegionOverlay({ showGrid, showLabels, labelFormat }: RegionOverlayProps) {
  const map = useMap();
  const [range, setRange] = useState<VisibleRegionRange>(() => getVisibleRegionRange(map));

  useEffect(() => {
    const updateRange = () => setRange(getVisibleRegionRange(map));

    updateRange();
    map.on('moveend zoomend resize', updateRange);

    return () => {
      map.off('moveend zoomend resize', updateRange);
    };
  }, [map]);

  const regions = useMemo(() => {
    const items: Array<{ regionX: number; regionY: number }> = [];
    const count = (range.maxRegionX - range.minRegionX + 1) * (range.maxRegionY - range.minRegionY + 1);

    if (count > MAX_RENDERED_REGIONS) {
      return items;
    }

    for (let regionX = range.minRegionX; regionX <= range.maxRegionX; regionX += 1) {
      for (let regionY = range.minRegionY; regionY <= range.maxRegionY; regionY += 1) {
        items.push({ regionX, regionY });
      }
    }

    return items;
  }, [range]);

  if (!showGrid && !showLabels) {
    return null;
  }

  return (
    <>
      {showGrid && regions.map((region) => (
        <Polyline
          key={`grid-${region.regionX}-${region.regionY}`}
          positions={getRegionPolyline(region.regionX, region.regionY)}
          pathOptions={{
            color: '#f7d36b',
            weight: range.zoom >= 5 ? 1.3 : 0.9,
            opacity: 0.55,
            fill: false,
            interactive: false,
          }}
        />
      ))}

      {showLabels && regions.map((region) => (
        <Marker
          key={`label-${region.regionX}-${region.regionY}-${labelFormat}`}
          position={getRegionCenter(region.regionX, region.regionY)}
          icon={createRegionLabelIcon(region.regionX, region.regionY, labelFormat, range.zoom)}
          interactive={false}
        />
      ))}
    </>
  );
}

function getVisibleRegionRange(map: L.Map): VisibleRegionRange {
  const bounds = map.getBounds();
  const corners = [
    leafletToOsrsWorld({ lng: bounds.getWest(), lat: bounds.getSouth() }),
    leafletToOsrsWorld({ lng: bounds.getWest(), lat: bounds.getNorth() }),
    leafletToOsrsWorld({ lng: bounds.getEast(), lat: bounds.getSouth() }),
    leafletToOsrsWorld({ lng: bounds.getEast(), lat: bounds.getNorth() }),
  ];

  const worldXs = corners.map((corner) => corner.worldX);
  const worldYs = corners.map((corner) => corner.worldY);

  const minWorldX = Math.min(...worldXs);
  const maxWorldX = Math.max(...worldXs);
  const minWorldY = Math.min(...worldYs);
  const maxWorldY = Math.max(...worldYs);

  return {
    minRegionX: clampRegion((minWorldX >> 6) - 1),
    maxRegionX: clampRegion((maxWorldX >> 6) + 1),
    minRegionY: clampRegion((minWorldY >> 6) - 1),
    maxRegionY: clampRegion((maxWorldY >> 6) + 1),
    zoom: map.getZoom(),
  };
}

function getRegionPolyline(regionX: number, regionY: number): LatLngExpression[] {
  const minX = regionX << 6;
  const minY = regionY << 6;
  const maxX = (regionX + 1) << 6;
  const maxY = (regionY + 1) << 6;

  const southWest = osrsWorldToLeaflet(minX, minY);
  const northWest = osrsWorldToLeaflet(minX, maxY);
  const northEast = osrsWorldToLeaflet(maxX, maxY);
  const southEast = osrsWorldToLeaflet(maxX, minY);

  return [
    [southWest.lat, southWest.lng],
    [northWest.lat, northWest.lng],
    [northEast.lat, northEast.lng],
    [southEast.lat, southEast.lng],
    [southWest.lat, southWest.lng],
  ];
}

function getRegionCenter(regionX: number, regionY: number): LatLngExpression {
  const center = osrsWorldToLeaflet((regionX << 6) + 32, (regionY << 6) + 32);
  return [center.lat, center.lng];
}

function createRegionLabelIcon(regionX: number, regionY: number, labelFormat: RegionLabelFormat, zoom: number): L.DivIcon {
  const label = getRegionLabel(regionX, regionY, labelFormat);
  const fontSize = zoom >= 5 ? 13 : 11;
  const width = labelFormat === 'name-id' ? 72 : 56;
  const height = labelFormat === 'name-id' ? 32 : 20;

  return L.divIcon({
    className: 'region-grid-label',
    html: `<div style="
      min-width: ${width}px;
      padding: 2px 4px;
      border: 1px solid rgba(247, 211, 107, 0.75);
      border-radius: 3px;
      background: rgba(16, 10, 4, 0.68);
      color: #ffe6a0;
      font-family: 'RuneScape', sans-serif;
      font-size: ${fontSize}px;
      font-weight: bold;
      line-height: 1.05;
      text-align: center;
      text-shadow: 1px 1px 1px #000;
      pointer-events: none;
      user-select: none;
      white-space: pre-line;
    ">${label}</div>`,
    iconSize: [width, height],
    iconAnchor: [width / 2, height / 2],
  });
}

function getRegionLabel(regionX: number, regionY: number, labelFormat: RegionLabelFormat): string {
  const regionName = formatRegionName(regionX, regionY);
  const regionId = String(regionIdFromXY(regionX, regionY));

  if (labelFormat === 'id') {
    return regionId;
  }

  if (labelFormat === 'name-id') {
    return `${regionName}<br/>${regionId}`;
  }

  return regionName;
}

function clampRegion(value: number): number {
  return Math.max(0, Math.min(255, value));
}
