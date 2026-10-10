#!/usr/bin/env python3
"""Convert an OpenStreetMap XML extract into a compact campus geometry bundle."""

import json
import math
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

SOURCE = Path(sys.argv[1] if len(sys.argv) > 1 else "/tmp/columbia.osm")
DEST = Path(sys.argv[2] if len(sys.argv) > 2 else "campus-data.js")

# Main Columbia / Barnard campus and the adjacent blocks used by the simulation.
WEST, SOUTH, EAST, NORTH = -73.9662, 40.8050, -73.9567, 40.8123
CENTER_LON = (WEST + EAST) / 2
CENTER_LAT = (SOUTH + NORTH) / 2
COS_LAT = math.cos(math.radians(CENTER_LAT))


def xy(lat, lon):
    return [round((lon - CENTER_LON) * 111_320 * COS_LAT, 1), round((lat - CENTER_LAT) * 110_540, 1)]


root = ET.parse(SOURCE).getroot()
nodes = {
    node.attrib["id"]: (float(node.attrib["lat"]), float(node.attrib["lon"]))
    for node in root.findall("node")
}


def tags(element):
    return {tag.attrib["k"]: tag.attrib["v"] for tag in element.findall("tag")}


def geometry(way):
    result = []
    for nd in way.findall("nd"):
        point = nodes.get(nd.attrib["ref"])
        if point:
            result.append(point)
    return result


def centroid(points):
    if not points:
        return (0, 0)
    return (sum(p[0] for p in points) / len(points), sum(p[1] for p in points) / len(points))


def in_bounds(points):
    lat, lon = centroid(points)
    return SOUTH <= lat <= NORTH and WEST <= lon <= EAST


def parse_height(data):
    raw = data.get("height", "").replace(" m", "").replace("m", "")
    try:
        return max(4, min(145, float(raw))), "osm-height"
    except ValueError:
        pass
    try:
        levels = float(data.get("building:levels", 0))
        if levels > 0:
            return max(4, min(145, levels * 3.3 + 2.5)), "levels-estimate"
    except ValueError:
        pass
    return 16, "schematic-default"


buildings, routes, grounds = [], [], []
for way in root.findall("way"):
    data = tags(way)
    points = geometry(way)
    if len(points) < 2 or not in_bounds(points):
        continue
    coords = [xy(lat, lon) for lat, lon in points]
    if "building" in data and len(coords) >= 4:
        height, height_source = parse_height(data)
        buildings.append({
            "id": int(way.attrib["id"]),
            "name": data.get("name", ""),
            "height": round(height, 1),
            "heightSource": height_source,
            "kind": data.get("building", "yes"),
            "points": coords,
        })
    elif "highway" in data:
        kind = data["highway"]
        if kind in {"primary", "secondary", "tertiary", "residential", "service", "pedestrian", "footway", "steps", "path"}:
            routes.append({"name": data.get("name", ""), "kind": kind, "points": coords})
    elif len(coords) >= 4 and (data.get("leisure") in {"park", "garden", "pitch"} or data.get("landuse") in {"grass", "recreation_ground", "meadow"} or data.get("natural") == "wood"):
        grounds.append({"name": data.get("name", ""), "kind": data.get("leisure") or data.get("landuse") or data.get("natural"), "points": coords})

pois = []
for node in root.findall("node"):
    data = tags(node)
    if not data.get("name"):
        continue
    lat, lon = nodes[node.attrib["id"]]
    if SOUTH <= lat <= NORTH and WEST <= lon <= EAST and any(k in data for k in ("amenity", "railway", "public_transport", "shop", "tourism")):
        pois.append({"name": data["name"], "kind": data.get("amenity") or data.get("railway") or data.get("public_transport") or data.get("shop") or data.get("tourism"), "point": xy(lat, lon)})

payload = {
    "meta": {
        "source": "© OpenStreetMap contributors",
        "sourceUrl": "https://www.openstreetmap.org/copyright",
        "center": [CENTER_LON, CENTER_LAT],
        "bounds": [WEST, SOUTH, EAST, NORTH],
        "units": "meters",
    },
    "buildings": buildings,
    "routes": routes,
    "grounds": grounds,
    "pois": pois,
}

DEST.write_text("window.CAMPUS_DATA=" + json.dumps(payload, separators=(",", ":"), ensure_ascii=False) + ";\n", encoding="utf-8")
print(f"wrote {DEST}: {len(buildings)} buildings, {len(routes)} routes, {len(grounds)} grounds, {len(pois)} POIs")
