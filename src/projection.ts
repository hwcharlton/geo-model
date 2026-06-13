/**
 * EPSG:6677 — JGD2011 / Japan Plane Rectangular Coordinate System IX —
 * transverse Mercator, implemented **closed-form with zero runtime
 * dependencies**.
 *
 * This is the projection used across the Tokyo/Kantō geo-data ecosystem. Keeping
 * it deps-free is the whole point of `geo-model`: consumers project ↔ unproject
 * without pulling in proj4 (proj4 is used only as a *test-time* oracle).
 *
 * Method: the Krüger n-series (a.k.a. the "Gauss–Krüger" / Karney transverse
 * Mercator expansion) carried to 4th order in the third flattening `n`. This is
 * the same ellipsoidal `tmerc` algorithm proj4/PROJ use by default and is
 * accurate to well under a millimetre over the ~±2° zone width of a Japan Plane
 * Rectangular CS.
 *
 * Projection parameters (EPSG:6677):
 *   - ellipsoid GRS80: a = 6378137 m, 1/f = 298.257222101
 *   - lat_0 = 36°, lon_0 = 139.8333333333333° (= 139°50′)
 *   - k_0 = 0.9999
 *   - x_0 = 0, y_0 = 0
 *
 * Axis convention (matches proj4 / GIS [easting, northing]):
 *   - {@link PlanarXY} = [x, y] = [easting, northing] in metres
 *   - {@link LonLat}   = [lon, lat] in degrees
 */

/** A geographic coordinate `[longitude, latitude]` in **degrees**. */
export type LonLat = readonly [lon: number, lat: number];

/** A projected coordinate `[easting, northing]` in **metres** (EPSG:6677). */
export type PlanarXY = readonly [x: number, y: number];

// ---- EPSG:6677 constants -------------------------------------------------

const A = 6378137; // GRS80 semi-major axis (m)
const INV_F = 298.257222101; // GRS80 inverse flattening
const F = 1 / INV_F;
const K0 = 0.9999;
const LAT0_DEG = 36;
const LON0_DEG = 139.83333333333333; // 139°50′ = 139 + 50/60
const X0 = 0;
const Y0 = 0;

const DEG2RAD = Math.PI / 180;
const RAD2DEG = 180 / Math.PI;

const LAT0 = LAT0_DEG * DEG2RAD;
const LON0 = LON0_DEG * DEG2RAD;

// Third flattening n and the rectifying-radius scaling.
const N = F / (2 - F);
const N2 = N * N;
const N3 = N2 * N;
const N4 = N3 * N;

// A_bar: mean radius for the rectifying latitude / meridian arc.
const A_BAR = (A / (1 + N)) * (1 + N2 / 4 + N4 / 64);

// Krüger series coefficients (geographic → projected), α_i, to 4th order in n.
const ALPHA = [
  N / 2 - (2 / 3) * N2 + (5 / 16) * N3 + (41 / 180) * N4,
  (13 / 48) * N2 - (3 / 5) * N3 + (557 / 1440) * N4,
  (61 / 240) * N3 - (103 / 140) * N4,
  (49561 / 161280) * N4,
] as const;

// Inverse series coefficients (projected → geographic), β_i, to 4th order in n.
const BETA = [
  N / 2 - (2 / 3) * N2 + (37 / 96) * N3 - (1 / 360) * N4,
  (1 / 48) * N2 + (1 / 15) * N3 - (437 / 1440) * N4,
  (17 / 480) * N3 - (37 / 840) * N4,
  (4397 / 161280) * N4,
] as const;

// Meridian arc from the equator to lat0 (times A_bar), used to offset northing.
const meridianArc = (lat: number): number => {
  // Rectifying latitude series ξ at the foot point uses the same α coefficients.
  // We evaluate the full forward northing for ϕ on the central meridian.
  const e2 = F * (2 - F);
  const e = Math.sqrt(e2);
  const t = Math.sinh(
    Math.atanh(Math.sin(lat)) - e * Math.atanh(e * Math.sin(lat)),
  );
  const xiPrime = Math.atan2(t, 1); // ξ' on central meridian (η' = 0)
  let northing = xiPrime;
  for (let j = 1; j <= 4; j++) {
    northing += ALPHA[j - 1]! * Math.sin(2 * j * xiPrime);
  }
  return A_BAR * northing;
};

