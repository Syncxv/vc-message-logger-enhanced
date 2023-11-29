/*
 * Vencord, a modification for Discord's desktop app
 * Copyright (c) 2023 Vendicated and contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import { showNotification } from "@api/Notifications";
import { Toasts } from "@webpack/common";

import { openUpdaterModal } from "../components/UpdaterModal";
import { Native } from "../index";


export const repoName = "vc-message-logger-enhanced";
export const user = "Syncxv";
export const branch = "master";

type IPCReturn<T> = {
    ok: boolean;
    value: T;
    error?: undefined;
} | {
    ok: boolean;
    error: any;
    value?: T;
};

export async function Unwrap<T>(p: Promise<IPCReturn<T>>) {
    const res = await p;

    if (res.ok) return res.value;

    updateError = res.error;
    throw res.error;
}


type Changes = Record<"hash" | "author" | "message", string>[];
export let changes: Changes;
export let updateError: any | null | undefined = null;
export let isOutdated = false;

export async function checkForUpdatesReal() {
    changes = (await Unwrap<Changes>(Native.calculateGitChanges())) ?? [];

    return isOutdated = changes.length > 0;
}

export const getRepo = () => Unwrap<string>(Native.getRepo());
export const getHash = () => Unwrap<string>(Native.getCurrentHash());


export async function promptForUpdate(delay = 0, showNoUpdateToast = true) {
    if (IS_WEB) return;

    const hasUpdate = await checkForUpdatesReal();
    if (!hasUpdate) {
        if (showNoUpdateToast)
            Toasts.show({
                message: "No updates found!",
                id: Toasts.genId(),
                type: Toasts.Type.MESSAGE,
                options: {
                    position: Toasts.Position.BOTTOM
                }
            });
        return;
    }


    setTimeout(() => showNotification({
        title: "Update available for Message Logger Enhanced",
        body: "Click here to update",
        permanent: true,
        noPersist: true,
        onClick() {
            openUpdaterModal();
        }
    }), delay);
}
