import { hexToRgb } from "./hexColor";
import { type UniformSpec, type ControlInfo, isControlledUniformTypeLiteral } from "./uniformSpec";

export function parseUserUniforms(glsl: string) {
    const result: Array<UniformSpec> = [];

    const glslStripped = glsl.replace(/\/\*.*?\*\//gs, "");

    for (const line of glslStripped.split("\n")) {
        const match = line.match(/^\s*uniform\s*(bool|float|int|uint|vec3)\s*(\w*)\s*;\s*(?:\/\/\s*(.*))?/);
        if (match === null) continue;

        const varType = match[1];
        const varName = match[2];

        if (!isControlledUniformTypeLiteral(varType)) continue;

        const controlComment = match[3];

        let controlInfo: ControlInfo | undefined = undefined;

        if (controlComment === undefined) {
            if (varType === "bool") {
                controlInfo = {
                    control: "checkbox",
                    defaultValue: true
                };
            } else if (varType === "float") {
                controlInfo = {
                    control: "number",
                    defaultValue: 0
                };
            } else if (varType === "vec3") {
                controlInfo = {
                    control: "color",
                    defaultValue: [0, 0, 0]
                };
            }
        } else {
            const args = controlComment.split(/\s+/);

            if (varType === "bool") {
                // bools get checkboxes
                let defaultValue = true;
                for (const arg of args) {
                    if (arg.startsWith("default=")) {
                        defaultValue = !arg.slice("default=".length).match(/(false|no|0)/i);
                    }
                }
                controlInfo = {
                    control: "checkbox",
                    defaultValue: defaultValue
                };

            } else if (varType === "vec3") {
                let defaultValue: [number, number, number] = [0, 0, 0];
                for (const arg of args) {
                    if (arg.startsWith("default=")) {
                        defaultValue = hexToRgb(arg.slice("max=".length));
                    }
                }
                controlInfo = {
                    control: "color",
                    defaultValue: defaultValue
                };

            } else if (args[0] === "options" && args.length > 1 && (varType === "int" || varType === "uint")) {
                // "options <option1> <option2> ..."
                controlInfo = {
                    control: "select",
                    options: args.slice(1),
                    defaultValue: 0
                };

            } else if (varType === "float") {
                let control = "number";
                let logarithmic = false;
                let min = undefined;
                let max = undefined;
                let defaultValue = undefined;

                for (const arg of args) {
                    if ((arg === "range" || arg === "logrange") && varType === "float") {
                        control = "range";
                        logarithmic = (arg === "logrange");
                    }
                    else if (arg.startsWith("min=")) {
                        min = Number.parseFloat(arg.slice("min=".length));
                    }
                    else if (arg.startsWith("max=")) {
                        max = Number.parseFloat(arg.slice("max=".length));
                    }
                    else if (arg.startsWith("default=")) {
                        defaultValue = Number.parseFloat(arg.slice("default=".length));
                    }
                }

                if (min === undefined || max === undefined) {
                    // Can't do range, revert to number control if needed
                    control = "number";
                }

                if (defaultValue === undefined) {
                    if (control === "range") {
                        // min and max are guaranteed defined here
                        if (logarithmic) {
                            defaultValue = Math.sqrt(min! * max!);
                        } else {
                            defaultValue = (min! + max!) / 2;
                        }
                    } else {
                        defaultValue = 0;
                    }
                }

                if (control === "range") {
                    controlInfo = {
                        control: control,
                        min: min!,
                        max: max!,
                        logarithmic: logarithmic,
                        defaultValue: defaultValue
                    };
                } else if (control === "number") {
                    controlInfo = {
                        control: control,
                        defaultValue: defaultValue
                    };
                }
            }
        }

        if (controlInfo !== undefined) {
            result.push({
                ...{
                    name: varName,
                    type: varType
                },
                ...controlInfo
            });
        }
    }
    return result;
}
