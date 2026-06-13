import { test } from "node:test";
import assert from "node:assert/strict";
import proj4 from "proj4";
import {
  toPlanar,
  toLonLat,
  projectRing,
  unprojectRing,
  type LonLat,
} from "../src/index.ts";

// proj4 oracle: register the authoritative EPSG:6677 definition (JGD2011 /
// Japan Plane Rectangular CS IX). proj4 is a TEST-ONLY dependency — it never
// appears in `dependencies`; geo-model's own projection is closed-form.
const EPSG_6677 =
  "+proj=tmerc +lat_0=36 +lon_0=139.833333333333 +k=0.9999 +x_0=0 +y_0=0 " +
  "+ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs";
proj4.defs("EPSG:6677", EPSG_6677);
const fwd = proj4("WGS84", "EPSG:6677");

// Tolerance: closed-form vs proj4 must agree to well under a millimetre.
const TOL_M = 1e-3;

// Representative Tokyo points [lon, lat].
const POINTS: { name: string; p: LonLat }[] = [
  { name: "Shibuya", p: [139.70, 35.66] },
  { name: "Tokyo Station", p: [139.767, 35.681] },
  { name: "Shinjuku", p: [139.7005, 35.6938] },
  { name: "origin lon0/lat0", p: [139.833333333333, 36.0] },
  { name: "Yokohama", p: [139.638, 35.444] },
  { name: "Chiba", p: [140.123, 35.607] },
];

let maxDeviation = 0;

for (const { name, p } of POINTS) {
  test(`forward matches proj4 within ${TOL_M} m @ ${name}`, () => {
    const mine = toPlanar(p);
    const ref = fwd.forward([p[0], p[1]]); // [easting, northing]
    const dx = mine[0] - ref[0]!;
    const dy = mine[1] - ref[1]!;
    const dev = Math.hypot(dx, dy);
    maxDeviation = Math.max(maxDeviation, dev);
    assert.ok(
      dev < TOL_M,
      `${name}: deviation ${dev} m exceeds ${TOL_M} m (mine=${mine}, proj4=${ref})`,
    );
  });

  test(`inverse matches proj4 within ${TOL_M} m @ ${name}`, () => {
    const planar = fwd.forward([p[0], p[1]]);
    const mine = toLonLat([planar[0]!, planar[1]!]);
    const ref = fwd.inverse([planar[0]!, planar[1]!]); // [lon, lat]
    // Compare in metres-equivalent: convert the lon/lat delta via the forward map.
    const a = toPlanar(mine);
    const b = toPlanar([ref[0]!, ref[1]!]);
    const dev = Math.hypot(a[0] - b[0], a[1] - b[1]);
    maxDeviation = Math.max(maxDeviation, dev);
    assert.ok(dev < TOL_M, `${name}: inverse deviation ${dev} m exceeds ${TOL_M} m`);
  });

  test(`round-trip toLonLat(toPlanar(p)) ≈ p @ ${name}`, () => {
    const back = toLonLat(toPlanar(p));
    // ~1e-9 deg ≈ 1e-4 m; assert tight.
    assert.ok(Math.abs(back[0] - p[0]) < 1e-8, `${name}: lon round-trip drift`);
    assert.ok(Math.abs(back[1] - p[1]) < 1e-8, `${name}: lat round-trip drift`);
  });
}

test("projectRing / unprojectRing round-trip a ring", () => {
  const ring: LonLat[] = POINTS.map((x) => x.p);
  const projected = projectRing(ring);
  const back = unprojectRing(projected);
  assert.equal(back.length, ring.length);
  for (let i = 0; i < ring.length; i++) {
    assert.ok(Math.abs(back[i]![0] - ring[i]![0]) < 1e-8);
    assert.ok(Math.abs(back[i]![1] - ring[i]![1]) < 1e-8);
  }
});

test("max deviation vs proj4 across all points is sub-mm (reported)", () => {
  // Reported for the handoff; the per-point assertions already enforce < TOL_M.
  console.log(`[projection] max deviation vs proj4 = ${maxDeviation.toExponential(3)} m`);
  assert.ok(maxDeviation < TOL_M);
});
