import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildManifest,
  OSM_ATTRIBUTION,
  type BuildManifestDeps,
  type Provenance,
} from "../src/index.ts";

// Fake, deterministic hasher injected via DI — no crypto in geo-model.
const calls: Uint8Array[] = [];
const fakeDeps: BuildManifestDeps = {
  hashBytes: (bytes) => {
    calls.push(bytes);
    return `fakehash:len${bytes.length}`;
  },
};

const osmProvenance: Provenance = {
  source: "osm",
  license: "ODbL-1.0",
  attribution: OSM_ATTRIBUTION,
  obligation: "derivative-database",
};

test("hash is injected and content hash comes from deps.hashBytes", () => {
  calls.length = 0;
  const bytes = new Uint8Array([1, 2, 3, 4, 5]);
  const manifest = buildManifest(fakeDeps, bytes, {
    artifactId: "shibuya/admin/high",
    layer: "admin",
    provenance: [osmProvenance],
  });
  assert.equal(manifest.contentHash, "fakehash:len5");
  assert.equal(calls.length, 1);
  assert.equal(calls[0], bytes); // exact bytes passed through to the hasher
  assert.equal(manifest.schema, "geo-area-pack/1");
  assert.equal(manifest.artifactId, "shibuya/admin/high");
  assert.equal(manifest.layer, "admin");
});

test("requiresShareAlike is TRUE when any source is a derivative-database (ODbL)", () => {
  const manifest = buildManifest(fakeDeps, new Uint8Array(), {
    artifactId: "a",
    layer: "admin",
    provenance: [osmProvenance],
  });
  assert.equal(manifest.requiresShareAlike, true);
});

test("requiresShareAlike is FALSE for produced-work-only provenance", () => {
  const manifest = buildManifest(fakeDeps, new Uint8Array(), {
    artifactId: "a",
    layer: "landuse",
    provenance: [
      {
        source: "copernicus",
        license: "Copernicus",
        attribution: "© European Union, Copernicus",
        obligation: "produced-work",
      },
    ],
  });
  assert.equal(manifest.requiresShareAlike, false);
});

test("OSM attribution line is always included when osm contributed", () => {
  const manifest = buildManifest(fakeDeps, new Uint8Array(), {
    artifactId: "a",
    layer: "admin",
    provenance: [osmProvenance],
  });
  assert.deepEqual(manifest.attributionLines, [OSM_ATTRIBUTION]);
});

test("attribution lines are deduplicated and order-preserving across sources", () => {
  const manifest = buildManifest(fakeDeps, new Uint8Array(), {
    artifactId: "mixed",
    layer: "admin",
    provenance: [
      osmProvenance, // © OpenStreetMap contributors
      {
        source: "gsi",
        license: "GSI-Terms",
        attribution: "出典: 国土地理院",
        obligation: "produced-work",
      },
      {
        // duplicate OSM attribution from a second osm entry — must not repeat.
        source: "osm",
        license: "ODbL-1.0",
        attribution: OSM_ATTRIBUTION,
        obligation: "derivative-database",
      },
    ],
  });
  assert.deepEqual(manifest.attributionLines, [
    OSM_ATTRIBUTION,
    "出典: 国土地理院",
  ]);
  // Mixed obligations → share-alike still required because OSM is ODbL.
  assert.equal(manifest.requiresShareAlike, true);
});

test("provenance array is carried through unchanged", () => {
  const provenance: Provenance[] = [osmProvenance];
  const manifest = buildManifest(fakeDeps, new Uint8Array(), {
    artifactId: "a",
    layer: "admin",
    provenance,
  });
  assert.deepEqual(manifest.provenance, provenance);
});
