# ActionNet host bridge

Additive integration for embedding the SuperSplat editor inside the
ActionNet-AI app. Nothing in the upstream PlayCanvas-SuperSplat source is
forked beyond a four-line addition to `src/iframe-api.ts` that activates the
bridge when the URL contains `?host=actionnet`.

## Protocol

Namespace: `supersplat:actionnet`

Host → editor commands:

| `cmd`        | payload                                                          | effect                                                    |
|--------------|------------------------------------------------------------------|-----------------------------------------------------------|
| `load`       | `{ url, filename?, sceneId? }`                                   | Load splat from a (signed) URL                            |
| `save`       | `{ format: 'ply'\|'compressed_ply'\|'sog'\|'splat' }`            | Serialize current scene, reply with `save-result`         |
| `set-camera` | `{ position, target, fov? }`                                     | Snap camera to a pose                                     |
| `headless`   | `{ ops: ProcessAction[] }`                                       | Apply a splat-transform-style op list with undo/redo      |
| `set-theme`  | `{ theme: 'light' \| 'dark' }`                                   | Match host theme                                          |
| `set-locale` | `{ lng: string }`                                                | i18n language                                             |
| `ping`       | -                                                                | Healthcheck; replies with `pong`                          |

Editor → host events:

| `evt`           | payload                                              |
|-----------------|------------------------------------------------------|
| `ready`         | -                                                    |
| `scene-loaded`  | `{ name, splatCount? }`                              |
| `dirty-changed` | `{ dirty }`                                          |
| `save-result`   | `{ format, bytesBase64, byteSize }`                  |
| `progress`      | `{ stage, percent, message? }`                       |
| `error`         | `{ code, message }`                                  |
| `pong`          | -                                                    |

## Lifecycle

1. Host opens the editor URL with `?host=actionnet&token=…&sceneId=…`.
2. `src/iframe-api.ts` detects the host flag and calls
   `installActionNetHostBridge(events)` from `src/actionnet/host-bridge.ts`.
3. The bridge posts `ready` to the parent window.
4. The host responds with `load { url }` carrying a signed Supabase URL.
5. The user edits. On `save`, the bridge serializes via the existing
   `scene.export` event and replies with `save-result`; the host writes the
   bytes back into Supabase via a signed PUT.

See `src/actionnet/protocol.ts` for the canonical type definitions consumed
by both sides.
