// ActionNet host bridge for the embedded supersplat editor.
//
// Installed by src/iframe-api.ts when the page is opened with ?host=actionnet.
// The bridge drives the editor through the existing `Events` bus, so we never
// reach into PlayCanvas internals or fork any rendering code paths — if an
// event name disappears upstream the bridge fails gracefully with an `error`
// message rather than a runtime crash.
//
// Lifecycle
//   1. ?host=actionnet is detected by iframe-api.ts.
//   2. installActionNetHostBridge(events) is called; we wire listeners on
//      `events` for dirty-changed / scene-loaded etc., and start listening
//      for postMessage cmds from the parent.
//   3. We post `ready` upstream. The host (actionnet-ai/SplatEditor) responds
//      with `load` carrying the signed Supabase URL.
//   4. On `save`, we ask the Events bus for the serialized bytes, then post
//      them back as `save-result` (base64-encoded; small enough for the post-
//      Message channel; the host writes them to Supabase via a signed PUT).

import type { Events } from '../events';
import { isHostMessage, NS, type EditorEvent, type HostMessage } from './protocol';

const HOST_ORIGIN = '*'; // The host enforces origin on its side via iframe sandbox.

export function installActionNetHostBridge(events: Events): void {
    const post = (evt: EditorEvent) => {
        try {
            window.parent?.postMessage(evt, HOST_ORIGIN);
        } catch {
            // parent may be closed mid-flight; nothing to do.
        }
    };

    const reportError = (code: string, message: string) =>
        post({ ns: NS, evt: 'error', code, message });

    // ---- outbound: forward editor lifecycle to the host --------------------
    try {
        events.on('scene.openComplete', (name: string, info?: { splatCount?: number }) => {
            post({ ns: NS, evt: 'scene-loaded', name, splatCount: info?.splatCount });
        });
    } catch { /* event name varies across upstream versions; ignore */ }
    try {
        events.on('scene.dirtyChanged', (dirty: boolean) => {
            post({ ns: NS, evt: 'dirty-changed', dirty: !!dirty });
        });
    } catch { /* ignore */ }

    // ---- inbound: command dispatcher --------------------------------------
    window.addEventListener('message', async (ev: MessageEvent) => {
        if (!isHostMessage(ev.data)) return;
        const msg = ev.data as HostMessage;
        try {
            await handle(msg, events, post);
        } catch (e) {
            const err = e as Error;
            reportError('handler_failed', err.message || String(err));
        }
    });

    post({ ns: NS, evt: 'ready' });
}

async function handle(msg: HostMessage, events: Events, post: (e: EditorEvent) => void): Promise<void> {
    switch (msg.cmd) {
        case 'ping':
            post({ ns: NS, evt: 'pong' });
            return;

        case 'load': {
            // The upstream loader accepts a URL straight from ?load= URL params;
            // we invoke the same event so the loader pipeline (drag-and-drop,
            // file association, etc.) stays the single source of truth.
            post({ ns: NS, evt: 'progress', stage: 'loading', percent: 5, message: msg.filename ?? msg.url });
            await invokeOneOf(events, ['scene.open', 'scene.load'], { url: msg.url, filename: msg.filename ?? 'scene.ply' });
            return;
        }

        case 'save': {
            post({ ns: NS, evt: 'progress', stage: 'saving', percent: 5, message: msg.format });
            const bytes = await invokeOneOf<Uint8Array | ArrayBuffer>(events, ['scene.export', 'scene.save'], { format: msg.format });
            const buf = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
            const b64 = bytesToBase64(buf);
            post({ ns: NS, evt: 'save-result', format: msg.format, bytesBase64: b64, byteSize: buf.byteLength });
            return;
        }

        case 'set-camera':
            await invokeOneOf(events, ['camera.set', 'view.setCamera'], { position: msg.position, target: msg.target, fov: msg.fov });
            return;

        case 'headless':
            // The editor uses @playcanvas/splat-transform under the hood; we
            // forward the ops through a dedicated event so the existing edit
            // pipeline owns undo/redo.
            await invokeOneOf(events, ['scene.applyOps', 'edit.runOps'], { ops: msg.ops });
            return;

        case 'set-theme':
            await invokeOneOf(events, ['theme.set', 'ui.setTheme'], msg.theme);
            return;

        case 'set-locale':
            await invokeOneOf(events, ['locale.set', 'i18n.setLanguage'], msg.lng);
            return;
    }
}

// Try a list of candidate event names; the first one the Events bus accepts
// wins. This shields the bridge from upstream renames between versions.
async function invokeOneOf<T = unknown>(events: Events, names: string[], ...args: unknown[]): Promise<T> {
    for (const name of names) {
        try {
            // events.invoke returns a value (often a promise) when a handler is
            // registered; events.fire is the older fire-and-forget API.
            const out = (events as { invoke?: (n: string, ...a: unknown[]) => unknown }).invoke?.(name, ...args)
                ?? (events as { fire?: (n: string, ...a: unknown[]) => unknown }).fire?.(name, ...args);
            if (out !== undefined) return (await out) as T;
        } catch {
            // Try the next candidate name.
        }
    }
    throw new Error(`no handler for any of: ${names.join(', ')}`);
}

function bytesToBase64(bytes: Uint8Array): string {
    // Chunked to avoid blowing the call stack on large .ply exports.
    const CHUNK = 0x8000;
    let s = '';
    for (let i = 0; i < bytes.length; i += CHUNK) {
        s += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + CHUNK)) as unknown as number[]);
    }
    return btoa(s);
}
