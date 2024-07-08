/* eslint-disable */
// To parse this data:
//
//   import { Convert, GeoJSONFeature, GeoJSONFeatureCollection, GeoJSONGeometry, GeoJSONGeometryCollection, GeoJSONLineString, GeoJSONMultiLineString, GeoJSONMultiPoint, GeoJSONMultiPolygon, GeoJSONPoint, GeoJSONPolygon, TestUserInfo, TileJSON } from "./file";
//
//   const geoJSONFeature = Convert.toGeoJSONFeature(json);
//   const geoJSONFeatureCollection = Convert.toGeoJSONFeatureCollection(json);
//   const geoJSONGeometry = Convert.toGeoJSONGeometry(json);
//   const geoJSONGeometryCollection = Convert.toGeoJSONGeometryCollection(json);
//   const geoJSONLineString = Convert.toGeoJSONLineString(json);
//   const geoJSONMultiLineString = Convert.toGeoJSONMultiLineString(json);
//   const geoJSONMultiPoint = Convert.toGeoJSONMultiPoint(json);
//   const geoJSONMultiPolygon = Convert.toGeoJSONMultiPolygon(json);
//   const geoJSONPoint = Convert.toGeoJSONPoint(json);
//   const geoJSONPolygon = Convert.toGeoJSONPolygon(json);
//   const testUserInfo = Convert.toTestUserInfo(json);
//   const tileJSON = Convert.toTileJSON(json);
//
// These functions will throw an error if the JSON doesn't
// match the expected interface, even if the JSON is valid.

export type GeoJSONFeature = {
    bbox?:      number[];
    geometry:   null | GeoJSONFeatureGeoJSONPoint;
    id?:        number | string;
    properties: { [key: string]: any } | null;
    type:       GeoJSONFeatureType;
    [property: string]: any;
}

export type GeoJSONFeatureGeoJSONPoint = {
    bbox?:        number[];
    coordinates?: Array<Array<Array<number[] | number> | number> | number>;
    type:         PurpleType;
    geometries?:  PurpleGeoJSON[];
    [property: string]: any;
}

export type PurpleGeoJSON = {
    bbox?:       number[];
    coordinates: Array<Array<Array<number[] | number> | number> | number>;
    type:        GeometryType;
    [property: string]: any;
}

export type GeometryType = "Point" | "LineString" | "Polygon" | "MultiPoint" | "MultiLineString" | "MultiPolygon";

export type PurpleType = "Point" | "LineString" | "Polygon" | "MultiPoint" | "MultiLineString" | "MultiPolygon" | "GeometryCollection";

export type GeoJSONFeatureType = "Feature";

export type GeoJSONFeatureCollection = {
    bbox?:    number[];
    features: FeatureElement[];
    type:     GeoJSONFeatureCollectionType;
    [property: string]: any;
}

export type FeatureElement = {
    bbox?:      number[];
    geometry:   null | FeatureGeoJSONPoint;
    id?:        number | string;
    properties: { [key: string]: any } | null;
    type:       GeoJSONFeatureType;
    [property: string]: any;
}

export type FeatureGeoJSONPoint = {
    bbox?:        number[];
    coordinates?: Array<Array<Array<number[] | number> | number> | number>;
    type:         PurpleType;
    geometries?:  FluffyGeoJSON[];
    [property: string]: any;
}

export type FluffyGeoJSON = {
    bbox?:       number[];
    coordinates: Array<Array<Array<number[] | number> | number> | number>;
    type:        GeometryType;
    [property: string]: any;
}

export type GeoJSONFeatureCollectionType = "FeatureCollection";

export type GeoJSONGeometry = {
    bbox?:       number[];
    coordinates: Array<Array<Array<number[] | number> | number> | number>;
    type:        GeometryType;
    [property: string]: any;
}

export type GeoJSONGeometryCollection = {
    bbox?:      number[];
    geometries: TentacledGeoJSON[];
    type:       FluffyType;
    [property: string]: any;
}

