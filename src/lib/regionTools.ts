export interface RegionBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export interface RegionInfo {
  worldX: number;
  worldY: number;
  plane: number;
  regionX: number;
  regionY: number;
  regionId: number;
  regionName: string;
  localX: number;
  localY: number;
  chunkX: number;
  chunkY: number;
  bounds: RegionBounds;
  mapArchiveName: string;
  landscapeArchiveName: string;
  sourceInput?: string;
  sourceType?: SmartSearchKind;
}

export type SmartSearchKind =
  | 'region-id'
  | 'region-name'
  | 'map-archive'
  | 'landscape-archive'
  | 'world-coordinates';

export interface SmartSearchResult {
  kind: SmartSearchKind;
  info: RegionInfo;
  jumpWorldX: number;
  jumpWorldY: number;
  plane: number;
}

export function regionIdFromXY(regionX: number, regionY: number): number {
  return (regionX << 8) | regionY;
}

export function regionXYFromId(regionId: number): { regionX: number; regionY: number } {
  return {
    regionX: regionId >> 8,
    regionY: regionId & 0xff,
  };
}

export function formatRegionName(regionX: number, regionY: number): string {
  return `${regionX}_${regionY}`;
}

export function parseRegionName(input: string): { regionX: number; regionY: number } | null {
  const match = input.trim().match(/^(\d{1,3})_(\d{1,3})$/);
  if (!match) {
    return null;
  }

  const regionX = Number(match[1]);
  const regionY = Number(match[2]);
  return isValidRegionXY(regionX, regionY) ? { regionX, regionY } : null;
}

export function isValidRegionXY(regionX: number, regionY: number): boolean {
  return Number.isInteger(regionX) && Number.isInteger(regionY) && regionX >= 0 && regionX <= 255 && regionY >= 0 && regionY <= 255;
}

export function isValidRegionId(regionId: number): boolean {
  return Number.isInteger(regionId) && regionId >= 0 && regionId <= 0xffff;
}

export function isValidPlane(plane: number): boolean {
  return Number.isInteger(plane) && plane >= 0 && plane <= 3;
}

export function buildRegionInfoFromWorld(worldX: number, worldY: number, plane = 0, sourceInput?: string, sourceType?: SmartSearchKind): RegionInfo {
  const regionX = worldX >> 6;
  const regionY = worldY >> 6;
  const localX = worldX & 63;
  const localY = worldY & 63;

  return buildRegionInfo(regionX, regionY, plane, worldX, worldY, localX, localY, sourceInput, sourceType);
}

export function buildRegionInfoFromRegion(regionX: number, regionY: number, plane = 0, sourceInput?: string, sourceType?: SmartSearchKind): RegionInfo {
  const worldX = (regionX << 6) + 32;
  const worldY = (regionY << 6) + 32;

  return buildRegionInfo(regionX, regionY, plane, worldX, worldY, worldX & 63, worldY & 63, sourceInput, sourceType);
}

export function buildRegionInfoFromId(regionId: number, plane = 0, sourceInput?: string): RegionInfo {
  const { regionX, regionY } = regionXYFromId(regionId);
  return buildRegionInfoFromRegion(regionX, regionY, plane, sourceInput, 'region-id');
}

function buildRegionInfo(
  regionX: number,
  regionY: number,
  plane: number,
  worldX: number,
  worldY: number,
  localX: number,
  localY: number,
  sourceInput?: string,
  sourceType?: SmartSearchKind
): RegionInfo {
  const bounds = {
    minX: regionX << 6,
    maxX: (regionX << 6) + 63,
    minY: regionY << 6,
    maxY: (regionY << 6) + 63,
  };

  return {
    worldX,
    worldY,
    plane,
    regionX,
    regionY,
    regionId: regionIdFromXY(regionX, regionY),
    regionName: formatRegionName(regionX, regionY),
    localX,
    localY,
    chunkX: worldX >> 3,
    chunkY: worldY >> 3,
    bounds,
    mapArchiveName: `m${regionX}_${regionY}`,
    landscapeArchiveName: `l${regionX}_${regionY}`,
    sourceInput,
    sourceType,
  };
}

