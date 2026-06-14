/**
 * The `geo-area-pack/1` on-disk WIRE contract: the manifest JSON that
 * `geo-build` bakes next to each pack and `geo-client` fetches, plus the pure
 * repo-relative path layout both repos derive from.
 *
 * This is the single source of truth for two contracts that previously drifted
 * across repos:
 *  - {@link AreaPackManifest} — the **on-disk** manifest. It uses **snake_case**
 *    field names (`attribution_lines`, `requires_share_alike`, `input_file`,
 *    `hash_algo`, …) and a `ward` field, exactly as serialised to JSON. This is
 *    distinct from {@link ./provenance}'s camelCase `ArtifactManifest`, which is
 *    the **in-memory / sidecar** provenance shape produced by `buildManifest`
 *    and is intentionally a *different* (overlapping) object — do not conflate
 *    the two.
 *  - {@link packPaths} — the repo-relative `packs/{place}/{layer}/…` layout.
 *
 * Deps-free and browser-safe: types only + one pure string-building function.
 */

/**
 * A baked pack's detail tier. `high`/`med`/`low` are the area-pack simplify
 * tiers; `flat` is a single un-tiered representation used by layers where
 * per-detail LODs don't apply (e.g. the `building` footprint layer).
 */
export type DetailTier = "high" | "med" | "low" | "flat";

/**
 * The `source` block of an {@link AreaPackManifest}: where the data came from.
 *
 * `license` is a free-form string here (the on-disk value, e.g. `"ODbL-1.0"`),
 * intentionally **not** narrowed to `LicenseId` — the wire format records
 * whatever the bake metadata supplied and is not constrained to the
 * ecosystem's SPDX-ish enum.
 */
export interface AreaPackSource {
  /** Human source name, e.g. `"OpenStreetMap"`. */
  readonly name: string;
  /** Free-form licence identifier as recorded on disk, e.g. `"ODbL-1.0"`. */
  readonly license: string;
  /** Attribution line to surface, e.g. `"© OpenStreetMap contributors"`. */
  readonly attribution: string;
  /** Upstream input filename, e.g. `"kanto-latest.osm.pbf"`. */
  readonly input_file: string;
  /** Upstream input provider, e.g. `"Geofabrik (asia/japan/kanto)"`. */
  readonly input_provider: string;
  /** Upstream input date (ISO date string), e.g. `"2026-06-12"`. */
  readonly input_date: string;
}

/** The `pipeline.simplify` sub-block: the simplification step's parameters. */
export interface AreaPackSimplify {
  /** mapshaper `-simplify` method string recorded per tier. */
  readonly method: string;
  /** Percentage kept, recorded as a string with a trailing `%`, e.g. `"30%"`. */
  readonly percentage: string;
}

/** The `pipeline.compression` sub-block. */
export interface AreaPackCompression {
  /** Compression codec, e.g. `"brotli"`. */
  readonly codec: string;
  /** Codec quality level, e.g. `11`. */
  readonly quality: number;
}

/** The `pipeline` block of an {@link AreaPackManifest}: how the pack was built. */
export interface AreaPackPipeline {
  readonly simplify: AreaPackSimplify;
  /** TopoJSON quantization grid size, e.g. `1000000`. */
  readonly quantization: number;
  /** Output format, e.g. `"topojson"`. */
  readonly format: string;
  readonly compression: AreaPackCompression;
}

/**
 * The `artifact` block of an {@link AreaPackManifest}: the produced files and
 * their byte sizes + content hashes.
 */
export interface AreaPackArtifact {
  /** Primary (content-hashed, compressed) filename, e.g. `high.<hash>.topo.json.br`. */
  readonly file: string;
  /** Raw uncompressed alias filename, e.g. `high.topo.json`. */
  readonly file_raw: string;
  /** Byte size of the raw TopoJSON. */
  readonly bytes_topojson: number;
  /** Byte size of the brotli-compressed artifact. */
  readonly bytes_brotli: number;
  /** Hash algorithm + truncation, e.g. `"sha256:12"`. */
  readonly hash_algo: string;
  /** Content hash of the raw TopoJSON bytes. */
  readonly hash_topojson: string;
  /** Content hash of the brotli-compressed bytes (also embedded in `file`). */
  readonly hash_brotli: string;
}

/**
 * The on-disk `geo-area-pack/1` manifest, serialised as
 * `packs/{ward}/{layer}/{detail}.manifest.json`.
 *
 * Field names are **snake_case** and match the JSON byte-for-byte. This is the
 * WIRE shape shared by `geo-build` (producer) and `geo-client` (consumer); it
 * is deliberately separate from the camelCase in-memory `ArtifactManifest` in
 * {@link ./provenance}.
 */
export interface AreaPackManifest {
  /** Schema discriminator. */
  readonly schema: "geo-area-pack/1";
  /** The place / ward slug the pack covers, e.g. `"minato"`. */
  readonly ward: string;
  /** The layer the pack represents, e.g. `"road"`. */
  readonly layer: string;
  /** The detail tier of this pack. */
  readonly detail: DetailTier;
  readonly source: AreaPackSource;
  readonly pipeline: AreaPackPipeline;
  /** Tool name → version map, e.g. `{ "mapshaper": "0.7.22" }`. */
  readonly tools: Readonly<Record<string, string>>;
  readonly artifact: AreaPackArtifact;
  /** Deduplicated, ordered attribution lines to surface to end users. */
  readonly attribution_lines: readonly string[];
  /** True iff any contributing source carries a share-alike obligation. */
  readonly requires_share_alike: boolean;
  /** When the pack was baked (ISO 8601 timestamp). */
  readonly generated_at: string;
}

/**
 * The repo-relative paths for one baked pack, as composed *after* any base URL
 * / bucket prefix (no leading slash, no base is prepended here).
 */
export interface PackPaths {
  /** The pack directory: `packs/{place}/{layer}`. */
  readonly dir: string;
  /** The manifest: `packs/{place}/{layer}/{detail}.manifest.json`. */
  readonly manifest: string;
  /** An artifact under the pack dir: `packs/{place}/{layer}/{file}`. */
  readonly artifact: (file: string) => string;
}

/**
 * Build the repo-relative path layout for a baked pack. Pure, deps-free, and
 * the single source of truth for the `packs/{place}/{layer}/…` scheme that
 * `geo-build` lays out and `geo-client` fetches.
 *
 * Paths are returned **without** any base URL or leading slash — callers
 * compose them after their own base (e.g. `${baseUrl}/${packPaths(...).manifest}`),
 * matching geo-client's existing `${base}/packs/${ward}/${layer}/…` building
 * with zero behaviour change.
 *
 * `place` is the canonical place id (geo-client passes its `ward` value here).
 *
 * @example
 * const p = packPaths("minato", "road", "high");
 * p.dir;                                  // "packs/minato/road"
 * p.manifest;                             // "packs/minato/road/high.manifest.json"
 * p.artifact("high.f7b40104be38.topo.json.br");
 *   // "packs/minato/road/high.f7b40104be38.topo.json.br"
 */
export const packPaths = (
  place: string,
  layer: string,
  detail: DetailTier,
): PackPaths => {
  const dir = `packs/${place}/${layer}`;
  return {
    dir,
    manifest: `${dir}/${detail}.manifest.json`,
    artifact: (file: string) => `${dir}/${file}`,
  };
};