export type TentacledGeoJSON = {
    bbox?:       number[];
    coordinates: Array<Array<Array<number[] | number> | number> | number>;
    type:        GeometryType;
    [property: string]: any;
}

export type FluffyType = "GeometryCollection";

export type GeoJSONLineString = {
    bbox?:       number[];
    coordinates: Array<number[]>;
    type:        TentacledType;
    [property: string]: any;
}

export type TentacledType = "LineString";

export type GeoJSONMultiLineString = {
    bbox?:       number[];
    coordinates: Array<Array<number[]>>;
    type:        StickyType;
    [property: string]: any;
}

export type StickyType = "MultiLineString";

export type GeoJSONMultiPoint = {
    bbox?:       number[];
    coordinates: Array<number[]>;
    type:        IndigoType;
    [property: string]: any;
}

export type IndigoType = "MultiPoint";

export type GeoJSONMultiPolygon = {
    bbox?:       number[];
    coordinates: Array<Array<Array<number[]>>>;
    type:        IndecentType;
    [property: string]: any;
}

export type IndecentType = "MultiPolygon";

export type GeoJSONPoint = {
    bbox?:       number[];
    coordinates: number[];
    type:        HilariousType;
    [property: string]: any;
}

export type HilariousType = "Point";

export type GeoJSONPolygon = {
    bbox?:       number[];
    coordinates: Array<Array<number[]>>;
    type:        AmbitiousType;
    [property: string]: any;
}

export type AmbitiousType = "Polygon";

export type TestUserInfo = {
    email: string;
    name:  string;
    [property: string]: any;
}

export type TileJSON = {
    attribution?:  string;
    bounds?:       number[];
    center?:       number[];
    data?:         string[];
    description?:  string;
    fillzoom?:     number;
    grids?:        string[];
    legend?:       string;
    maxzoom?:      number;
    minzoom?:      number;
    name?:         string;
    scheme?:       string;
    template?:     string;
    tilejson:      string;
    tiles:         string[];
    vector_layers: VectorLayer[];
    version?:      string;
    [property: string]: any;
}

export type VectorLayer = {
    description?: string;
    fields:       { [key: string]: string };
    id:           string;
    maxzoom?:     number;
    minzoom?:     number;
    [property: string]: any;
}

// Converts JSON strings to/from your types
// and asserts the results of JSON.parse at runtime
export class Convert {
    public static toGeoJSONFeature(json: string): GeoJSONFeature {
        return cast(JSON.parse(json), r("GeoJSONFeature"));
    }

    public static geoJSONFeatureToJson(value: GeoJSONFeature): string {
        return JSON.stringify(uncast(value, r("GeoJSONFeature")), null, 2);
    }

    public static toGeoJSONFeatureCollection(json: string): GeoJSONFeatureCollection {
        return cast(JSON.parse(json), r("GeoJSONFeatureCollection"));
    }

    public static geoJSONFeatureCollectionToJson(value: GeoJSONFeatureCollection): string {
        return JSON.stringify(uncast(value, r("GeoJSONFeatureCollection")), null, 2);
    }

    public static toGeoJSONGeometry(json: string): GeoJSONGeometry {
        return cast(JSON.parse(json), r("GeoJSONGeometry"));
    }

    public static geoJSONGeometryToJson(value: GeoJSONGeometry): string {
        return JSON.stringify(uncast(value, r("GeoJSONGeometry")), null, 2);
    }

    public static toGeoJSONGeometryCollection(json: string): GeoJSONGeometryCollection {
        return cast(JSON.parse(json), r("GeoJSONGeometryCollection"));
    }

    public static geoJSONGeometryCollectionToJson(value: GeoJSONGeometryCollection): string {
        return JSON.stringify(uncast(value, r("GeoJSONGeometryCollection")), null, 2);
    }

    public static toGeoJSONLineString(json: string): GeoJSONLineString {
        return cast(JSON.parse(json), r("GeoJSONLineString"));
    }