export function parseSmartSearch(input: string, fallbackPlane = 0): SmartSearchResult | null {
  const original = input.trim();
  const normalized = original.toLowerCase();

  if (!normalized) {
    return null;
  }

  const archiveMatch = normalized.match(/^([ml])(\d{1,3})_(\d{1,3})$/);
  if (archiveMatch) {
    const regionX = Number(archiveMatch[2]);
    const regionY = Number(archiveMatch[3]);
    if (!isValidRegionXY(regionX, regionY)) {
      return null;
    }

    const kind: SmartSearchKind = archiveMatch[1] === 'm' ? 'map-archive' : 'landscape-archive';
    const info = buildRegionInfoFromRegion(regionX, regionY, fallbackPlane, original, kind);
    return {
      kind,
      info,
      jumpWorldX: info.worldX,
      jumpWorldY: info.worldY,
      plane: fallbackPlane,
    };
  }

  const regionName = parseRegionName(normalized);
  if (regionName) {
    const info = buildRegionInfoFromRegion(regionName.regionX, regionName.regionY, fallbackPlane, original, 'region-name');
    return {
      kind: 'region-name',
      info,
      jumpWorldX: info.worldX,
      jumpWorldY: info.worldY,
      plane: fallbackPlane,
    };
  }

  const worldMatch = normalized.match(/^(\d+)\s*,\s*(\d+)(?:\s*,\s*(\d+))?$/);
  if (worldMatch) {
    const worldX = Number(worldMatch[1]);
    const worldY = Number(worldMatch[2]);
    const plane = worldMatch[3] === undefined ? fallbackPlane : Number(worldMatch[3]);
    if (!Number.isInteger(worldX) || !Number.isInteger(worldY) || !isValidPlane(plane)) {
      return null;
    }

    const info = buildRegionInfoFromWorld(worldX, worldY, plane, original, 'world-coordinates');
    if (!isValidRegionXY(info.regionX, info.regionY)) {
      return null;
    }

    return {
      kind: 'world-coordinates',
      info,
      jumpWorldX: worldX,
      jumpWorldY: worldY,
      plane,
    };
  }

  const numericMatch = normalized.match(/^\d+$/);
  if (numericMatch) {
    const regionId = Number(normalized);
    if (!isValidRegionId(regionId)) {
      return null;
    }

    const info = buildRegionInfoFromId(regionId, fallbackPlane, original);
    return {
      kind: 'region-id',
      info,
      jumpWorldX: info.worldX,
      jumpWorldY: info.worldY,
      plane: fallbackPlane,
    };
  }

  return null;
}

export function formatRegionInfoForCopy(info: RegionInfo, archiveStatus?: Record<string, boolean | null>): string {
  const mapExists = formatArchiveStatus(archiveStatus?.[info.mapArchiveName]);
  const landscapeExists = formatArchiveStatus(archiveStatus?.[info.landscapeArchiveName]);

  return [
    `World X/Y: ${info.worldX}, ${info.worldY}`,
    `Plane: ${info.plane}`,
    `Region name: ${info.regionName}`,
    `Region ID: ${info.regionId}`,
    `Region X/Y: ${info.regionX}, ${info.regionY}`,
    `Local X/Y: ${info.localX}, ${info.localY}`,
    `Chunk X/Y: ${info.chunkX}, ${info.chunkY}`,
    `World bounds: X ${info.bounds.minX}-${info.bounds.maxX}, Y ${info.bounds.minY}-${info.bounds.maxY}`,
    `Map archive: ${info.mapArchiveName} (${mapExists})`,
    `Landscape archive: ${info.landscapeArchiveName} (${landscapeExists})`,
  ].join('\n');
}

export function formatArchiveStatus(status: boolean | null | undefined): string {
  if (status === true) {
    return 'exists';
  }

  if (status === false) {
    return 'missing';
  }

  return 'unknown';
}
