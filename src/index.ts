/**
 * `@hwcharlton/geo-model` — the deps-free shared model for the @hwcharlton
 * geo-data ecosystem.
 *
 * Three concerns, zero runtime dependencies:
 *  1. Layer taxonomy + the canonical Japan-aware OSM → layer mapping
 *     ({@link ./layers}).
 *  2. EPSG:6677 (JGD2011 / Japan Plane Rectangular CS IX) projection, closed-form
 *     ({@link ./projection}).
 *  3. License / provenance / attribution types + the artifact manifest builder
 *     ({@link ./provenance}).
 *  4. The `geo-area-pack/1` on-disk wire manifest + the repo-relative pack-path
 *     layout shared by producer and consumer ({@link ./pack}).
 */

export {
  type LayerKind,
  type Layer,
  type OsmTags,
  type OsmTagSelector,
  type OsmLayerRule,
  type OsmLayerMapping,
  type ClassifyOptions,
  canonicalOsmLayerMapping,
  classifyOsmFeature,
} from "./layers.js";

export {
  type LonLat,
  type PlanarXY,
  toPlanar,
  toLonLat,
  projectRing,
  unprojectRing,
} from "./projection.js";

export {
  type LicenseId,
  type LicenseObligation,
  type SourceId,
  type Provenance,
  type ArtifactManifest,
  type BuildManifestDeps,
  type BuildManifestOptions,
  OSM_ATTRIBUTION,
  buildManifest,
} from "./provenance.js";

export {
  type DetailTier,
  type AreaPackSource,
  type AreaPackSimplify,
  type AreaPackCompression,
  type AreaPackPipeline,
  type AreaPackArtifact,
  type AreaPackManifest,
  type PackPaths,
  packPaths,
} from "./pack.js";
