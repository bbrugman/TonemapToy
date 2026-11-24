vec3 tonemap(vec3 rgb) {
    return rgb;
}

/*
For the shader to compile, you must provide a function called "tonemap", 
taking linear Rec. 709 input (already scaled by exposure) as a vec3 
and returning linear Rec. 709 output as a vec3.

Any uniform you specify will receive its own UI control, labeled by 
the uniform name. Comments immediately after the uniform definition 
may be used to customize the control, depending on the type.

For ints or uints,
// options <option1> [option2] [...]
creates a selector, where the n-th option yields value n-1.
The first option will be selected by default.
For each option, a macro will be created with the
corresponding value as the token. The identifier is the result of
taking the uniform name and option name, stripping illegal 
characters, uppercasing both, and concatenating with an underscore.
(E.g. UNIFORMNAME_OPTION1 = 0, UNIFORMNAME_OPTION2 = 1, ...)

For floats, 
// range min=<min> max=<max>
or
// logrange min=<min> max=<max>
creates a range input with the indicated bounds.

To specify a default value (except for selectors),
specify the "default=" option, e.g.
// range min=0.0 max=10.0 default=3.14

Booleans get a checkbox and are true by default, but
// default=0
// default=false
// default=no
all change the default value to false.

vec3 uniforms get a color control, the default value of which
can be specified with a hex color:
// default=#1234ab
*/
