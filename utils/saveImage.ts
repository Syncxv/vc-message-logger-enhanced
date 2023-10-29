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
import { DEFAULT_IMAGE_CACHE_DIR } from "./constants";
import { deleteFile, exists, mkdir, nativeFileSystemAccess, readFile, writeFile } from "./filesystem";
import { memoize } from "./memoize";

export function getFileExtension(str: string) {
    const matches = str.match(/(\.[a-zA-Z0-9]+)(?:\?.*)?$/);
    if (!matches) return null;

    return matches[1];
}

export function isImage(url: string) {
    return /\.(jpe?g|png|gif|bmp)(\?.*)?$/i.test(url);
}

async function checkImageCacheDir(cacheDir: string) {
    if (!nativeFileSystemAccess) return;

    if (!await exists(cacheDir))
        await mkdir(cacheDir);
}

export async function getDefaultNativePath(): Promise<string | null> {
    try {
        const path = window.require("path");
        const themesDir = await VencordNative.themes.getThemesDir();
        return path.join(themesDir, "../savedImages");
    } catch (err) {
        console.error("failed to get default native path", err);
        return null;
    }

}

export async function getImageCacheDir() {
    if (nativeFileSystemAccess && settings.store.imageCacheDir === DEFAULT_IMAGE_CACHE_DIR)
        return getDefaultNativePath();

    return settings.store.imageCacheDir ?? DEFAULT_IMAGE_CACHE_DIR;
}

export async function cacheImage(url: string, attachmentIdx: number, attachmentId: string, messageId: string, channelId: string, fileExtension: string | null, attempts = 0) {
    const res = await fetch(url);
    if (res.status !== 200) {
        if (res.status === 404 || res.status === 403) return;
        attempts++;
        if (attempts > 3) return console.warn(`Failed to get image ${attachmentId} for caching, error code ${res.status}`);
        return setTimeout(() => cacheImage(url, attachmentIdx, attachmentId, messageId, channelId, fileExtension, attempts), 1000);
    }
    const ab = await res.arrayBuffer();
    const imageCacheDir = await getImageCacheDir();
    const path = `${imageCacheDir}/${attachmentId}${fileExtension}`;
    await checkImageCacheDir(imageCacheDir);
    await writeFile(path, new Uint8Array(ab));

    return path;
}


export async function cacheMessageImages(message: LoggedMessage | LoggedMessageJSON) {
    try {
        for (let i = 0; i < message.attachments.length; i++) {
            const attachment = message.attachments[i];
            if (!isImage(attachment.filename ?? attachment.url) || !(attachment.content_type?.split("/")[0] === "image")) {
                console.log("skipping", attachment.filename);
                continue;
            }
            // apparently proxy urls last longer
            attachment.url = attachment.proxy_url;

            // all these may be pointless but its nice to have just in case
            const fileExtension = getFileExtension(attachment.filename ?? attachment.url);
            attachment.fileExtension = fileExtension;

            const path = await cacheImage(attachment.url, i, attachment.id, message.id, message.channel_id, fileExtension);
            attachment.path = path;
            attachment.nativefileSystem = nativeFileSystemAccess;
        }
    } catch (error) {
        console.error("Error caching message images:", error);
    }
}

export async function deleteMessageImages(message: LoggedMessage | LoggedMessageJSON) {
    for (let i = 0; i < message.attachments.length; i++) {
        const attachment = message.attachments[i];
        if (!attachment.path) continue;

        deleteFile(attachment.path);
    }
}


export const getSavedImageBlobUrl = memoize(async (url: string) => {
    if (!url.includes("/attachments")) return null;

    const thing = new URL(url);
    const [_channelId, attachmentId, fileName] = thing.pathname.replace("/attachments/", "").split("/");

    const fileExtension = getFileExtension(fileName);
    const imageData = await readFile(`${settings.store.imageCacheDir}/${attachmentId}${fileExtension}`);
    if (!imageData) return null;

    const blob = new Blob([imageData]);
    const resUrl = URL.createObjectURL(blob);

    return resUrl;
});
