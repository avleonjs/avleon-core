import {

formatUrl,
parsedPath,
findDuplicates,
getDataType,
isValidType,
isValidJsonString,
jsonToJs,
normalizePath,
extrctParamFromUrl,
pick,
exclude,
} from "./helpers";

describe("helpers.ts", () => {
describe("formatUrl", () => {
    it("should format URLs correctly", () => {
        expect(formatUrl("test")).toBe("/test");
        expect(formatUrl("/test")).toBe("/test");
        expect(formatUrl("///test//")).toBe("/test");
        expect(() => formatUrl(123 as any)).toThrow();
    });
});

describe("parsedPath", () => {
    it("should ensure path starts with /", () => {
        expect(parsedPath("abc")).toBe("/abc");
        expect(parsedPath("/abc")).toBe("/abc");
    });
});

describe("findDuplicates", () => {
    it("should find duplicates in array", () => {
        expect(findDuplicates(["a", "b", "a", "c", "b"])).toEqual(["a", "b"]);
        expect(findDuplicates(["a", "b", "c"])).toEqual([]);
    });
});

describe("getDataType", () => {
    it("should return correct data type", () => {
        expect(getDataType(String)).toBe("string");
        expect(getDataType(Number)).toBe("number");
        expect(getDataType(Boolean)).toBe("boolean");
        expect(getDataType(Object)).toBe("object");
        expect(getDataType(Array)).toBe(Array);
    });
});

describe("isValidType", () => {
    it("should validate types correctly", () => {
        expect(isValidType("abc", String)).toBe(true);
        expect(isValidType(123, Number)).toBe(true);
        expect(isValidType(true, Boolean)).toBe(true);
        expect(isValidType({}, Object)).toBe(true);
        expect(isValidType(undefined, String)).toBe(true);
        expect(isValidType(null, Number)).toBe(true);
        expect(isValidType("123", Number)).toBe(true);
        expect(isValidType("abc", Number)).toBe(false);
    });
});

describe("isValidJsonString", () => {
    it("should validate JSON strings", () => {
        expect(isValidJsonString('{"a":1}')).toEqual({ a: 1 });
        expect(isValidJsonString("not json")).toBe(false);
    });
});

describe("jsonToJs", () => {
    it("should parse JSON to JS object", () => {
        expect(jsonToJs('{"a":1}')).toEqual({ a: 1 });
        expect(jsonToJs("bad json")).toBe(false);
    });
});

// describe("normalizePath", () => {
//     it("should normalize paths", () => {
//         expect(normalizePath("api", "v1")).toBe("/api/v1");
//         expect(normalizePath("/", "/")).toBe("/");
//         expect(normalizePath("api/", "/v1/")).toBe("/api/v1");
//     });
// });

describe("extrctParamFromUrl", () => {
    it("should extract params from URL", () => {
        expect(extrctParamFromUrl("/user/:id/:name")).toEqual([
            { key: "id", required: true },
            { key: "name", required: true },
        ]);
        expect(extrctParamFromUrl("/user/?:id")).toEqual([
            { key: "id", required: false },
        ]);
    });
});

describe("pick", () => {
    it("should pick properties from object", () => {
        const obj = { a: 1, b: { c: 2, d: 3 }, e: 4 };
        expect(pick(obj, ["a"])).toEqual({ a: 1 });
        expect(pick(obj, ["b.c"])).toEqual({ b: { c: 2 } });
        expect(pick(obj, ["b.d", "e"])).toEqual({ b: { d: 3 }, e: 4 });
    });
});

describe("exclude", () => {
    it("should exclude properties from object", () => {
        const obj = { a: 1, b: { c: 2, d: 3 }, e: 4 };
        expect(exclude(obj, ["a"])).toEqual({ b: { c: 2, d: 3 }, e: 4 });
        expect(exclude(obj, ["b.c"])).toEqual({ a: 1, b: { d: 3 }, e: 4 });
        expect(exclude([obj, obj], ["e"])).toEqual([
            { a: 1, b: { c: 2, d: 3 } },
            { a: 1, b: { c: 2, d: 3 } },
        ]);
    });
});
});