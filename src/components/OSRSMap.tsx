'use client';

import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, useMapEvents } from 'react-leaflet';
import { LatLngBounds, CRS } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { LeafletCoords, leafletToOsrsWorld } from '@/lib/coordinates';
import { MapIcon } from '@/types/mapIcon';
import CanvasIconLayer from './CanvasIconLayer';
import WorldMapLabels from './WorldMapLabels';
import RegionOverlay, { RegionLabelFormat } from './RegionOverlay';

// Back to simple CRS
const OSRSCRS = CRS.Simple;

export type PlaneDisplayMode = 'stacked' | 'single';

export interface MapHoverInfo {
  coords: LeafletCoords;
  worldX: number;
  worldY: number;
  plane: number;
}

interface OSRSMapProps {
  onCoordinateClick?: (coords: LeafletCoords) => void;
  onMouseCoordinateChange?: (info: MapHoverInfo | null) => void;
  plane?: number;
  onPlaneChange?: (plane: number) => void;
  onMapReady?: (map: any) => void;
  icons?: MapIcon[];
  onIconDelete?: (id: string) => void;
  onIconCopy?: (icon: MapIcon) => void;
  onIconMove?: (icon: MapIcon) => void;
  onIconEdit?: (icon: MapIcon) => void;
  onIconClick?: (icon: MapIcon) => void;
  addIconMode?: boolean;
  showWorldMapLabels?: boolean;
  showRegionGrid?: boolean;
  showRegionLabels?: boolean;
  regionLabelFormat?: RegionLabelFormat;
  planeDisplayMode?: PlaneDisplayMode;
}

function MapInteractionHandler({
  plane,
  onCoordinateClick,
  onMouseCoordinateChange,
}: {
  plane: number;
  onCoordinateClick?: (coords: LeafletCoords) => void;
  onMouseCoordinateChange?: (info: MapHoverInfo | null) => void;
}) {
  useMapEvents({
    mousemove: (e) => {
      if (!onMouseCoordinateChange) {
        return;
      }

      const coords = { lng: e.latlng.lng, lat: e.latlng.lat };
      const worldCoords = leafletToOsrsWorld(coords);

      onMouseCoordinateChange({
        coords,
        worldX: worldCoords.worldX,
        worldY: worldCoords.worldY,
        plane,
      });
    },
    mouseout: () => {
      onMouseCoordinateChange?.(null);
    },
    click: (e) => {
      const coords = { lng: e.latlng.lng, lat: e.latlng.lat };
      
      // Always log click coordinates for debugging
      console.log('📍 Map clicked at:', {
        leafletCoords: { lng: coords.lng.toFixed(2), lat: coords.lat.toFixed(2) },
        rawCoords: coords
      });
      
      if (onCoordinateClick) {
        onCoordinateClick(coords);
      }
      
      // Calculate what tile should be requested with direct mapping
      // Tile coordinates for debugging if needed
      // const tileX = Math.floor(coords.lng);
      // const tileY = Math.floor(coords.lat);
    },
  });
  
  return null;
}

export default function OSRSMap({ 
  onCoordinateClick, 
  onMouseCoordinateChange,
  plane = 0,
  onPlaneChange,
  onMapReady,
  icons = [],
  onIconDelete,
  onIconCopy,
  onIconMove,
  onIconEdit,
  onIconClick,
  addIconMode = false,
  showWorldMapLabels = true,
  showRegionGrid = false,
  showRegionLabels = false,
  regionLabelFormat = 'name-id',
  planeDisplayMode = 'stacked'
}: OSRSMapProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="w-full h-full bg-gray-200 flex items-center justify-center">
        <div className="text-gray-600">Loading map...</div>
      </div>
    );
  }

  // Map bounds and center - centered on Lumbridge
  const bounds = new LatLngBounds([0,0], [-1428, 405]);
  const center: [number, number] = [-1173, 273]; // Lumbridge coordinates (lat, lng)
  const renderedPlanes = planeDisplayMode === 'single'
    ? [plane]
    : [0, 1, 2, 3].filter((p) => p <= plane);

  return (
    <div className="w-full h-full relative">
      <MapContainer
        center={center}
        zoom={4}
        minZoom={1}
        maxZoom={6}
        maxBounds={bounds}
        maxBoundsViscosity={1.0}
        crs={OSRSCRS}
        className="w-full h-full"
        zoomControl={false}
        attributionControl={false}
        ref={(mapInstance: any) => {
          if (mapInstance && onMapReady) {
            onMapReady(mapInstance);
          }
        }}
      >
        {/* OSRS tile layers - serve directly from static files */}
        <>
          {renderedPlanes.map((p) => (
            <TileLayer
              key={`plane-${planeDisplayMode}-${p}`}
              url={`https://joegandy.github.io/RSMap/tiles/${p}/{z}/{x}/{y}.png`}
              tileSize={256}
              noWrap={true}
              opacity={1}
              attribution="OSRS Map Data"
            />
          ))}
        </>
        
        <MapInteractionHandler
          plane={plane}
          onCoordinateClick={onCoordinateClick}
          onMouseCoordinateChange={onMouseCoordinateChange}
        />
        
        {/* World map labels from OSRS cache */}
        {showWorldMapLabels && <WorldMapLabels />}

        {/* Optional exact OSRS 64x64 region overlay */}
        <RegionOverlay
          showGrid={showRegionGrid}
          showLabels={showRegionLabels}
          labelFormat={regionLabelFormat}
        />
        
        {/* Canvas-based icon rendering for performance */}
        <CanvasIconLayer
          icons={icons}
          plane={plane}
          onIconClick={onIconClick}
          onIconEdit={onIconEdit}
          onIconDelete={onIconDelete}
          onIconCopy={onIconCopy}
          onIconMove={onIconMove}
        />
      </MapContainer>
    </div>
  );
}
