/**
 * License / provenance / attribution types and the artifact manifest builder.
 *
 * Source separation and per-artifact provenance are binding from the first
 * artifact (ADR-013). The manifest shape aligns with `geo-area-pack/1`
 * (ADR-016): every artifact records where its data came from, under what
 * licence, the attribution lines to surface, whether it carries a share-alike
 * obligation, and a content hash of its bytes.
 *
 * The single dependency-injection seam is {@link buildManifest}: the byte
 * hashing function is injected so this module stays pure and crypto-free.
 */

/** SPDX-ish licence identifiers used across the ecosystem's data sources. */
export type LicenseId =
  | "ODbL-1.0"
  | "CC-BY-4.0"
  | "ODC-BY-1.0"
  | "PDL-1.0"
  | "GSI-Terms"
  | "Copernicus"
  | "PD";

/**
 * The kind of obligation a licence imposes on the produced artifact.
 *  - `produced-work` — attribution only (e.g. a rendered map / image).
 *  - `derivative-database` — share-alike on the database itself (e.g. ODbL).
 */
export type LicenseObligation = "produced-work" | "derivative-database";

/** Upstream data sources. */
export type SourceId = "osm" | "plateau" | "gsi" | "n03" | "copernicus" | "srtm";

/** One provenance entry: a single source contributing to an artifact. */
export interface Provenance {
  readonly source: SourceId;
  readonly license: LicenseId;
  /** Human-readable attribution string for this source. */
  readonly attribution: string;
  readonly obligation: LicenseObligation;
  /** Optional pointer to the exact upstream input (URL, file, extract date). */
  readonly sourceRef?: string;
}

/**
 * The provenance + content manifest emitted alongside every baked artifact
 * (`geo-area-pack/1` shape).
 */
export interface ArtifactManifest {
  /** Schema discriminator. */
  readonly schema: "geo-area-pack/1";
  /** Stable identifier for the artifact (e.g. `shibuya/admin/high`). */
  readonly artifactId: string;
  /** The layer this artifact represents. */
  readonly layer: string;
  /** All sources that contributed, in declaration order. */
  readonly provenance: readonly Provenance[];
  /** Content hash of the artifact bytes (algorithm decided by the injected hasher). */
  readonly contentHash: string;
  /**
   * Derived: true iff any provenance entry carries a `derivative-database`
   * (share-alike) obligation.
   */
  readonly requiresShareAlike: boolean;
  /** Deduplicated, ordered attribution lines to surface to end users. */
  readonly attributionLines: readonly string[];
}

/** The standard, always-present attribution line for OpenStreetMap data. */
export const OSM_ATTRIBUTION = "© OpenStreetMap contributors";

/** Dependencies injected into {@link buildManifest}. */
export interface BuildManifestDeps {
  /** Hash the artifact bytes into a stable string (e.g. `sha256:<hex>`). */
  readonly hashBytes: (bytes: Uint8Array) => string;
}

/** Options describing the artifact whose manifest is being built. */
export interface BuildManifestOptions {
  readonly artifactId: string;
  readonly layer: string;
  readonly provenance: readonly Provenance[];
}

/**
 * Build an {@link ArtifactManifest} for `bytes` and the given provenance.
 *
 * The byte hashing is the single DI seam (`deps.hashBytes`) — crypto is never
 * imported here, keeping the package deps-free. Derivations:
 *  - `requiresShareAlike` = any provenance with `obligation === "derivative-database"`.
 *  - `attributionLines` = the provenance attribution strings, deduplicated and
 *    order-preserving; the OSM line ({@link OSM_ATTRIBUTION}) is always included
 *    when any source is `osm`.
 */
export const buildManifest = (
  deps: BuildManifestDeps,
  bytes: Uint8Array,
  options: BuildManifestOptions,
): ArtifactManifest => {
  const { provenance } = options;

  const requiresShareAlike = provenance.some(
    (p) => p.obligation === "derivative-database",
  );

  const lines: string[] = [];
  const seen = new Set<string>();
  const add = (line: string): void => {
    if (!seen.has(line)) {
      seen.add(line);
      lines.push(line);
    }
  };
  // Always surface the OSM attribution when OSM contributed.
  if (provenance.some((p) => p.source === "osm")) add(OSM_ATTRIBUTION);
  for (const p of provenance) add(p.attribution);

  return {
    schema: "geo-area-pack/1",
    artifactId: options.artifactId,
    layer: options.layer,
    provenance,
    contentHash: deps.hashBytes(bytes),
    requiresShareAlike,
    attributionLines: lines,
  };
};