    public static geoJSONLineStringToJson(value: GeoJSONLineString): string {
        return JSON.stringify(uncast(value, r("GeoJSONLineString")), null, 2);
    }

    public static toGeoJSONMultiLineString(json: string): GeoJSONMultiLineString {
        return cast(JSON.parse(json), r("GeoJSONMultiLineString"));
    }

    public static geoJSONMultiLineStringToJson(value: GeoJSONMultiLineString): string {
        return JSON.stringify(uncast(value, r("GeoJSONMultiLineString")), null, 2);
    }

    public static toGeoJSONMultiPoint(json: string): GeoJSONMultiPoint {
        return cast(JSON.parse(json), r("GeoJSONMultiPoint"));
    }

    public static geoJSONMultiPointToJson(value: GeoJSONMultiPoint): string {
        return JSON.stringify(uncast(value, r("GeoJSONMultiPoint")), null, 2);
    }

    public static toGeoJSONMultiPolygon(json: string): GeoJSONMultiPolygon {
        return cast(JSON.parse(json), r("GeoJSONMultiPolygon"));
    }

    public static geoJSONMultiPolygonToJson(value: GeoJSONMultiPolygon): string {
        return JSON.stringify(uncast(value, r("GeoJSONMultiPolygon")), null, 2);
    }

    public static toGeoJSONPoint(json: string): GeoJSONPoint {
        return cast(JSON.parse(json), r("GeoJSONPoint"));
    }

    public static geoJSONPointToJson(value: GeoJSONPoint): string {
        return JSON.stringify(uncast(value, r("GeoJSONPoint")), null, 2);
    }

    public static toGeoJSONPolygon(json: string): GeoJSONPolygon {
        return cast(JSON.parse(json), r("GeoJSONPolygon"));
    }

    public static geoJSONPolygonToJson(value: GeoJSONPolygon): string {
        return JSON.stringify(uncast(value, r("GeoJSONPolygon")), null, 2);
    }

    public static toTestUserInfo(json: string): TestUserInfo {
        return cast(JSON.parse(json), r("TestUserInfo"));
    }

    public static testUserInfoToJson(value: TestUserInfo): string {
        return JSON.stringify(uncast(value, r("TestUserInfo")), null, 2);
    }

    public static toTileJSON(json: string): TileJSON {
        return cast(JSON.parse(json), r("TileJSON"));
    }

    public static tileJSONToJson(value: TileJSON): string {
        return JSON.stringify(uncast(value, r("TileJSON")), null, 2);
    }
}

function invalidValue(typ: any, val: any, key: any, parent: any = ''): never {
    const prettyTyp = prettyTypeName(typ);
    const parentText = parent ? ` on ${parent}` : '';
    const keyText = key ? ` for key "${key}"` : '';
    throw Error(`Invalid value${keyText}${parentText}. Expected ${prettyTyp} but got ${JSON.stringify(val)}`);
}

function prettyTypeName(typ: any): string {
    if (Array.isArray(typ)) {
        if (typ.length === 2 && typ[0] === undefined) {
            return `an optional ${prettyTypeName(typ[1])}`;
        } else {
            return `one of [${typ.map(a => { return prettyTypeName(a); }).join(", ")}]`;
        }
    } else if (typeof typ === "object" && typ.literal !== undefined) {
        return typ.literal;
    } else {
        return typeof typ;
    }
}

function jsonToJSProps(typ: any): any {
    if (typ.jsonToJS === undefined) {
        const map: any = {};
        typ.props.forEach((p: any) => map[p.json] = { key: p.js, typ: p.typ });
        typ.jsonToJS = map;
    }
    return typ.jsonToJS;
}

function jsToJSONProps(typ: any): any {
    if (typ.jsToJSON === undefined) {
        const map: any = {};
        typ.props.forEach((p: any) => map[p.js] = { key: p.json, typ: p.typ });
        typ.jsToJSON = map;
    }
    return typ.jsToJSON;
}

