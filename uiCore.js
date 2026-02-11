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
    if (value !== undefined) {
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

export function createSelectorControl(choices, values, initialValue) {
    const selector = document.createElement("select");
    choices = choices.slice(0);
    for (const [choiceIndex, choice] of choices.entries()) {
        const option = document.createElement("option");
        if (values !== undefined) {
            option.setAttribute("value", values[choiceIndex]);    
        } else { 
            // use index as value
            option.setAttribute("value", choiceIndex);
        }
        option.appendChild(document.createTextNode(choice));
        selector.appendChild(option);
    }

    if (initialValue !== undefined) selector.value = initialValue;

    return {
        element: selector,
        getValue: () => selector.value
    };
}

export function createColorControl() {
    const input = document.createElement("input");
    input.setAttribute("type", "color");

    return {
        element: input,
        getValue: () => {
            const hex = input.value;
            return [hex.slice(1, 2), hex.slice(3, 4), hex.slice(5, 6)].map((x) => parseInt(x, 16) / 255);
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
