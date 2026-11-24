export function hexToRgb(hex: string) {
    hex = hex.replace("#", "");
    return [hex.slice(0, 2), hex.slice(2, 4), hex.slice(4, 6)].map(
        x => Math.pow(parseInt(x, 16) / 255, 2.2)
    ) as [number, number, number];
}

export function rgbToHex(rgb: [number, number, number]) {
    return "#" + rgb.map((x) => {
        let result = Math.round(Math.pow(x, 1/2.2) * 255).toString(16);
        if (result.length < 2) result = "0" + result;
        return result;
    }).join("");
}
