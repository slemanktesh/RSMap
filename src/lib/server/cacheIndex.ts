import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

const INDEX_ENTRY_LENGTH = 6;
const SECTOR_SIZE = 520;
const MAP_INDEX_ID = 5;
const MASTER_INDEX_ID = 255;
const INVALID_CACHE_MESSAGE = 'Invalid cache path or unsupported cache format.';

interface IndexEntry {
  length: number;
  sector: number;
}

interface ParsedArchive {
  id: number;
  nameHash: number;
}

export interface CacheValidationResult {
  source: 'custom';
  valid: boolean;
  path: string;
  message: string;
  mapArchiveCount: number;
  indexCount: number;
  archiveStatus: Record<string, boolean>;
}

class BufferReader {
  private offset = 0;

  constructor(private readonly buffer: Buffer) {}

  readUnsignedByte(): number {
    return this.buffer[this.offset++];
  }

  readUnsignedShort(): number {
    const value = this.buffer.readUInt16BE(this.offset);
    this.offset += 2;
    return value;
  }

  readInt(): number {
    const value = this.buffer.readInt32BE(this.offset);
    this.offset += 4;
    return value;
  }

  readBigSmart(): number {
    return this.buffer.readInt8(this.offset) >= 0
      ? this.readUnsignedShort()
      : this.readInt() & 0x7fffffff;
  }
}

export function validateCachePath(cachePath: string, archiveNames: string[] = []): CacheValidationResult {
  let resolvedPath = cachePath;

  try {
    resolvedPath = normalizeCachePath(cachePath);
    assertLooksLikeCacheDirectory(resolvedPath);

    const indexCount = getIndexCount(resolvedPath);
    if (indexCount <= MAP_INDEX_ID) {
      throw new Error('Cache does not contain the map index.');
    }

    const mapArchives = loadIndexArchives(resolvedPath, MAP_INDEX_ID);
    const archiveStatus = getArchiveStatuses(mapArchives, archiveNames);
    const baselineStatus = getArchiveStatuses(mapArchives, ['m50_49', 'l50_49']);

    if (mapArchives.length === 0 || !baselineStatus.m50_49 || !baselineStatus.l50_49) {
      throw new Error('Map and landscape archives could not be queried.');
    }

    return {
      source: 'custom',
      valid: true,
      path: resolvedPath,
      message: `Loaded local cache with ${mapArchives.length} map index archives.`,
      mapArchiveCount: mapArchives.length,
      indexCount,
      archiveStatus,
    };
  } catch (error) {
    return {
      source: 'custom',
      valid: false,
      path: resolvedPath,
      message: INVALID_CACHE_MESSAGE,
      mapArchiveCount: 0,
      indexCount: 0,
      archiveStatus: {},
    };
  }
}

function normalizeCachePath(cachePath: string): string {
  const trimmed = cachePath.trim();

  if (!trimmed || trimmed.includes('\0')) {
    throw new Error('Invalid cache path.');
  }

  return path.resolve(trimmed);
}

function assertLooksLikeCacheDirectory(cachePath: string): void {
  const stat = fs.statSync(cachePath);

  if (!stat.isDirectory()) {
    throw new Error('Cache path is not a directory.');
  }

  const requiredFiles = ['main_file_cache.dat2', 'main_file_cache.idx255', `main_file_cache.idx${MAP_INDEX_ID}`];
  for (const fileName of requiredFiles) {
    const filePath = path.join(cachePath, fileName);
    const fileStat = fs.statSync(filePath);
    if (!fileStat.isFile() || fileStat.size <= 0) {
      throw new Error(`Missing or empty cache file: ${fileName}`);
    }
  }
}

function getIndexCount(cachePath: string): number {
  const index255Path = path.join(cachePath, 'main_file_cache.idx255');
  const stat = fs.statSync(index255Path);
  return Math.floor(stat.size / INDEX_ENTRY_LENGTH);
}

function loadIndexArchives(cachePath: string, indexId: number): ParsedArchive[] {
  const indexEntry = readIndexEntry(path.join(cachePath, 'main_file_cache.idx255'), indexId);
  if (!indexEntry) {
    throw new Error(`Index ${indexId} was not found.`);
  }

  const indexContainer = readDataFile(cachePath, MASTER_INDEX_ID, indexId, indexEntry);
  const indexData = decompressContainer(indexContainer);
  return parseIndexData(indexData);
}

function readIndexEntry(indexPath: string, id: number): IndexEntry | null {
  const indexBuffer = fs.readFileSync(indexPath);
  const offset = id * INDEX_ENTRY_LENGTH;

  if (offset + INDEX_ENTRY_LENGTH > indexBuffer.length) {
    return null;
  }

  const length = (indexBuffer[offset] << 16) | (indexBuffer[offset + 1] << 8) | indexBuffer[offset + 2];
  const sector = (indexBuffer[offset + 3] << 16) | (indexBuffer[offset + 4] << 8) | indexBuffer[offset + 5];

  return length > 0 && sector > 0 ? { length, sector } : null;
}

