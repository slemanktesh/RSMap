'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import IronRivetPanel from './IronRivetPanel';
import OSRSButton from './OSRSButton';
import { CACHE_STORAGE_KEYS, CacheSource, CUSTOM_CACHE_SOURCE_LABEL, DEFAULT_CACHE_SOURCE_LABEL, DEFAULT_CUSTOM_CACHE_PATH } from '@/lib/cacheConfig';
import { LeafletCoords, leafletToOsrsWorld } from '@/lib/coordinates';
import {
  RegionInfo,
  buildRegionInfoFromId,
  buildRegionInfoFromRegion,
  buildRegionInfoFromWorld,
  formatArchiveStatus,
  formatRegionInfoForCopy,
  parseRegionName,
  parseSmartSearch,
} from '@/lib/regionTools';

interface CacheRegionToolsPanelProps {
  currentPlane: number;
  clickedCoords: LeafletCoords | null;
  onClose: () => void;
  onJumpToWorld: (worldX: number, worldY: number, plane: number) => void;
}

interface CacheApiResponse {
  source: CacheSource;
  valid: boolean;
  path: string | null;
  message: string;
  mapArchiveCount: number | null;
  indexCount: number | null;
  archiveStatus: Record<string, boolean | null>;
}

const defaultCacheStatus: CacheApiResponse = {
  source: 'default',
  valid: true,
  path: null,
  message: 'Using the default RSMap static tile source. Select a custom local cache to query archive existence.',
  mapArchiveCount: null,
  indexCount: null,
  archiveStatus: {},
};

