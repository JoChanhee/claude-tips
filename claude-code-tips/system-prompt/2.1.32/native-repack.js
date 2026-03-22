#!/usr/bin/env node
/**
 * Repack patched cli.js into Claude Code native binary
 * Supports ELF (Linux) and Mach-O (macOS) formats
 */

const LIEF = require("node-lief");
const fs = require("fs");
const { execSync } = require("child_process");

const BUN_TRAILER = Buffer.from("\n---- Bun! ----\n");
const SIZEOF_OFFSETS = 32;
const SIZEOF_STRING_POINTER = 8;
const SIZEOF_MODULE = 4 * SIZEOF_STRING_POINTER + 4;

function parseStringPointer(buffer, offset) {
  return { offset: buffer.readUInt32LE(offset), length: buffer.readUInt32LE(offset + 4) };
}

function parseOffsets(buffer) {
  let pos = 0;
  const byteCount = buffer.readBigUInt64LE(pos); pos += 8;
  const modulesPtr = parseStringPointer(buffer, pos); pos += 8;
  const entryPointId = buffer.readUInt32LE(pos); pos += 4;
  const compileExecArgvPtr = parseStringPointer(buffer, pos);
  return { byteCount, modulesPtr, entryPointId, compileExecArgvPtr };
}

function getStringPointerContent(buffer, sp) {
  return buffer.subarray(sp.offset, sp.offset + sp.length);
}

function parseModule(buffer, offset) {
  let pos = offset;
  return {
    name: parseStringPointer(buffer, pos), contents: parseStringPointer(buffer, pos + 8),
    sourcemap: parseStringPointer(buffer, pos + 16), bytecode: parseStringPointer(buffer, pos + 24),
    encoding: buffer.readUInt8(pos + 32), loader: buffer.readUInt8(pos + 33),
    moduleFormat: buffer.readUInt8(pos + 34), side: buffer.readUInt8(pos + 35)
  };
}

function isClaudeModule(name) {
  return name.endsWith("/claude") || name === "claude" ||
         name.endsWith("/claude.exe") || name === "claude.exe";
}

function extractBunDataFromSection(sectionData) {
  const bunDataSizeU64 = sectionData.length >= 8 ? Number(sectionData.readBigUInt64LE(0)) : 0;
  const bunDataSizeU32 = sectionData.readUInt32LE(0);
  let headerSize, bunDataSize;
  if (sectionData.length >= 8 && 8 + bunDataSizeU64 <= sectionData.length && 8 + bunDataSizeU64 >= sectionData.length - 4096) {
    headerSize = 8; bunDataSize = bunDataSizeU64;
  } else if (4 + bunDataSizeU32 <= sectionData.length && 4 + bunDataSizeU32 >= sectionData.length - 4096) {
    headerSize = 4; bunDataSize = bunDataSizeU32;
  } else {
    throw new Error("Cannot determine section header format");
  }
  const bunDataContent = sectionData.subarray(headerSize, headerSize + bunDataSize);
  const offsetsStart = bunDataContent.length - SIZEOF_OFFSETS - BUN_TRAILER.length;
  const offsetsBytes = bunDataContent.subarray(offsetsStart, offsetsStart + SIZEOF_OFFSETS);
  return { bunOffsets: parseOffsets(offsetsBytes), bunData: bunDataContent, sectionHeaderSize: headerSize };
}

function extractFromELF(binary) {
  if (!binary.hasOverlay) throw new Error("ELF binary has no overlay data");
  const overlay = binary.overlay;
  const offsetsStart = overlay.length - 8 - BUN_TRAILER.length - SIZEOF_OFFSETS;
  const offsetsBytes = overlay.subarray(offsetsStart, overlay.length - 8 - BUN_TRAILER.length);
  const bunOffsets = parseOffsets(offsetsBytes);
  const tailDataLen = 8 + BUN_TRAILER.length + SIZEOF_OFFSETS;
  const dataStart = overlay.length - tailDataLen - Number(bunOffsets.byteCount);
  const dataRegion = overlay.subarray(dataStart, overlay.length - tailDataLen);
  const trailerBytes = overlay.subarray(overlay.length - 8 - BUN_TRAILER.length, overlay.length - 8);
  return { bunOffsets, bunData: Buffer.concat([dataRegion, offsetsBytes, trailerBytes]) };
}

