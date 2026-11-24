uniform float Hable_A; // logrange min=0.01 max=2.0 default=0.15
uniform float Hable_B; // logrange min=0.01 max=2.0 default=0.50
uniform float Hable_C; // logrange min=0.01 max=2.0 default=0.10
uniform float Hable_D; // logrange min=0.01 max=2.0 default=0.20
uniform float Hable_E; // logrange min=0.001 max=2.0 default=0.02
uniform float Hable_F; // logrange min=0.01 max=2.0 default=0.30
uniform float WhitePoint; // logrange min=1.0 max=1000.0 default=32.0

float hableCurve(float x) {
    // Adapted from http://filmicworlds.com/blog/filmic-tonemapping-operators/
    float A = Hable_A;
    float B = Hable_B;
    float C = Hable_C;
    float D = Hable_D;
    float E = Hable_E;
    float F = Hable_F;
    
    x *= 2.0;
    return min(1.0, ((x*(A*x+C*B)+D*E)/(x*(A*x+B)+D*F))-E/F);
}

float toneCurve(float t) {
    return hableCurve(max(t, 0.)) / hableCurve(WhitePoint);
}