export default function CacheRegionToolsPanel({ currentPlane, clickedCoords, onClose, onJumpToWorld }: CacheRegionToolsPanelProps) {
  const [cacheSource, setCacheSource] = useState<CacheSource>('default');
  const [customPath, setCustomPath] = useState(DEFAULT_CUSTOM_CACHE_PATH);
  const [cacheStatus, setCacheStatus] = useState<CacheApiResponse>(defaultCacheStatus);
  const [archiveStatus, setArchiveStatus] = useState<Record<string, boolean | null>>({});
  const [cacheLoading, setCacheLoading] = useState(false);
  const [cacheError, setCacheError] = useState<string | null>(null);

  const [smartSearchInput, setSmartSearchInput] = useState('');
  const [smartSearchError, setSmartSearchError] = useState<string | null>(null);
  const [smartSearchInfo, setSmartSearchInfo] = useState<RegionInfo | null>(null);

  const [regionNameInput, setRegionNameInput] = useState('50_49');
  const [regionIdInput, setRegionIdInput] = useState('12849');
  const [worldCoordsInput, setWorldCoordsInput] = useState('3200,3150');
  const [copyMessage, setCopyMessage] = useState<string | null>(null);

  const requestCacheValidation = useCallback(async (
    sourceToUse: CacheSource,
    pathToUse: string,
    archives: string[] = [],
    showLoading = false,
    persist = false
  ) => {
    if (showLoading) {
      setCacheLoading(true);
    }
    setCacheError(null);

    try {
      const response = await fetch('/api/cache/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source: sourceToUse,
          path: pathToUse,
          archives,
        }),
      });

      const data = await response.json() as CacheApiResponse;
      setCacheStatus(data);
      setArchiveStatus((previous) => ({ ...previous, ...data.archiveStatus }));

      if (persist) {
        localStorage.setItem(CACHE_STORAGE_KEYS.source, sourceToUse);
        if (sourceToUse === 'custom') {
          localStorage.setItem(CACHE_STORAGE_KEYS.customPath, pathToUse);
        }
      }

      if (!response.ok || !data.valid) {
        setCacheError(data.message || 'Invalid cache path or unsupported cache format.');
      }
    } catch (error) {
      setCacheError('Could not validate cache source.');
      setCacheStatus({
        source: sourceToUse,
        valid: false,
        path: sourceToUse === 'custom' ? pathToUse : null,
        message: 'Could not validate cache source.',
        mapArchiveCount: 0,
        indexCount: 0,
        archiveStatus: {},
      });
    } finally {
      if (showLoading) {
        setCacheLoading(false);
      }
    }
  }, []);

  const validateCurrentCache = useCallback(async (archives: string[] = [], showLoading = false, persist = false) => {
    await requestCacheValidation(cacheSource, customPath, archives, showLoading, persist);
  }, [cacheSource, customPath, requestCacheValidation]);

  useEffect(() => {
    const storedSource = localStorage.getItem(CACHE_STORAGE_KEYS.source) as CacheSource | null;
    const storedPath = localStorage.getItem(CACHE_STORAGE_KEYS.customPath);
    const initialSource = storedSource === 'custom' ? 'custom' : 'default';
    const initialPath = storedPath || DEFAULT_CUSTOM_CACHE_PATH;

    setCacheSource(initialSource);
    setCustomPath(initialPath);
    void requestCacheValidation(initialSource, initialPath, [], true);
  }, [requestCacheValidation]);

  const clickedInfo = useMemo(() => {
    if (!clickedCoords) {
      return null;
    }

    const worldCoords = leafletToOsrsWorld(clickedCoords);
    return buildRegionInfoFromWorld(worldCoords.worldX, worldCoords.worldY, currentPlane, 'Map click', 'world-coordinates');
  }, [clickedCoords, currentPlane]);

  const regionNameInfo = useMemo(() => {
    const parsed = parseRegionName(regionNameInput);
    return parsed ? buildRegionInfoFromRegion(parsed.regionX, parsed.regionY, currentPlane, regionNameInput, 'region-name') : null;
  }, [regionNameInput, currentPlane]);

  const regionIdInfo = useMemo(() => {
    const trimmed = regionIdInput.trim();
    if (!/^\d+$/.test(trimmed)) {
      return null;
    }

    const regionId = Number(trimmed);
    if (regionId < 0 || regionId > 0xffff) {
      return null;
    }

    return buildRegionInfoFromId(regionId, currentPlane, trimmed);
  }, [regionIdInput, currentPlane]);

  const worldCoordsInfo = useMemo(() => {
    const result = parseSmartSearch(worldCoordsInput, currentPlane);
    return result?.kind === 'world-coordinates' ? result.info : null;
  }, [worldCoordsInput, currentPlane]);

  const displayedArchiveNames = useMemo(() => {
    const names = new Set<string>();
    for (const info of [clickedInfo, smartSearchInfo, regionNameInfo, regionIdInfo, worldCoordsInfo]) {
      if (info) {
        names.add(info.mapArchiveName);
        names.add(info.landscapeArchiveName);
      }
    }

    return Array.from(names);
  }, [clickedInfo, smartSearchInfo, regionNameInfo, regionIdInfo, worldCoordsInfo]);

  useEffect(() => {
    const missing = displayedArchiveNames.filter((archiveName) => !(archiveName in archiveStatus));
    if (missing.length > 0) {
      void validateCurrentCache(missing);
    }
  }, [archiveStatus, displayedArchiveNames, validateCurrentCache]);

  const handleBrowse = async () => {
    setCacheLoading(true);
    setCacheError(null);

    try {
      const response = await fetch('/api/cache/browse', { method: 'POST' });
      const data = await response.json() as { path: string | null; message: string };

      if (!response.ok || !data.path) {
        setCacheError(data.message || 'Could not open the folder picker. Enter the cache path manually.');
        return;
      }

      setCacheSource('custom');
      setCustomPath(data.path);
      setArchiveStatus({});
      await requestCacheValidation('custom', data.path, [], true, true);
    } catch (error) {
      setCacheError('Could not open the folder picker. Enter the cache path manually.');
    } finally {
      setCacheLoading(false);
    }
  };

  const handleReloadCache = async () => {
    setArchiveStatus({});
    await validateCurrentCache([], true, true);
  };

  const handleUseSuggestedPath = () => {
    setCacheSource('custom');
    setCustomPath(DEFAULT_CUSTOM_CACHE_PATH);
  };

  const handleSmartJump = () => {
    const result = parseSmartSearch(smartSearchInput, currentPlane);
    if (!result) {
      setSmartSearchError('Enter a region ID, region name, archive name, or world coordinates.');
      setSmartSearchInfo(null);
      return;
    }

    setSmartSearchError(null);
    setSmartSearchInfo(result.info);
    onJumpToWorld(result.jumpWorldX, result.jumpWorldY, result.plane);
  };

  const copyInfo = async (info: RegionInfo) => {
    try {
      await navigator.clipboard.writeText(formatRegionInfoForCopy(info, archiveStatus));
      setCopyMessage('Copied.');
      window.setTimeout(() => setCopyMessage(null), 1500);
    } catch (error) {
      setCopyMessage('Copy failed.');
      window.setTimeout(() => setCopyMessage(null), 1500);
    }
  };

  return (
    <div className="absolute left-3 top-3 z-[1200] w-[min(460px,calc(100vw-24px))] max-h-[calc(100vh-96px)] overflow-y-auto">
      <IronRivetPanel style={{ padding: '12px' }}>
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-white">Cache + Region Tools</h2>
            <div className="text-xs text-gray-300">Exact region math, cache archive checks, and smart jump.</div>
          </div>
          <OSRSButton onClick={onClose} className="!min-h-[26px] !px-2">Close</OSRSButton>
        </div>

        <section className="mb-4 rounded border border-gray-700 bg-black/30 p-3">
          <h3 className="mb-2 text-sm font-bold text-yellow-300">Cache Source</h3>
          <div className="mb-2 grid gap-2 text-xs text-white">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                checked={cacheSource === 'default'}
                onChange={() => setCacheSource('default')}
              />
              <span>{DEFAULT_CACHE_SOURCE_LABEL}</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                checked={cacheSource === 'custom'}
                onChange={() => setCacheSource('custom')}
              />
              <span>{CUSTOM_CACHE_SOURCE_LABEL}</span>
            </label>
          </div>

          <div className="mb-2 flex gap-2">
            <input
              type="text"
              value={customPath}
              onChange={(event) => setCustomPath(event.target.value)}
              className="min-w-0 flex-1 rounded border border-gray-600 bg-gray-900 px-2 py-1 text-xs text-white focus:border-yellow-500 focus:outline-none"
              placeholder={DEFAULT_CUSTOM_CACHE_PATH}
              disabled={cacheSource !== 'custom'}
            />
            <OSRSButton onClick={handleBrowse} disabled={cacheLoading} className="!min-h-[28px]">Browse</OSRSButton>
          </div>

          <div className="mb-2 flex flex-wrap gap-2">
            <OSRSButton onClick={handleUseSuggestedPath} className="!min-h-[28px]">Use Suggested</OSRSButton>
            <OSRSButton onClick={handleReloadCache} disabled={cacheLoading} className="!min-h-[28px]">
              {cacheLoading ? 'Loading...' : 'Reload Cache'}
            </OSRSButton>
          </div>

          <div className="rounded bg-gray-900/80 p-2 text-xs text-gray-200">
            <div><span className="text-gray-400">Active source:</span> {cacheStatus.source === 'custom' ? CUSTOM_CACHE_SOURCE_LABEL : DEFAULT_CACHE_SOURCE_LABEL}</div>
            <div><span className="text-gray-400">Active path:</span> {cacheStatus.path || 'Default static tile source'}</div>
            <div><span className="text-gray-400">Status:</span> <span className={cacheStatus.valid ? 'text-green-300' : 'text-red-300'}>{cacheStatus.message}</span></div>
            {cacheStatus.mapArchiveCount !== null && <div><span className="text-gray-400">Map archives:</span> {cacheStatus.mapArchiveCount}</div>}
          </div>

          {cacheError && <div className="mt-2 rounded border border-red-800 bg-red-950/70 p-2 text-xs text-red-200">{cacheError}</div>}
        </section>

        <section className="mb-4 rounded border border-gray-700 bg-black/30 p-3">
          <h3 className="mb-2 text-sm font-bold text-yellow-300">Smart Search / Jump</h3>
          <div className="mb-2 flex gap-2">
            <input
              type="text"
              value={smartSearchInput}
              onChange={(event) => setSmartSearchInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  handleSmartJump();
                }
              }}
              className="min-w-0 flex-1 rounded border border-gray-600 bg-gray-900 px-2 py-1 text-xs text-white focus:border-yellow-500 focus:outline-none"
              placeholder="12849, 50_49, m50_49, 3200,3150"
            />
            <OSRSButton onClick={handleSmartJump} className="!min-h-[28px]">Jump</OSRSButton>
          </div>
          <div className="text-[11px] text-gray-400">Accepted: region ID, region name, m/l archive, worldX,worldY, optional plane.</div>
          {smartSearchError && <div className="mt-2 text-xs text-red-300">{smartSearchError}</div>}
          {smartSearchInfo && <RegionInfoBlock title="Search Result" info={smartSearchInfo} archiveStatus={archiveStatus} onCopy={copyInfo} />}
        </section>

        <section className="mb-4 rounded border border-gray-700 bg-black/30 p-3">
          <h3 className="mb-2 text-sm font-bold text-yellow-300">Region Tools</h3>
          <ToolInput label="Region name to ID" value={regionNameInput} onChange={setRegionNameInput} placeholder="50_49" />
          {regionNameInfo ? (
            <RegionInfoBlock title={`${regionNameInfo.regionName} -> ${regionNameInfo.regionId}`} info={regionNameInfo} archiveStatus={archiveStatus} onCopy={copyInfo} compact />
          ) : (
            <div className="mb-3 text-xs text-red-300">Invalid region name.</div>
          )}

          <ToolInput label="Region ID to name" value={regionIdInput} onChange={setRegionIdInput} placeholder="12849" />
          {regionIdInfo ? (
            <RegionInfoBlock title={`${regionIdInput.trim()} -> ${regionIdInfo.regionName}`} info={regionIdInfo} archiveStatus={archiveStatus} onCopy={copyInfo} compact />
          ) : (
            <div className="mb-3 text-xs text-red-300">Invalid region ID.</div>
          )}

          <ToolInput label="World coordinates to region info" value={worldCoordsInput} onChange={setWorldCoordsInput} placeholder="3200,3150 or 2916,3315,0" />
          {worldCoordsInfo ? (
            <RegionInfoBlock title={`${worldCoordsInfo.worldX},${worldCoordsInfo.worldY} -> ${worldCoordsInfo.regionName}`} info={worldCoordsInfo} archiveStatus={archiveStatus} onCopy={copyInfo} />
          ) : (
            <div className="text-xs text-red-300">Invalid world coordinates.</div>
          )}
        </section>

        <section className="rounded border border-gray-700 bg-black/30 p-3">
          <h3 className="mb-2 text-sm font-bold text-yellow-300">Tile Click Info</h3>
          {clickedInfo ? (
            <RegionInfoBlock title="Clicked Tile" info={clickedInfo} archiveStatus={archiveStatus} onCopy={copyInfo} />
          ) : (
            <div className="text-xs text-gray-300">Click a map tile to inspect its world and region data.</div>
          )}
        </section>

        {copyMessage && <div className="mt-2 text-right text-xs text-green-300">{copyMessage}</div>}
      </IronRivetPanel>
    </div>
  );
}

