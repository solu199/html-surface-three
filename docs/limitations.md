# 現時点の制約

## 描画

- polyfill BackendはSVG `foreignObject`とTexture uploadを使うため、大きいDOMや高頻度更新ではpaintコストが増えます。
- CSS、web font、form control、text selectionの外観はブラウザとOSで差が出ます。
- CORSを許可しない画像／動画、iframe、DRMや保護コンテンツは完全にTexture化できません。
- 動画decoderやmedia playerは提供しません。再生制御は既存のHTML Media APIへ委ねます。

## GeometryとUV

- 入力可能なSurfaceにはRaycastで取得できるUVが必要です。
- UVが重複するMeshは、一つの交差UVだけでは元のDOM位置を一意に特定できません。
- Surfaceごとの別UV channelはまだ選択できません。
- 極端に歪んだ三角形、SkinnedMesh、InstancedMeshはRC1の保証対象外です。
- 複数Materialは`materialIndex`で扱えますが、Geometry groupの複雑な構成は個別確認が必要です。

## 入力とアクセシビリティ

- 実DOMを画面外へparkし、交差点へ一時整列してbrowser hit testingを利用します。DOM全体をCSS 3D変形しているわけではありません。
- keyboardとIMEは実DOMへ委譲しますが、全OS・全IMEの候補UI位置や描画一致までは保証しません。
- DOMアクセシビリティツリーの順序と3D空間の視覚位置は一致しない場合があります。
- 複数同時touchと複雑なtext selectionは限定的です。
- WebXR controller／hand入力はまだ公開Adapterがありません。

## 性能

- 既定の遮蔽判定はscene全体へのrecursive Raycastです。Surfaceやobjectが多いsceneではlayer、対象root、BVHなどの最適化が必要です。
- DOM mutationのたびにinvalidateされるため、連続animationをDOM側で行うとpaint／uploadがボトルネックになります。
- Texture解像度はHTMLElementのpixel sizeに依存します。表示サイズと画質に応じてDOM寸法を調整してください。

## APIと互換性

- 対応Three.js範囲は`>=0.184.0 <0.186.0`です。r185で開発・検証しています。
- `html-surface-three/experimental`のBackend SPIはsemver互換性保証外です。
- native HTML-in-Canvasは実験扱いで、stable Tierには含みません。
- React Three FiberとWebXR向けの統合層は将来機能です。Vanilla coreからは利用できますが専用Adapterはありません。
- `0.1.0-rc.1`はnpmレジストリ未公開です。
