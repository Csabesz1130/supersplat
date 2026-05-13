// Shared message types for the ActionNet host bridge.
//
// The host (actionnet-ai's SplatEditor.tsx) and the iframe (this editor)
// agree on the shapes below. We keep them in their own file so both sides
// can import them through `@playcanvas/supersplat/actionnet` once the
// build exposes that path — today the host imports a hand-mirrored copy in
// actionnet-ai/src/lib/splat/editorProtocol.ts.

export const NS = 'supersplat:actionnet';

// -- Inbound (host -> editor) -----------------------------------------------

export type HostMessage =
    | { ns: typeof NS; cmd: 'load'; url: string; filename?: string; sceneId?: string }
    | { ns: typeof NS; cmd: 'save'; format: 'ply' | 'compressed_ply' | 'sog' | 'splat' }
    | { ns: typeof NS; cmd: 'set-camera'; position: [number, number, number]; target: [number, number, number]; fov?: number }
    | { ns: typeof NS; cmd: 'headless'; ops: ProcessAction[] }
    | { ns: typeof NS; cmd: 'set-theme'; theme: 'light' | 'dark' }
    | { ns: typeof NS; cmd: 'set-locale'; lng: string }
    | { ns: typeof NS; cmd: 'ping' };

// -- Outbound (editor -> host) ----------------------------------------------

export type EditorEvent =
    | { ns: typeof NS; evt: 'ready' }
    | { ns: typeof NS; evt: 'scene-loaded'; name: string; splatCount?: number }
    | { ns: typeof NS; evt: 'dirty-changed'; dirty: boolean }
    | { ns: typeof NS; evt: 'save-result'; format: string; bytesBase64: string; byteSize: number }
    | { ns: typeof NS; evt: 'progress'; stage: string; percent: number; message?: string }
    | { ns: typeof NS; evt: 'error'; code: string; message: string }
    | { ns: typeof NS; evt: 'pong' };

// Mirrors splat-transform's ProcessAction; kept minimal here — the editor
// passes the full list straight through to splat-transform internally.
export type ProcessAction =
    | { kind: 'translate'; value: [number, number, number] }
    | { kind: 'rotate'; value: [number, number, number] }
    | { kind: 'scale'; value: number }
    | { kind: 'filterNaN' }
    | { kind: 'filterFloaters' }
    | { kind: 'filterCluster' }
    | { kind: 'filterBox'; min: [number, number, number]; max: [number, number, number] }
    | { kind: 'filterSphere'; center: [number, number, number]; radius: number }
    | { kind: 'filterBands'; value: 0 | 1 | 2 | 3 }
    | { kind: 'decimate'; count?: number; percent?: number }
    | { kind: 'mortonOrder' };

export function isHostMessage(v: unknown): v is HostMessage {
    return !!v && typeof v === 'object' && (v as { ns?: string }).ns === NS && typeof (v as { cmd?: string }).cmd === 'string';
}