function extractFromMachO(binary) {
  const bunSegment = binary.getSegment("__BUN");
  if (!bunSegment) throw new Error("__BUN segment not found");
  const bunSection = bunSegment.getSection("__bun");
  if (!bunSection) throw new Error("__bun section not found");
  return extractBunDataFromSection(bunSection.content);
}

function rebuildBunData(bunData, bunOffsets, modifiedClaudeJs) {
  const stringsData = [], modulesMetadata = [];
  const modulesListBytes = getStringPointerContent(bunData, bunOffsets.modulesPtr);
  const modulesCount = Math.floor(modulesListBytes.length / SIZEOF_MODULE);

  for (let i = 0; i < modulesCount; i++) {
    const module = parseModule(modulesListBytes, i * SIZEOF_MODULE);
    const moduleName = getStringPointerContent(bunData, module.name).toString("utf-8");
    const nameBytes = getStringPointerContent(bunData, module.name);
    const contentsBytes = isClaudeModule(moduleName) ? modifiedClaudeJs : getStringPointerContent(bunData, module.contents);
    const sourcemapBytes = getStringPointerContent(bunData, module.sourcemap);
    const bytecodeBytes = getStringPointerContent(bunData, module.bytecode);
    modulesMetadata.push({ name: nameBytes, contents: contentsBytes, sourcemap: sourcemapBytes, bytecode: bytecodeBytes,
      encoding: module.encoding, loader: module.loader, moduleFormat: module.moduleFormat, side: module.side });
    stringsData.push(nameBytes, contentsBytes, sourcemapBytes, bytecodeBytes);
  }

  let currentOffset = 0;
  const stringOffsets = [];
  for (const s of stringsData) { stringOffsets.push({ offset: currentOffset, length: s.length }); currentOffset += s.length + 1; }
  const modulesListOffset = currentOffset;
  const modulesListSize = modulesMetadata.length * SIZEOF_MODULE;
  currentOffset += modulesListSize;
  const compileExecArgvBytes = getStringPointerContent(bunData, bunOffsets.compileExecArgvPtr);
  const compileExecArgvOffset = currentOffset;
  currentOffset += compileExecArgvBytes.length + 1;
  const offsetsOffset = currentOffset;
  currentOffset += SIZEOF_OFFSETS;
  currentOffset += BUN_TRAILER.length;

  const newBuffer = Buffer.allocUnsafe(currentOffset);
  newBuffer.fill(0);

  let stringIdx = 0;
  for (const { offset, length } of stringOffsets) {
    if (length > 0) stringsData[stringIdx].copy(newBuffer, offset, 0, length);
    newBuffer[offset + length] = 0;
    stringIdx++;
  }
  if (compileExecArgvBytes.length > 0) {
    compileExecArgvBytes.copy(newBuffer, compileExecArgvOffset, 0, compileExecArgvBytes.length);
    newBuffer[compileExecArgvOffset + compileExecArgvBytes.length] = 0;
  }

  for (let i = 0; i < modulesMetadata.length; i++) {
    const baseIdx = i * 4;
    const moduleOffset = modulesListOffset + i * SIZEOF_MODULE;
    let pos = moduleOffset;
    for (let j = 0; j < 4; j++) {
      newBuffer.writeUInt32LE(stringOffsets[baseIdx + j].offset, pos); pos += 4;
      newBuffer.writeUInt32LE(stringOffsets[baseIdx + j].length, pos); pos += 4;
    }
    newBuffer.writeUInt8(modulesMetadata[i].encoding, pos++);
    newBuffer.writeUInt8(modulesMetadata[i].loader, pos++);
    newBuffer.writeUInt8(modulesMetadata[i].moduleFormat, pos++);
    newBuffer.writeUInt8(modulesMetadata[i].side, pos);
  }

  newBuffer.writeBigUInt64LE(BigInt(offsetsOffset), offsetsOffset);
  newBuffer.writeUInt32LE(modulesListOffset, offsetsOffset + 8);
  newBuffer.writeUInt32LE(modulesListSize, offsetsOffset + 12);
  newBuffer.writeUInt32LE(bunOffsets.entryPointId, offsetsOffset + 16);
  newBuffer.writeUInt32LE(compileExecArgvOffset, offsetsOffset + 20);
  newBuffer.writeUInt32LE(compileExecArgvBytes.length, offsetsOffset + 24);
  BUN_TRAILER.copy(newBuffer, offsetsOffset + SIZEOF_OFFSETS);

  return newBuffer;
}

