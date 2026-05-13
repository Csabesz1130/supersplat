import { Events } from './events';
import { installActionNetHostBridge } from './actionnet/host-bridge';

const IS_SCENE_DIRTY = 'supersplat:is-scene-dirty';

interface IsSceneDirtyQuery {
    type: typeof IS_SCENE_DIRTY;
}

interface IsSceneDirtyResponse {
    type: typeof IS_SCENE_DIRTY;
    result: boolean;
}

const isSceneDirtyQuery = (data: any): data is IsSceneDirtyQuery => {
    return (
        data &&
        typeof data === 'object' &&
        data.type === IS_SCENE_DIRTY
    );
};

const registerIframeApi = (events: Events) => {
    window.addEventListener('message', (event: MessageEvent) => {
        const source = event.source as Window | null;
        if (!source) {
            return;
        }

        if (isSceneDirtyQuery(event.data)) {
            const response: IsSceneDirtyResponse = {
                type: IS_SCENE_DIRTY,
                result: events.invoke('scene.dirty') as boolean
            };
            source.postMessage(response, event.origin);
        }
    });

    // Opt-in ActionNet host bridge. The bridge is only attached when the page
    // was opened with ?host=actionnet so non-ActionNet embeds keep the exact
    // upstream behavior (only the IS_SCENE_DIRTY query above).
    try {
        const sp = new URLSearchParams(window.location.search);
        if (sp.get('host') === 'actionnet') {
            installActionNetHostBridge(events);
        }
    } catch {
        // location.search may be inaccessible in some sandboxes; ignore.
    }
};

export { registerIframeApi };
