import * as uiC from './uiCore.js';

export const ControlType = {
    CHECKBOX: "CHECKBOX",
    NUMBER: "NUMBER",
    RANGE: "RANGE",
    SELECT: "SELECT",
    COLOR: "COLOR"
};

/**
Create a control from a control spec.
spec should have properties as follows:

type: ControlType,
label: string,
value: initial value,
(RANGE) min: minimum allowed value,
(RANGE) max: maximum allowed value,
(RANGE) logarithmic: boolean, use logarithmic slider,
(SELECT) options: array of option labels.

Returns the control.
*/
export function createControl(spec) {
    
    switch (spec.type) {
        case ControlType.CHECKBOX:
            return uiC.createLabeledCheckboxControl(spec.label, spec.value);

        case ControlType.NUMBER:
            return uiC.labelControl(spec.label, uiC.createNumericControl(spec.value));

        case ControlType.RANGE:
            {
                const control = uiC.createRangeControl(spec.min, spec.max, spec.value, spec.logarithmic);
                const labeled = uiC.labelControl(spec.label, control);
                labeled.element.appendChild(uiC.createLinkedNumericControl(control).element);
                return labeled;
            }
        case ControlType.SELECT:
            {
                const control = uiC.createSelectorControl(spec.options, undefined, spec.value);
                return uiC.labelControl(spec.label, control);
            }
        case ControlType.COLOR:
            {
                return uiC.labelControl(spec.label, uiC.createColorControl(spec.value));
            }
    }
}

export function isValueValid(spec) {
    if (spec.type === ControlType.RANGE && (spec.min > spec.value || spec.max < spec.value)) return false;
    return true;
}

function rgbToHex(rgb) {
    function hexify(value) {
        let result = Math.round(Math.pow(value, 1/2.2) * 255).toString(16);
        if (result.length === 1) return "0" + result;
        return result;
    }
    return "#" + rgb.map(hexify).join("");
}

export function outToIn(type, value) {
    switch (type) {
        case ControlType.COLOR:
            return rgbToHex(value);
        default:
            return value;
    }
}
