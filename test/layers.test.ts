import { test } from "node:test";
import assert from "node:assert/strict";
import {
  classifyOsmFeature,
  canonicalOsmLayerMapping,
  type Layer,
  type OsmLayerMapping,
} from "../src/index.ts";

test("admin: boundary=administrative folds admin_level into subclass", () => {
  const layer = classifyOsmFeature({
    boundary: "administrative",
    admin_level: "7",
    name: "渋谷区",
  });
  assert.deepEqual(layer, { kind: "admin", subclass: "7", zOrder: 70 } satisfies Layer);
});

test("water: natural=water", () => {
  const layer = classifyOsmFeature({ natural: "water" });
  assert.equal(layer?.kind, "water");
});

test("water: waterway=riverbank is areal water", () => {
  const layer = classifyOsmFeature({ waterway: "riverbank" });
  assert.equal(layer?.kind, "water");
  assert.equal(layer?.subclass, "riverbank");
});

test("water: linear waterway (canal)", () => {
  const layer = classifyOsmFeature({ waterway: "canal" });
  assert.equal(layer?.kind, "water");
  assert.equal(layer?.subclass, "canal");
});

test("coastline: natural=coastline", () => {
  const layer = classifyOsmFeature({ natural: "coastline" });
  assert.equal(layer?.kind, "coastline");
});

test("road: highway=primary classifies as road with subclass", () => {
  const layer = classifyOsmFeature({ highway: "primary" });
  assert.deepEqual(layer, { kind: "road", subclass: "primary", zOrder: 50 } satisfies Layer);
});

test("road: highway=platform is EXCLUDED from roads (returns undefined)", () => {
  const layer = classifyOsmFeature({ highway: "platform" });
  assert.equal(layer, undefined);
});

test("rail: railway=subway classifies as rail", () => {
  const layer = classifyOsmFeature({ railway: "subway" });
  assert.deepEqual(layer, { kind: "rail", subclass: "subway", zOrder: 51 } satisfies Layer);
});

test("rail: railway=platform does NOT match the rail rule (returns undefined)", () => {
  // Only track types match; platforms/stations are not modelled as rail lines.
  const layer = classifyOsmFeature({ railway: "platform" });
  assert.equal(layer, undefined);
});

test("landuse: landuse=residential is the broad catch-all", () => {
  const layer = classifyOsmFeature({ landuse: "residential" });
  assert.deepEqual(layer, {
    kind: "landuse",
    subclass: "residential",
    zOrder: 30,
  } satisfies Layer);
});

test("building: building=yes classifies as building with subclass", () => {
  const layer = classifyOsmFeature({ building: "yes" });
  assert.deepEqual(layer, { kind: "building", subclass: "yes", zOrder: 60 } satisfies Layer);
});

test("building: building=apartments folds the value into subclass", () => {
  const layer = classifyOsmFeature({ building: "apartments" });
  assert.equal(layer?.kind, "building");
  assert.equal(layer?.subclass, "apartments");
});

test("building: building=no is EXCLUDED (returns undefined)", () => {
  assert.equal(classifyOsmFeature({ building: "no" }), undefined);
});

test("unmatched tags return undefined", () => {
  assert.equal(classifyOsmFeature({ amenity: "cafe" }), undefined);
  assert.equal(classifyOsmFeature({}), undefined);
});

test("first-match-wins: water rules win over the landuse catch-all", () => {
  // A feature tagged both natural=water and landuse=reservoir must be water.
  const layer = classifyOsmFeature({ natural: "water", landuse: "reservoir" });
  assert.equal(layer?.kind, "water");
});

test("options.mapping override is honoured", () => {
  const custom: OsmLayerMapping = [
    { match: [{ key: "amenity", value: "cafe" }], layer: { kind: "landuse", zOrder: 1 } },
  ];
  const layer = classifyOsmFeature({ amenity: "cafe" }, { mapping: custom });
  assert.equal(layer?.kind, "landuse");
  assert.equal(layer?.zOrder, 1);
  // The canonical mapping is unaffected.
  assert.equal(classifyOsmFeature({ amenity: "cafe" }), undefined);
});

test("canonicalOsmLayerMapping is exported and ordered (admin first, landuse last)", () => {
  assert.ok(canonicalOsmLayerMapping.length >= 6);
  const first = canonicalOsmLayerMapping[0]!;
  const last = canonicalOsmLayerMapping[canonicalOsmLayerMapping.length - 1]!;
  assert.deepEqual(first.match[0], { key: "boundary", value: "administrative" });
  assert.deepEqual(last.match[0], { key: "landuse" });
});