function ToolInput({ label, value, onChange, placeholder }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <label className="mb-2 block">
      <span className="mb-1 block text-xs text-gray-300">{label}</span>
      <input
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded border border-gray-600 bg-gray-900 px-2 py-1 text-xs text-white focus:border-yellow-500 focus:outline-none"
        placeholder={placeholder}
      />
    </label>
  );
}

function RegionInfoBlock({ title, info, archiveStatus, onCopy, compact = false }: {
  title: string;
  info: RegionInfo;
  archiveStatus: Record<string, boolean | null>;
  onCopy: (info: RegionInfo) => void;
  compact?: boolean;
}) {
  const mapStatus = archiveStatus[info.mapArchiveName] ?? null;
  const landscapeStatus = archiveStatus[info.landscapeArchiveName] ?? null;
  const noArchiveData = mapStatus === false && landscapeStatus === false;

  return (
    <div className="mb-3 rounded border border-gray-700 bg-gray-950/80 p-2 text-xs text-gray-100 last:mb-0">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="font-bold text-white">{title}</div>
        <OSRSButton onClick={() => onCopy(info)} className="!min-h-[24px] !px-2">Copy Info</OSRSButton>
      </div>

      <div className={compact ? 'grid grid-cols-2 gap-x-3 gap-y-1' : 'grid grid-cols-2 gap-x-3 gap-y-1'}>
        <InfoRow label="World X/Y" value={`${info.worldX}, ${info.worldY}`} />
        <InfoRow label="Plane" value={String(info.plane)} />
        <InfoRow label="Region name" value={info.regionName} />
        <InfoRow label="Region ID" value={String(info.regionId)} />
        <InfoRow label="Region X/Y" value={`${info.regionX}, ${info.regionY}`} />
        <InfoRow label="Local X/Y" value={`${info.localX}, ${info.localY}`} />
        <InfoRow label="Chunk X/Y" value={`${info.chunkX}, ${info.chunkY}`} />
        <InfoRow label="Bounds" value={`X ${info.bounds.minX}-${info.bounds.maxX}, Y ${info.bounds.minY}-${info.bounds.maxY}`} />
        <InfoRow label="Map archive" value={`${info.mapArchiveName} (${formatArchiveStatus(mapStatus)})`} />
        <InfoRow label="Landscape" value={`${info.landscapeArchiveName} (${formatArchiveStatus(landscapeStatus)})`} />
      </div>

      {noArchiveData && (
        <div className="mt-2 rounded border border-yellow-800 bg-yellow-950/60 p-2 text-yellow-200">
          Region is valid, but no surface map/archive data was found in the selected cache.
        </div>
      )}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <span className="text-gray-400">{label}: </span>
      <span className="break-words text-gray-100">{value}</span>
    </div>
  );
}