function transform(val: any, typ: any, getProps: any, key: any = '', parent: any = ''): any {
    function transformPrimitive(typ: string, val: any): any {
        if (typeof typ === typeof val) return val;
        return invalidValue(typ, val, key, parent);
    }

    function transformUnion(typs: any[], val: any): any {
        // val must validate against one typ in typs
        const l = typs.length;
        for (let i = 0; i < l; i++) {
            const typ = typs[i];
            try {
                return transform(val, typ, getProps);
            } catch (_) {}
        }
        return invalidValue(typs, val, key, parent);
    }

    function transformEnum(cases: string[], val: any): any {
        if (cases.indexOf(val) !== -1) return val;
        return invalidValue(cases.map(a => { return l(a); }), val, key, parent);
    }

    function transformArray(typ: any, val: any): any {
        // val must be an array with no invalid elements
        if (!Array.isArray(val)) return invalidValue(l("array"), val, key, parent);
        return val.map(el => transform(el, typ, getProps));
    }

    function transformDate(val: any): any {
        if (val === null) {
            return null;
        }
        const d = new Date(val);
        if (isNaN(d.valueOf())) {
            return invalidValue(l("Date"), val, key, parent);
        }
        return d;
    }

    function transformObject(props: { [k: string]: any }, additional: any, val: any): any {
        if (val === null || typeof val !== "object" || Array.isArray(val)) {
            return invalidValue(l(ref || "object"), val, key, parent);
        }
        const result: any = {};
        Object.getOwnPropertyNames(props).forEach(key => {
            const prop = props[key];
            const v = Object.prototype.hasOwnProperty.call(val, key) ? val[key] : undefined;
            result[prop.key] = transform(v, prop.typ, getProps, key, ref);
        });
        Object.getOwnPropertyNames(val).forEach(key => {
            if (!Object.prototype.hasOwnProperty.call(props, key)) {
                result[key] = transform(val[key], additional, getProps, key, ref);
            }
        });
        return result;
    }

    if (typ === "any") return val;
    if (typ === null) {
        if (val === null) return val;
        return invalidValue(typ, val, key, parent);
    }
    if (typ === false) return invalidValue(typ, val, key, parent);
    let ref: any = undefined;
    while (typeof typ === "object" && typ.ref !== undefined) {
        ref = typ.ref;
        typ = typeMap[typ.ref];
    }
    if (Array.isArray(typ)) return transformEnum(typ, val);
    if (typeof typ === "object") {
        return typ.hasOwnProperty("unionMembers") ? transformUnion(typ.unionMembers, val)
            : typ.hasOwnProperty("arrayItems")    ? transformArray(typ.arrayItems, val)
            : typ.hasOwnProperty("props")         ? transformObject(getProps(typ), typ.additional, val)
            : invalidValue(typ, val, key, parent);
    }
    // Numbers can be parsed by Date but shouldn't be.
    if (typ === Date && typeof val !== "number") return transformDate(val);
    return transformPrimitive(typ, val);
}

function cast<T>(val: any, typ: any): T {
    return transform(val, typ, jsonToJSProps);
}

function uncast<T>(val: T, typ: any): any {
    return transform(val, typ, jsToJSONProps);
}

function l(typ: any) {
    return { literal: typ };
}

function a(typ: any) {
    return { arrayItems: typ };
}

function u(...typs: any[]) {
    return { unionMembers: typs };
}

function o(props: any[], additional: any) {
    return { props, additional };
}

function m(additional: any) {
    return { props: [], additional };
}

function r(name: string) {
    return { ref: name };
}

