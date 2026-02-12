// controls (concept bundling an element and a value getter)

export function createCheckboxControl(checked = false) {
    const input = document.createElement("input");
    input.setAttribute("type", "checkbox");
    input.checked = checked;

    return {
        element: input,
        getValue: () => (input.checked ? 1 : 0)
    };
}

export function createLabeledCheckboxControl(labelText, checked = false) {
    const control = createCheckboxControl(checked);
    return {
        element: divWrap(control.element, createLabel(labelText, control.element)),
        getValue: control.getValue
    }
}

export function createNumericControl(value = "0") {
    const input = document.createElement("input");
    input.setAttribute("type", "number");
    input.value = value;

    return {
        element: input,
        getValue: () => parseFloat(input.value)
    }
}

export function createRangeControl(min, max, value, logarithmic = false) {
    const input = document.createElement("input");
    input.setAttribute("type", "range");
    input.setAttribute("step", "any");
    input.setAttribute("min", logarithmic ? Math.log(min) : min);
    input.setAttribute("max", logarithmic ? Math.log(max) : max);
    if (value !== undefined && value >= min && value <= max) {
        input.value = logarithmic ? Math.log(value) : value;
    } else {
        input.value = logarithmic ?
            Math.sqrt(Math.log(max) * Math.log(min)) :
            (max + min) / 2;
    }

    let getValue;
    if (logarithmic) {
        getValue = () => Math.exp(parseFloat(input.value));
    } else {
        getValue = () => parseFloat(input.value);
    }

    return {
        element: input,
        logarithmic: logarithmic,
        getValue: getValue
    };
}

export function createLinkedNumericControl(rangeControl) {
    const numInput = document.createElement("input");
    numInput.setAttribute("type", "number");

    const rangeInput = rangeControl.element;
    numInput.value = rangeControl.getValue();

    rangeInput.addEventListener("change", (e) => {
        numInput.value = rangeControl.getValue();
    });
        
    numInput.addEventListener("change", (e) => {
        rangeInput.value = rangeControl.logarithmic ? Math.log(numInput.value) : numInput.value;
    });

    return {
        element: numInput,
        getValue: rangeControl.getValue
    };
}

export function createSelectorControl(options, values, value) {
    const selector = document.createElement("select");
    options = options.slice(0);
    for (const [optionIndex, option] of options.entries()) {
        const optionEl = document.createElement("option");
        if (values !== undefined) {
            optionEl.setAttribute("value", values[optionIndex]);    
        } else { 
            // use index as value
            optionEl.setAttribute("value", optionIndex);
        }
        optionEl.appendChild(document.createTextNode(option));
        selector.appendChild(optionEl);
    }

    if (value !== undefined) selector.value = value;

    return {
        element: selector,
        getValue: () => selector.value
    };
}

function hexToRgb(hex) {
    return [hex.slice(1, 3), hex.slice(3, 5), hex.slice(5, 7)].map(
        x => Math.pow(parseInt(x, 16) / 255, 2.2)
    );
}

export function createColorControl(hex) {
    const input = document.createElement("input");
    input.setAttribute("type", "color");

    if (hex !== undefined) input.setAttribute("value", hex);

    return {
        element: input,
        getValue: () => {
            const hex = input.value;
            return hexToRgb(hex);
        }
    }
}

export function labelControl(labelText, control) {
    return {
        element: labelDiv(labelText, control.element),
        getValue: control.getValue
    }
}

// other elements

let idCount = 0;
export function uniqueID() {
    const result = `unique-id-${idCount}`;
    idCount++;
    return result;
}

export function createLabel(labelText, forElement) {
    const label = document.createElement("label");
    label.appendChild(document.createTextNode(labelText));
    
    if (forElement.getAttribute("id")) {
        label.setAttribute("for", forElement.getAttribute("id"));
    } else {
        const id = uniqueID();
        forElement.setAttribute("id", id);
        label.setAttribute("for", id);
    }

    return label;
}

export function createButton(buttonText) {
    const button = document.createElement("button");
    button.appendChild(document.createTextNode(buttonText));

    return button;
}

export function divWrap() {
    const div = document.createElement("div");
    for(const el of arguments) {
        div.appendChild(el);
    }
    return div;
}

export function labelDiv(labelText, element) {
    return divWrap(
        createLabel(labelText, element),
        element
    );
}