// Northing offset so that y = 0 at lat0 on the central meridian.
const NORTHING0 = meridianArc(LAT0);

/**
 * Forward projection: geographic `[lon, lat]` (degrees) → planar
 * `[easting, northing]` (metres) in EPSG:6677.
 *
 * Pure; no dependencies.
 */
export const toPlanar = (lonLat: LonLat): PlanarXY => {
  const lon = lonLat[0] * DEG2RAD;
  const lat = lonLat[1] * DEG2RAD;

  const e2 = F * (2 - F);
  const e = Math.sqrt(e2);

  // Conformal latitude → ξ' (rectifying-ish) and η' on the central meridian.
  const t = Math.sinh(
    Math.atanh(Math.sin(lat)) - e * Math.atanh(e * Math.sin(lat)),
  );
  const lambda = lon - LON0;
  const xiPrime = Math.atan2(t, Math.cos(lambda));
  const etaPrime = Math.asinh(Math.sin(lambda) / Math.hypot(t, Math.cos(lambda)));

  let xi = xiPrime;
  let eta = etaPrime;
  for (let j = 1; j <= 4; j++) {
    const a = ALPHA[j - 1]!;
    xi += a * Math.sin(2 * j * xiPrime) * Math.cosh(2 * j * etaPrime);
    eta += a * Math.cos(2 * j * xiPrime) * Math.sinh(2 * j * etaPrime);
  }

  const easting = X0 + K0 * A_BAR * eta;
  const northing = Y0 + K0 * (A_BAR * xi - NORTHING0);
  return [easting, northing];
};

/**
 * Inverse projection: planar `[easting, northing]` (metres) in EPSG:6677 →
 * geographic `[lon, lat]` (degrees).
 *
 * Pure; no dependencies.
 */
export const toLonLat = (planar: PlanarXY): LonLat => {
  const e2 = F * (2 - F);
  const e = Math.sqrt(e2);

  const xi = (planar[1] - Y0 + K0 * NORTHING0) / (K0 * A_BAR);
  const eta = (planar[0] - X0) / (K0 * A_BAR);

  let xiPrime = xi;
  let etaPrime = eta;
  for (let j = 1; j <= 4; j++) {
    const b = BETA[j - 1]!;
    xiPrime -= b * Math.sin(2 * j * xi) * Math.cosh(2 * j * eta);
    etaPrime -= b * Math.cos(2 * j * xi) * Math.sinh(2 * j * eta);
  }

  const chi = Math.asin(Math.sin(xiPrime) / Math.cosh(etaPrime)); // conformal latitude

  // Conformal → geodetic latitude via fixed-point iteration on the isometric form.
  let lat = chi;
  for (let i = 0; i < 8; i++) {
    const next =
      Math.asin(Math.tanh(Math.atanh(Math.sin(chi)) + e * Math.atanh(e * Math.sin(lat))));
    if (Math.abs(next - lat) < 1e-14) {
      lat = next;
      break;
    }
    lat = next;
  }

  const lon = LON0 + Math.atan2(Math.sinh(etaPrime), Math.cos(xiPrime));
  return [lon * RAD2DEG, lat * RAD2DEG];
};

/**
 * Project a ring/linestring of `[lon, lat]` coordinates to EPSG:6677
 * `[easting, northing]`. Returns a new array; input is not mutated.
 */
export const projectRing = (ring: readonly LonLat[]): PlanarXY[] =>
  ring.map(toPlanar);

/**
 * Unproject a ring/linestring of EPSG:6677 `[easting, northing]` coordinates
 * back to `[lon, lat]`. Returns a new array; input is not mutated.
 */
export const unprojectRing = (ring: readonly PlanarXY[]): LonLat[] =>
  ring.map(toLonLat);
