let exrs = {
    "Shelf": "Shelf.exr",
    "Ocean Suns": "OceanSuns.exr",
    "Lorem Ipsum": "LoremIpsum.exr"
};

for (const [key, value] of Object.entries(exrs)) {
    exrs[key] = new URL(value, import.meta.url);
}

export default exrs;
