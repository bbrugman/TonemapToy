export type ControlInfo = {
    control: "checkbox",
    defaultValue: boolean
} | {
    control: "number",
    defaultValue: number
} | {
    control: "range"
    min: number,
    max: number,
    logarithmic?: boolean
    defaultValue: number,
} | {
    control: "select",
    options: Array<string>,
    defaultValue: number
} | {
    control: "color",
    defaultValue: [number, number, number]
};

const CONTROLLED_UNIFORM_TYPES = ["bool", "float", "int", "uint", "vec3"] as const;
export type ControllableUniformType = typeof CONTROLLED_UNIFORM_TYPES[number];

export function isControlledUniformTypeLiteral(literal: string): literal is ControllableUniformType {
    return (CONTROLLED_UNIFORM_TYPES as readonly string[]).includes(literal);
}

export type UniformSpec = { 
    name: string;
    type: ControllableUniformType;
    label?: string
} & ControlInfo;

export type ControllableUniformValue = boolean | number | [number, number, number];