const typeMap: any = {
    "GeoJSONFeature": o([
        { json: "bbox", js: "bbox", typ: u(undefined, a(3.14)) },
        { json: "geometry", js: "geometry", typ: u(null, r("GeoJSONFeatureGeoJSONPoint")) },
        { json: "id", js: "id", typ: u(undefined, u(3.14, "")) },
        { json: "properties", js: "properties", typ: u(m("any"), null) },
        { json: "type", js: "type", typ: r("GeoJSONFeatureType") },
    ], "any"),
    "GeoJSONFeatureGeoJSONPoint": o([
        { json: "bbox", js: "bbox", typ: u(undefined, a(3.14)) },
        { json: "coordinates", js: "coordinates", typ: u(undefined, a(u(a(u(a(u(a(3.14), 3.14)), 3.14)), 3.14))) },
        { json: "type", js: "type", typ: r("PurpleType") },
        { json: "geometries", js: "geometries", typ: u(undefined, a(r("PurpleGeoJSON"))) },
    ], "any"),
    "PurpleGeoJSON": o([
        { json: "bbox", js: "bbox", typ: u(undefined, a(3.14)) },
        { json: "coordinates", js: "coordinates", typ: a(u(a(u(a(u(a(3.14), 3.14)), 3.14)), 3.14)) },
        { json: "type", js: "type", typ: r("GeometryType") },
    ], "any"),
    "GeoJSONFeatureCollection": o([
        { json: "bbox", js: "bbox", typ: u(undefined, a(3.14)) },
        { json: "features", js: "features", typ: a(r("FeatureElement")) },
        { json: "type", js: "type", typ: r("GeoJSONFeatureCollectionType") },
    ], "any"),
    "FeatureElement": o([
        { json: "bbox", js: "bbox", typ: u(undefined, a(3.14)) },
        { json: "geometry", js: "geometry", typ: u(null, r("FeatureGeoJSONPoint")) },
        { json: "id", js: "id", typ: u(undefined, u(3.14, "")) },
        { json: "properties", js: "properties", typ: u(m("any"), null) },
        { json: "type", js: "type", typ: r("GeoJSONFeatureType") },
    ], "any"),
    "FeatureGeoJSONPoint": o([
        { json: "bbox", js: "bbox", typ: u(undefined, a(3.14)) },
        { json: "coordinates", js: "coordinates", typ: u(undefined, a(u(a(u(a(u(a(3.14), 3.14)), 3.14)), 3.14))) },
        { json: "type", js: "type", typ: r("PurpleType") },
        { json: "geometries", js: "geometries", typ: u(undefined, a(r("FluffyGeoJSON"))) },
    ], "any"),
    "FluffyGeoJSON": o([
        { json: "bbox", js: "bbox", typ: u(undefined, a(3.14)) },
        { json: "coordinates", js: "coordinates", typ: a(u(a(u(a(u(a(3.14), 3.14)), 3.14)), 3.14)) },
        { json: "type", js: "type", typ: r("GeometryType") },
    ], "any"),
    "GeoJSONGeometry": o([
        { json: "bbox", js: "bbox", typ: u(undefined, a(3.14)) },
        { json: "coordinates", js: "coordinates", typ: a(u(a(u(a(u(a(3.14), 3.14)), 3.14)), 3.14)) },
        { json: "type", js: "type", typ: r("GeometryType") },
    ], "any"),
    "GeoJSONGeometryCollection": o([
        { json: "bbox", js: "bbox", typ: u(undefined, a(3.14)) },
        { json: "geometries", js: "geometries", typ: a(r("TentacledGeoJSON")) },
        { json: "type", js: "type", typ: r("FluffyType") },
    ], "any"),
    "TentacledGeoJSON": o([
        { json: "bbox", js: "bbox", typ: u(undefined, a(3.14)) },
        { json: "coordinates", js: "coordinates", typ: a(u(a(u(a(u(a(3.14), 3.14)), 3.14)), 3.14)) },
        { json: "type", js: "type", typ: r("GeometryType") },
    ], "any"),
    "GeoJSONLineString": o([
        { json: "bbox", js: "bbox", typ: u(undefined, a(3.14)) },
        { json: "coordinates", js: "coordinates", typ: a(a(3.14)) },
        { json: "type", js: "type", typ: r("TentacledType") },
    ], "any"),
    "GeoJSONMultiLineString": o([
        { json: "bbox", js: "bbox", typ: u(undefined, a(3.14)) },
        { json: "coordinates", js: "coordinates", typ: a(a(a(3.14))) },
        { json: "type", js: "type", typ: r("StickyType") },
    ], "any"),
    "GeoJSONMultiPoint": o([
        { json: "bbox", js: "bbox", typ: u(undefined, a(3.14)) },
        { json: "coordinates", js: "coordinates", typ: a(a(3.14)) },
        { json: "type", js: "type", typ: r("IndigoType") },
    ], "any"),
    "GeoJSONMultiPolygon": o([
        { json: "bbox", js: "bbox", typ: u(undefined, a(3.14)) },
        { json: "coordinates", js: "coordinates", typ: a(a(a(a(3.14)))) },
        { json: "type", js: "type", typ: r("IndecentType") },
    ], "any"),
    "GeoJSONPoint": o([
        { json: "bbox", js: "bbox", typ: u(undefined, a(3.14)) },
        { json: "coordinates", js: "coordinates", typ: a(3.14) },
        { json: "type", js: "type", typ: r("HilariousType") },
    ], "any"),
    "GeoJSONPolygon": o([
        { json: "bbox", js: "bbox", typ: u(undefined, a(3.14)) },
        { json: "coordinates", js: "coordinates", typ: a(a(a(3.14))) },
        { json: "type", js: "type", typ: r("AmbitiousType") },
    ], "any"),
    "TestUserInfo": o([
        { json: "email", js: "email", typ: "" },
        { json: "name", js: "name", typ: "" },
    ], "any"),
    "TileJSON": o([
        { json: "attribution", js: "attribution", typ: u(undefined, "") },
        { json: "bounds", js: "bounds", typ: u(undefined, a(3.14)) },
        { json: "center", js: "center", typ: u(undefined, a(3.14)) },
        { json: "data", js: "data", typ: u(undefined, a("")) },
        { json: "description", js: "description", typ: u(undefined, "") },
        { json: "fillzoom", js: "fillzoom", typ: u(undefined, 0) },
        { json: "grids", js: "grids", typ: u(undefined, a("")) },
        { json: "legend", js: "legend", typ: u(undefined, "") },
        { json: "maxzoom", js: "maxzoom", typ: u(undefined, 0) },
        { json: "minzoom", js: "minzoom", typ: u(undefined, 0) },
        { json: "name", js: "name", typ: u(undefined, "") },
        { json: "scheme", js: "scheme", typ: u(undefined, "") },
        { json: "template", js: "template", typ: u(undefined, "") },
        { json: "tilejson", js: "tilejson", typ: "" },
        { json: "tiles", js: "tiles", typ: a("") },
        { json: "vector_layers", js: "vector_layers", typ: a(r("VectorLayer")) },
        { json: "version", js: "version", typ: u(undefined, "") },
    ], "any"),
    "VectorLayer": o([
        { json: "description", js: "description", typ: u(undefined, "") },
        { json: "fields", js: "fields", typ: m("") },
        { json: "id", js: "id", typ: "" },
        { json: "maxzoom", js: "maxzoom", typ: u(undefined, 0) },
        { json: "minzoom", js: "minzoom", typ: u(undefined, 0) },
    ], "any"),
    "GeometryType": [
        "LineString",
        "MultiLineString",
        "MultiPoint",
        "MultiPolygon",
        "Point",
        "Polygon",
    ],
    "PurpleType": [
        "GeometryCollection",
        "LineString",
        "MultiLineString",
        "MultiPoint",
        "MultiPolygon",
        "Point",
        "Polygon",
    ],
    "GeoJSONFeatureType": [
        "Feature",
    ],
    "GeoJSONFeatureCollectionType": [
        "FeatureCollection",
    ],
    "FluffyType": [
        "GeometryCollection",
    ],
    "TentacledType": [
        "LineString",
    ],
    "StickyType": [
        "MultiLineString",
    ],
    "IndigoType": [
        "MultiPoint",
    ],
    "IndecentType": [
        "MultiPolygon",
    ],
    "HilariousType": [
        "Point",
    ],
    "AmbitiousType": [
        "Polygon",
    ],
};
