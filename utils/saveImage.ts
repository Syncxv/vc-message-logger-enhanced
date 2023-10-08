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

import { settings } from "..";
import { LoggedMessage, LoggedMessageJSON } from "../types";
import { exists, mkdir, nativeFileSystemAccess, writeFile } from "./filesystem";

export function isImage(url: string) {
    return /\.(jpe?g|png|gif|bmp)(\?.*)?$/i.test(url);
}

async function checkImageCacheDir(cacheDir: string) {
    if (!nativeFileSystemAccess) return;

    if (!await exists(cacheDir))
        await mkdir(cacheDir);
}

// damn this sucks
export async function getImageCacheDir() {
    if (settings.store.imageCacheDir) return settings.store.imageCacheDir;

    if (nativeFileSystemAccess) {
        const path = window.require("path");
        const themesDir = await VencordNative.themes.getThemesDir();
        return path.join(themesDir, "../savedImages");
    }

    return "savedImages";


}

export async function cacheImage(url: string, attachmentIdx: number, attachmentId: string, messageId: string, channelId: string, attempts = 0) {
    const res = await fetch(url);
    if (res.status !== 200) {
        if (res.status === 404 || res.status === 403) return;
        attempts++;
        if (attempts > 3) return console.warn(`Failed to get image ${attachmentId} for caching, error code ${res.status}`);
        return setTimeout(() => cacheImage(url, attachmentIdx, attachmentId, messageId, channelId, attempts), 1000);
    }
    const fileExtension = url.match(/(\.[a-zA-Z0-9]+)(?:\?.*)?$/)![1];
    const ab = await res.arrayBuffer();
    const imageCacheDir = await getImageCacheDir();
    await checkImageCacheDir(imageCacheDir);
    await writeFile(`${imageCacheDir}/${attachmentId}${fileExtension}`, new Uint8Array(ab));
}


export async function cacheMessageImages(message: LoggedMessage | LoggedMessageJSON) {
    try {
        for (let i = 0; i < message.attachments.length; i++) {
            const attachment = message.attachments[i];
            if (!isImage(attachment.url)) continue;
            await cacheImage(attachment.url, i, attachment.id, message.id, message.channel_id);
        }
    } catch (error) {
        console.error("Error caching message images:", error);
    }
}
