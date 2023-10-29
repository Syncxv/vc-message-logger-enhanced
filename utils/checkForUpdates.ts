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

import { VERSION } from "../index";


export const repoName = "vc-message-logger-enhanced";
export const user = "Syncxv";
export const branch = "master";

export async function getUpdateVersion() {
    const indexTsx = await (await fetch(`https://raw.githubusercontent.com/${user}/${repoName}/${branch}/index.tsx`, { cache: "no-cache" })).text();
    const res = indexTsx.match(/export const VERSION = "(.+)";/);
    if (!res) return false;

    const [_, version] = res;
    const [major, minor, patch] = version.split(".").map(m => parseInt(m));
    if (Number.isNaN(major) || Number.isNaN(minor) || Number.isNaN(patch)) return false;

    const [currentMajor, currentMinor, currentPatch] = VERSION.split(".").map(m => parseInt(m));

    if (major > currentMajor || minor > currentMinor || patch > currentPatch) return version;

    return false;
}


export async function checkForUpdates(delay = 0, showNoUpdateToast = true) {
    const updateVersion = await getUpdateVersion();
    if (!updateVersion) {
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
        title: `Update available for Message Logger Enhanced. ${updateVersion}`,
        body: "Click here to update",
        permanent: true,
        noPersist: true,
        onClick() {
            VencordNative.native.openExternal("https://github.com/Syncxv/vc-message-logger-enhanced/#how-to-update");
        }
    }), delay);
}
