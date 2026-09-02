# Current limitations

## Rendering

- The polyfill uses SVG `foreignObject` and texture uploads, so large DOM trees and frequent repainting can be expensive.
- CSS, web fonts, form controls, and text selection can differ across browsers and operating systems.
- Cross-origin media without CORS, iframes, DRM, and protected content cannot be captured completely.
- Video decoding and playback remain the responsibility of the HTML Media API.

## Geometry and UVs

- Interactive surfaces need raycast UVs.
- Overlapping UVs cannot be mapped uniquely back to one DOM position.
- Alternate UV channels are not selectable per surface.
- Highly distorted triangles, `SkinnedMesh`, and `InstancedMesh` are not guaranteed.
- Multi-material meshes support `materialIndex`; complex geometry-group layouts need application testing.

## Input and accessibility

- The live DOM is parked off-screen and temporarily aligned for browser hit testing; it is not CSS-transformed into 3D.
- Keyboard and IME behavior use the real DOM, but candidate-window placement and rendering are not guaranteed across every OS and IME.
- Accessibility-tree order can differ from the visual 3D layout.
- Simultaneous multi-touch and complex text selection are limited.
- There is no WebXR controller or hand-input adapter.

## Performance

- Pointer routing recursively raycasts `scene.children` by default. Use non-overlapping `raycastRoots` to limit work in large scenes; every participating surface and occluder must be below a configured root.
- DOM mutations and `input`, `change`, `scroll`, and `compositionend` invalidate automatically. Continuous DOM animation can make paint and upload the bottleneck; manual `invalidate()` is still available for non-observable paint changes.
- Texture resolution follows the element's pixel dimensions. Balance DOM size against display size and image quality.

## API and compatibility

- Supported Three.js range: `>=0.184.0 <0.186.0`.
- The backend SPI under `html-surface-three/experimental` is outside the stable semver contract.
- Native HTML-in-Canvas remains experimental and outside the stable browser tier.
- React Three Fiber and WebXR adapters are deferred; the framework-independent core remains usable directly.