function readDataFile(cachePath: string, indexId: number, archiveId: number, entry: IndexEntry): Buffer {
  const dataPath = path.join(cachePath, 'main_file_cache.dat2');
  const fileHandle = fs.openSync(dataPath, 'r');
  const chunks: Buffer[] = [];
  let remaining = entry.length;
  let sector = entry.sector;
  let part = 0;

  try {
    while (remaining > 0) {
      const headerSize = archiveId > 0xffff ? 10 : 8;
      const header = Buffer.alloc(headerSize);
      fs.readSync(fileHandle, header, 0, headerSize, sector * SECTOR_SIZE);

      let currentArchive: number;
      let currentPart: number;
      let nextSector: number;
      let currentIndex: number;

      if (headerSize === 10) {
        currentArchive = header.readInt32BE(0);
        currentPart = header.readUInt16BE(4);
        nextSector = (header[6] << 16) | (header[7] << 8) | header[8];
        currentIndex = header[9];
      } else {
        currentArchive = header.readUInt16BE(0);
        currentPart = header.readUInt16BE(2);
        nextSector = (header[4] << 16) | (header[5] << 8) | header[6];
        currentIndex = header[7];
      }

      if (currentArchive !== archiveId || currentPart !== part || currentIndex !== indexId) {
        throw new Error('Cache data sector mismatch.');
      }

      const chunkLength = Math.min(remaining, SECTOR_SIZE - headerSize);
      const chunk = Buffer.alloc(chunkLength);
      fs.readSync(fileHandle, chunk, 0, chunkLength, sector * SECTOR_SIZE + headerSize);
      chunks.push(chunk);

      remaining -= chunkLength;
      sector = nextSector;
      part += 1;

      if (remaining > 0 && sector <= 0) {
        throw new Error('Unexpected end of cache data sectors.');
      }
    }
  } finally {
    fs.closeSync(fileHandle);
  }

  return Buffer.concat(chunks);
}

function decompressContainer(container: Buffer): Buffer {
  const compression = container[0];
  const compressedLength = container.readInt32BE(1);

  if (compressedLength < 0) {
    throw new Error('Invalid container length.');
  }

  if (compression === 0) {
    return container.subarray(5, 5 + compressedLength);
  }

  if (compression === 2) {
    return zlib.gunzipSync(container.subarray(9, 9 + compressedLength));
  }

  throw new Error(`Unsupported cache compression type: ${compression}`);
}

function parseIndexData(data: Buffer): ParsedArchive[] {
  const reader = new BufferReader(data);
  const protocol = reader.readUnsignedByte();

  if (protocol < 5 || protocol > 7) {
    throw new Error(`Unsupported index protocol: ${protocol}`);
  }

  if (protocol >= 6) {
    reader.readInt();
  }

  const flags = reader.readUnsignedByte();
  const named = (flags & 1) !== 0;
  const sized = (flags & 4) !== 0;

  if ((flags & ~5) !== 0) {
    throw new Error(`Unsupported index flags: ${flags}`);
  }

  const archiveCount = protocol >= 7 ? reader.readBigSmart() : reader.readUnsignedShort();
  const archives: ParsedArchive[] = [];
  let lastArchiveId = 0;

  for (let index = 0; index < archiveCount; index += 1) {
    lastArchiveId += protocol >= 7 ? reader.readBigSmart() : reader.readUnsignedShort();
    archives.push({ id: lastArchiveId, nameHash: 0 });
  }

  if (named) {
    for (const archive of archives) {
      archive.nameHash = reader.readInt();
    }
  }

  for (let index = 0; index < archiveCount; index += 1) {
    reader.readInt();
  }

  if (sized) {
    for (let index = 0; index < archiveCount; index += 1) {
      reader.readInt();
      reader.readInt();
    }
  }

  for (let index = 0; index < archiveCount; index += 1) {
    reader.readInt();
  }

  const fileCounts: number[] = [];
  for (let index = 0; index < archiveCount; index += 1) {
    fileCounts.push(protocol >= 7 ? reader.readBigSmart() : reader.readUnsignedShort());
  }

  for (const fileCount of fileCounts) {
    for (let fileIndex = 0; fileIndex < fileCount; fileIndex += 1) {
      protocol >= 7 ? reader.readBigSmart() : reader.readUnsignedShort();
    }
  }

  return archives;
}

function getArchiveStatuses(archives: ParsedArchive[], archiveNames: string[]): Record<string, boolean> {
  const archiveHashes = new Set(archives.map((archive) => archive.nameHash));
  const statuses: Record<string, boolean> = {};

  for (const archiveName of archiveNames) {
    statuses[archiveName] = archiveHashes.has(djb2Hash(archiveName));
  }

  return statuses;
}

function djb2Hash(value: string): number {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (value.charCodeAt(index) + ((hash << 5) - hash)) | 0;
  }

  return hash;
}
