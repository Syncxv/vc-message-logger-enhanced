/*
 * Vencord, a Discord client mod
 * Copyright (c) 2023 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

export function createMessageLimitEnforcer(enforce: () => Promise<void>) {
    let pending: Promise<void> | null = null;
    let rerun = false;

    return function enforceMessageLimit() {
        if (pending != null) {
            rerun = true;
            return pending;
        }

        pending = (async () => {
            do {
                rerun = false;
                await enforce();
            } while (rerun);
        })().finally(() => {
            pending = null;
            rerun = false;
        });
        return pending;
    };
}

export function getMessageLimitDeleteCount(currentCount: number, messageLimit: number) {
    if (messageLimit <= 0 || currentCount <= messageLimit)
        return 0;

    const headroom = Math.min(1000, Math.max(1, Math.floor(messageLimit / 100)));
    return currentCount - Math.max(0, messageLimit - headroom);
}