function buildSectionData(bunBuffer, headerSize = 8) {
  const sectionData = Buffer.allocUnsafe(headerSize + bunBuffer.length);
  if (headerSize === 8) sectionData.writeBigUInt64LE(BigInt(bunBuffer.length), 0);
  else sectionData.writeUInt32LE(bunBuffer.length, 0);
  bunBuffer.copy(sectionData, headerSize);
  return sectionData;
}

function repackMachO(binary, binPath, newBunBuffer, outputPath, sectionHeaderSize) {
  if (binary.hasCodeSignature) binary.removeSignature();

  const bunSegment = binary.getSegment("__BUN");
  const bunSection = bunSegment.getSection("__bun");
  const newSectionData = buildSectionData(newBunBuffer, sectionHeaderSize);

  const sizeDiff = newSectionData.length - Number(bunSection.size);
  if (sizeDiff > 0) {
    const isARM64 = binary.header.cpuType === LIEF.MachO.Header.CPU_TYPE.ARM64;
    const PAGE_SIZE = isARM64 ? 16384 : 4096;
    const alignedSizeDiff = Math.ceil(sizeDiff / PAGE_SIZE) * PAGE_SIZE;
    binary.extendSegment(bunSegment, alignedSizeDiff);
  }

  bunSection.content = newSectionData;
  bunSection.size = BigInt(newSectionData.length);

  const tempPath = outputPath + ".tmp";
  binary.write(tempPath);
  const origStat = fs.statSync(binPath);
  fs.chmodSync(tempPath, origStat.mode);
  fs.renameSync(tempPath, outputPath);

  // Re-sign on macOS
  try {
    execSync(`codesign -s - -f "${outputPath}"`, { stdio: "ignore" });
    console.log("Code signed successfully");
  } catch (e) {
    console.warn("Warning: codesign failed, binary may not run");
  }
}

function repackELF(binary, binPath, newBunBuffer, outputPath) {
  const newOverlay = Buffer.allocUnsafe(newBunBuffer.length + 8);
  newBunBuffer.copy(newOverlay, 0);
  newOverlay.writeBigUInt64LE(BigInt(newBunBuffer.length), newBunBuffer.length);
  binary.overlay = newOverlay;

  const tempPath = outputPath + ".tmp";
  binary.write(tempPath);
  const origStat = fs.statSync(binPath);
  fs.chmodSync(tempPath, origStat.mode);
  fs.renameSync(tempPath, outputPath);
}

// Main
const binaryPath = process.argv[2];
const patchedCliPath = process.argv[3];
const outputPath = process.argv[4];

if (!binaryPath || !patchedCliPath || !outputPath) {
  console.log("Usage: node native-repack.js <binary> <patched-cli.js> <output>");
  process.exit(1);
}

LIEF.logging.disable();
const binary = LIEF.parse(binaryPath);
const patchedCli = fs.readFileSync(patchedCliPath);

let bunData, bunOffsets, sectionHeaderSize;
if (binary.format === "ELF") {
  ({ bunData, bunOffsets } = extractFromELF(binary));
} else if (binary.format === "MachO") {
  ({ bunData, bunOffsets, sectionHeaderSize } = extractFromMachO(binary));
} else {
  console.error(`Unsupported format: ${binary.format}`);
  process.exit(1);
}

console.log(`Binary format: ${binary.format}`);
console.log(`Patched cli.js: ${patchedCli.length} bytes`);

const newBunBuffer = rebuildBunData(bunData, bunOffsets, patchedCli);
console.log(`New bun data: ${newBunBuffer.length} bytes`);

if (binary.format === "MachO") {
  repackMachO(binary, binaryPath, newBunBuffer, outputPath, sectionHeaderSize);
} else {
  repackELF(binary, binaryPath, newBunBuffer, outputPath);
}

console.log(`Written to: ${outputPath}`);
