import { test } from "node:test";
import assert from "node:assert/strict";
import {
  packPaths,
  type AreaPackManifest,
  type DetailTier,
} from "../src/index.ts";

// A byte-for-byte copy of a real committed manifest:
//   geo-data/packs/minato/road/high.manifest.json
// Typed via `satisfies AreaPackManifest` so this test FAILS TO COMPILE if the
// shared wire type ever drifts from the real on-disk shape.
const REAL_HIGH_MANIFEST = {
  schema: "geo-area-pack/1",
  ward: "minato",
  layer: "road",
  detail: "high",
  source: {
    name: "OpenStreetMap",
    license: "ODbL-1.0",
    attribution: "© OpenStreetMap contributors",
    input_file: "kanto-latest.osm.pbf",
    input_provider: "Geofabrik (asia/japan/kanto)",
    input_date: "2026-06-12",
  },
  pipeline: {
    simplify: {
      method: "weighted Visvalingam (mapshaper default), keep-shapes, planar",
      percentage: "30%",
    },
    quantization: 1000000,
    format: "topojson",
    compression: {
      codec: "brotli",
      quality: 11,
    },
  },
  tools: {
    osmium: "1.16.0",
    mapshaper: "0.7.22",
    osmtogeojson: "3.0.0-beta.5",
    "@xmldom/xmldom": "0.9.10",
  },
  artifact: {
    file: "high.f7b40104be38.topo.json.br",
    file_raw: "high.topo.json",
    bytes_topojson: 2286511,
    bytes_brotli: 395562,
    hash_algo: "sha256:12",
    hash_topojson: "bc56d8e76464",
    hash_brotli: "f7b40104be38",
  },
  attribution_lines: ["© OpenStreetMap contributors"],
  requires_share_alike: false,
  generated_at: "2026-06-13T18:00:05.327Z",
} satisfies AreaPackManifest;

test("AreaPackManifest accepts a real committed on-disk manifest", () => {
  // Compile-time proof is the `satisfies` above; assign at runtime too and
  // read a few snake_case fields to lock the field names.
  const m: AreaPackManifest = REAL_HIGH_MANIFEST;
  assert.equal(m.schema, "geo-area-pack/1");
  assert.equal(m.ward, "minato");
  assert.equal(m.detail, "high");
  assert.equal(m.source.input_file, "kanto-latest.osm.pbf");
  assert.equal(m.artifact.hash_algo, "sha256:12");
  assert.equal(m.artifact.file_raw, "high.topo.json");
  assert.equal(m.requires_share_alike, false);
  assert.deepEqual(m.attribution_lines, ["© OpenStreetMap contributors"]);
  assert.equal(m.tools.mapshaper, "0.7.22");
});

test("packPaths derives the exact repo-relative layout (cross-checked vs geo-data)", () => {
  const p = packPaths("minato", "road", "high");
  assert.equal(p.dir, "packs/minato/road");
  assert.equal(p.manifest, "packs/minato/road/high.manifest.json");
  // The real committed artifact filename from minato/road/high.manifest.json.
  assert.equal(
    p.artifact("high.f7b40104be38.topo.json.br"),
    "packs/minato/road/high.f7b40104be38.topo.json.br",
  );
  // The raw alias under the same dir.
  assert.equal(p.artifact("high.topo.json"), "packs/minato/road/high.topo.json");
});

test("packPaths: manifest path matches the {detail}.manifest.json convention per tier", () => {
  const tiers: DetailTier[] = ["high", "med", "low"];
  for (const tier of tiers) {
    const p = packPaths("taito", "road", tier);
    assert.equal(p.dir, "packs/taito/road");
    assert.equal(p.manifest, `packs/taito/road/${tier}.manifest.json`);
  }
});

test("packPaths: no leading slash and no base URL is prepended", () => {
  const p = packPaths("shibuya", "admin", "med");
  assert.ok(!p.dir.startsWith("/"));
  assert.ok(!p.manifest.startsWith("/"));
  assert.ok(p.dir.startsWith("packs/"));
  // Composing after a base must reproduce geo-client's existing URL shape.
  const base = "https://cdn.example.com/geo";
  assert.equal(
    `${base}/${p.manifest}`,
    "https://cdn.example.com/geo/packs/shibuya/admin/med.manifest.json",
  );
});
