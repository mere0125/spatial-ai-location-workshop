# Where My Attention Goes

At 11:47 PM, my body is in Avery Hall, but my attention is not. This project maps the distance between the two.

The interactive 2.5D model uses current OpenStreetMap building footprints, paths, streets, names, and available height data for Columbia University's Morningside campus. Every moving thought remains tethered to a fixed body marker at Avery. The other end drifts toward five competing destinations: the deadline at Avery Hall, research at Butler Library, food at John Jay, the way home at the 116th Street subway, and one good idea near Low Library.

Moving thoughts drift toward those attraction fields. The project keeps the four location queries from the workshop visible and testable:

1. **Thing → where:** follow a moving thought and read its live building, field, and campus coordinate.
2. **Where → what:** click any building or ground location to inspect what occupies it.
3. **Relative to:** locate a thought in the local reference frame of a named campus building.
4. **Words → place:** resolve phrases such as “between Avery and Low” or “near food but far from studio” into a specific campus location.

## Two forms of distance

The fifth mode compares any two occupants or locations through two deliberately different spatial metrics:

- **Isovist distance** treats each viewpoint as a binary visibility profile. Sightlines are tested against the OSM building footprints on a fixed 36 m campus grid within a 270 m horizon. The reported value is the Jaccard difference between the two sets of visible cells: `0%` means the same visible set; `100%` means no visible cell is shared.
- **Attention-distribution distance** treats each occupant or location as a normalized distribution across the five named attraction fields. The reported `a·m` value is a 1-Wasserstein / Earth Mover distance: the minimum weighted distance needed to transform one attention distribution into the other, using physical distances between the five anchors as the transport cost.

The default comparison pairs “section model” with “email professor.” Their viewpoints are far apart while both are pulled toward the Avery deadline field, creating the required case that is far in one metric and close in another. The attention field is an authored conceptual model rather than eye-tracking or measured cognition; that distinction is stated in the interface.

The map can be rotated and zoomed. Building heights come from OpenStreetMap where available and fall back to a restrained estimated height when absent.

Map data © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright), ODbL. Generated from an OSM API extract on October 10, 2026.

**Mere Cui — Spatial AI, October 2026**
