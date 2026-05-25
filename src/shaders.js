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
