/**
 * Layer taxonomy and the canonical OSM tag → layer classification for the
 * @hwcharlton geo-data ecosystem.
 *
 * The mapping is **Japan-aware** and **first-match-wins** (ordered). It is the
 * single source of truth shared by the baker (`geo-build`) and any consumer.
 * It uses **OSM tags only** — never N03/GSI admin boundaries (ADR-013).
 *
 * Pure, dependency-free.
 */

/** The fixed set of render/data layers a feature can belong to. */
export type LayerKind =
  | "admin"
  | "water"
  | "coastline"
  | "road"
  | "rail"
  | "landuse";

/**
 * A resolved layer for a feature: its {@link LayerKind}, an optional finer
 * `subclass` (e.g. the OSM `highway` value or the admin level), and a
 * `zOrder` hint for stable draw ordering (lower draws first / underneath).
 */
export interface Layer {
  readonly kind: LayerKind;
  readonly subclass?: string;
  readonly zOrder: number;
}

/** Raw OSM tags for a feature (string keys → string values). */
export type OsmTags = Readonly<Record<string, string>>;

/**
 * A predicate over a single OSM tag. `value` may be:
 *  - omitted → the `key` must merely be present (any value);
 *  - a string → exact match;
 *  - a string array → match any of the listed values;
 *  - `{ not }` → present and NOT equal to any of the excluded values.
 */
export interface OsmTagSelector {
  readonly key: string;
  readonly value?: string | readonly string[] | { readonly not: readonly string[] };
}

/**
 * One rule in the mapping. A feature matches the rule when it satisfies **all**
 * selectors in `match` (logical AND). The first matching rule wins.
 *
 * `layer` may be a static {@link Layer} or a function deriving it from the
 * feature's tags (used to fold `admin_level` / `highway` value into `subclass`).
 */
export interface OsmLayerRule {
  readonly match: readonly OsmTagSelector[];
  readonly layer: Layer | ((tags: OsmTags) => Layer);
}

/** An ordered, first-match-wins list of {@link OsmLayerRule}. */
export type OsmLayerMapping = readonly OsmLayerRule[];

const matchesSelector = (tags: OsmTags, selector: OsmTagSelector): boolean => {
  const actual = tags[selector.key];
  if (actual === undefined) return false;
  const { value } = selector;
  if (value === undefined) return true;
  if (typeof value === "string") return actual === value;
  if (Array.isArray(value)) return value.includes(actual);
  // { not: [...] }
  return !(value as { not: readonly string[] }).not.includes(actual);
};

const matchesRule = (tags: OsmTags, rule: OsmLayerRule): boolean =>
  rule.match.every((selector) => matchesSelector(tags, selector));

/**
 * The canonical, Japan-aware OSM → layer mapping (ordered, first-match-wins),
 * as fixed by spike 03 / ADR-016.
 *
 * Order matters: the more specific water rules precede the broad `landuse=*`
 * and `highway=*` catch-alls, and `highway=platform` is excluded from roads.
 */
export const canonicalOsmLayerMapping: OsmLayerMapping = [
  // admin — OSM administrative boundaries (NOT N03); fold admin_level into subclass.
  {
    match: [{ key: "boundary", value: "administrative" }],
    layer: (tags) => ({
      kind: "admin",
      subclass: tags["admin_level"],
      zOrder: 70,
    }),
  },
  // water — areal water bodies and riverbank/dock polygons.
  {
    match: [{ key: "natural", value: "water" }],
    layer: { kind: "water", subclass: "water", zOrder: 20 },
  },
  {
    match: [{ key: "waterway", value: ["riverbank", "dock"] }],
    layer: (tags) => ({ kind: "water", subclass: tags["waterway"], zOrder: 20 }),
  },
  // water — linear waterways.
  {
    match: [{ key: "waterway", value: ["river", "stream", "canal", "drain", "ditch"] }],
    layer: (tags) => ({ kind: "water", subclass: tags["waterway"], zOrder: 21 }),
  },
  // coastline.
  {
    match: [{ key: "natural", value: "coastline" }],
    layer: { kind: "coastline", subclass: "coastline", zOrder: 10 },
  },
  // road — every highway EXCEPT platforms (which are rail/transit furniture).
  {
    match: [{ key: "highway", value: { not: ["platform"] } }],
    layer: (tags) => ({ kind: "road", subclass: tags["highway"], zOrder: 50 }),
  },
  // rail — the relevant railway track types.
  {
    match: [
      {
        key: "railway",
        value: [
          "rail",
          "light_rail",
          "subway",
          "monorail",
          "tram",
          "narrow_gauge",
          "funicular",
        ],
      },
    ],
    layer: (tags) => ({ kind: "rail", subclass: tags["railway"], zOrder: 51 }),
  },
  // landuse — broad catch-all (kept last so specific rules win).
  {
    match: [{ key: "landuse" }],
    layer: (tags) => ({ kind: "landuse", subclass: tags["landuse"], zOrder: 30 }),
  },
];

/** Options for {@link classifyOsmFeature}. */
export interface ClassifyOptions {
  /** Override the mapping; defaults to {@link canonicalOsmLayerMapping}. */
  readonly mapping?: OsmLayerMapping;
}

/**
 * Classify an OSM feature into a {@link Layer} by walking the mapping in order
 * and returning the first match. Returns `undefined` when nothing matches
 * (the feature belongs to none of the modelled layers).
 *
 * Pure; no dependencies.
 */
export const classifyOsmFeature = (
  tags: OsmTags,
  options?: ClassifyOptions,
): Layer | undefined => {
  const mapping = options?.mapping ?? canonicalOsmLayerMapping;
  for (const rule of mapping) {
    if (matchesRule(tags, rule)) {
      return typeof rule.layer === "function" ? rule.layer(tags) : rule.layer;
    }
  }
  return undefined;
};
