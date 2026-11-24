uniform float PiecewiseCompressStart; // range min=0.0 max=1.0 default=0.5
uniform float PiecewiseCompressContrast; // logrange min=0.1 max=10.0 default=1.0
uniform float PiecewiseGammaAdjust; // logrange min=0.2 max=5.0 default=1.2

float toneCurve(float t) {
    /*
        Linear followed by highlight compression, 
        into a power for shadow contrast.
    */
    t = max(t, 0.);
    float y = t;
    if (t > PiecewiseCompressStart) {
        float h = 1.0 - PiecewiseCompressStart;
        float modT = (t - PiecewiseCompressStart) / h;
        y = PiecewiseCompressStart + h * (
            1.0 - pow(1.0 + modT / PiecewiseCompressContrast, -PiecewiseCompressContrast)
        );
    }
    y = pow(y, PiecewiseGammaAdjust);
    return y;
}
