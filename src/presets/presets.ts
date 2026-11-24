const curveFiles = import.meta.glob("./curves/*.glsl", { query: "?raw", import: 'default', eager: true });
const methodFiles = import.meta.glob("./methods/*.glsl", { query: "?raw", import: 'default',eager: true });
const fullPresetFiles = import.meta.glob("./*.glsl", { query: "?raw", import: 'default', eager: true });

function correctKey(files: Record<string, string>) {
    return Object.fromEntries(Object.entries(files).map(
        ([fileName, text]) => [(fileName.match(".*/([^/]+)\.glsl") || [""])[1], text]
    ));
}

export const curvePresets = correctKey(curveFiles);
export const methodPresets = correctKey(methodFiles);
export const fullPresets = correctKey(fullPresetFiles);
