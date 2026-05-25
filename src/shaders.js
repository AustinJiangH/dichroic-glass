export const dichroicVertexShader = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vWorldNormal;
  varying vec3 vViewPosition;

  void main() {
    vNormal = normalize(normalMatrix * normal);
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    vViewPosition = -mvPosition.xyz;
    gl_Position = projectionMatrix * mvPosition;
  }
`;

export const shadowTintVertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const shadowTintFragmentShader = /* glsl */ `
  uniform vec3 uTransmissionColor;
  uniform vec3 uEdgeShiftColor;
  uniform float uIntensity;
  uniform float uSoftness;
  uniform float uFalloff;

  varying vec2 vUv;

  void main() {
    vec2 c = vUv - 0.5;

    // Soft rectangular edge — wider on the long axis, narrow on the cross axis
    float xEdge = 1.0 - smoothstep(0.5 - uSoftness * 0.5, 0.5, abs(c.y));
    float yEdge = 1.0 - smoothstep(0.5 - uSoftness, 0.5, abs(c.x));
    float edge = xEdge * yEdge;

    // Density falloff along shadow direction — opaque near panel base (uv.x=0),
    // fading toward shadow tip (uv.x=1). Mimics the way real shadows lose
    // contrast as they spread away from the occluder.
    float density = 1.0 - smoothstep(0.0, 1.0, vUv.x);
    density = pow(density, uFalloff);

    // Hue gradient: dichroic transmission color near the panel,
    // shifting toward the edge-shift hue as the angle steepens at the tip
    // (analogue of thin-film interference 2*t*cos(theta) wavelength drift).
    vec3 col = mix(uTransmissionColor, uEdgeShiftColor, smoothstep(0.0, 1.0, vUv.x));

    float alpha = edge * density * uIntensity;
    gl_FragColor = vec4(col, alpha);
  }
`;

export const dichroicFragmentShader = /* glsl */ `
  uniform vec3 uReflectionColor;
  uniform vec3 uEdgeColor;
  uniform vec3 uLightDirection;
  uniform float uEdgePower;
  uniform float uBaseAlpha;
  uniform float uEdgeAlpha;

  varying vec3 vNormal;
  varying vec3 vWorldNormal;
  varying vec3 vViewPosition;

  void main() {
    vec3 n = normalize(vNormal);
    vec3 v = normalize(vViewPosition);
    vec3 wn = normalize(vWorldNormal);

    float angleFactor = max(dot(n, v), 0.0);
    float edgeFactor = pow(1.0 - angleFactor, uEdgePower);

    vec3 toLight = -uLightDirection;
    float frontLit = max(dot(wn, toLight), 0.0);
    float backLit  = max(dot(-wn, toLight), 0.0);
    float litness = max(frontLit, backLit * 0.75);

    vec3 litReflection = uReflectionColor * (0.85 + 0.9 * litness);
    vec3 finalColor = mix(litReflection, uEdgeColor, edgeFactor);

    float alpha = mix(uBaseAlpha, uEdgeAlpha, edgeFactor);

    gl_FragColor = vec4(finalColor, alpha);
  }
`;
