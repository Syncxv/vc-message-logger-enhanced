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

import { Flogger, settings } from "..";
import { loggedMessagesCache } from "../LoggedMessageManager";
import { LoggedAttachment, LoggedMessage, LoggedMessageJSON } from "../types";
import { DEFAULT_IMAGE_CACHE_DIR } from "./constants";
import { deleteFile, exists, mkdir, nativeFileSystemAccess, readFile, writeFile } from "./filesystem";
import { readFile as readFileIndexedDB } from "./filesystem/indexeddb-fs";
import { memoize } from "./memoize";

export function getFileExtension(str: string) {
    const matches = str.match(/(\.[a-zA-Z0-9]+)(?:\?.*)?$/);
    if (!matches) return null;

    return matches[1];
}

export function isImage(url: string) {
    return /\.(jpe?g|png|gif|bmp)(\?.*)?$/i.test(url);
}

function transformAttachmentUrl(messageId: string, attachmentUrl: string) {
    const url = new URL(attachmentUrl);
    url.searchParams.set("messageId", messageId);

    return url.toString();
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
        Flogger.error("failed to get default native path", err);
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
        if (attempts > 3) return Flogger.warn(`Failed to get image ${attachmentId} for caching, error code ${res.status}`);
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
                Flogger.log("skipping", attachment.filename);
                continue;
            }
            // apparently proxy urls last longer
            attachment.url = transformAttachmentUrl(message.id, attachment.proxy_url);

            const fileExtension = getFileExtension(attachment.filename ?? attachment.url);
            attachment.fileExtension = fileExtension;

            const path = await cacheImage(attachment.url, i, attachment.id, message.id, message.channel_id, fileExtension);
            attachment.path = path;
            attachment.nativefileSystem = nativeFileSystemAccess;
        }
    } catch (error) {
        Flogger.error("Error caching message images:", error);
    }
}

export async function deleteMessageImages(message: LoggedMessage | LoggedMessageJSON) {
    for (let i = 0; i < message.attachments.length; i++) {
        const attachment = message.attachments[i];
        if (!attachment.path) continue;

        deleteFile(attachment.path);
    }
}


function getMessage(url: URL) {
    const messageId = url.searchParams.get("messageId");
    if (!messageId) return null;

    const record = loggedMessagesCache[messageId];
    if (!record || !record.message) return null;

    return record.message;
}
export const getSavedImageByUrl = memoize(async (attachmentUrl: string) => {
    if (!attachmentUrl.includes("/attachments")) return null;

    const url = new URL(attachmentUrl);

    const [_channelId, attachmentId, fileName] = url.pathname.replace("/attachments/", "").split("/");

    const message = getMessage(url);
    const attachment = message?.attachments.find(m => m.id === attachmentId);

    if (attachment) return getSavedImageByAttachmentOrImagePath(attachment);

    const fileExtension = getFileExtension(fileName);
    const imagePath = `${settings.store.imageCacheDir}/${attachmentId}${fileExtension}`;

    return getSavedImageByAttachmentOrImagePath(null, imagePath);
});


// what the fuck is this
export async function getSavedImageByAttachmentOrImagePath(attachment?: LoggedAttachment | null, imgPath?: string) {
    const imagePath = attachment?.path ?? imgPath;

    if (!imagePath) return null;

    let imageData;
    // damn this whole thing is confusing
    if (attachment) {
        // let's consider a scenario where native file system access was initially unavailable,
        // and we saved some images in IndexedDB. Later, native file system access became available.
        // without this conditional check, 'readFile' would return null because readFile is now the node js readFile
        // but we saved the image using the IndexedDB file system.
        if (!attachment.nativefileSystem) {
            imageData = await readFileIndexedDB(imagePath);
        } else
            imageData = await readFile(imagePath);
    } else {
        imageData = await readFileIndexedDB(imagePath);
        if (nativeFileSystemAccess)
            imageData = readFile(imagePath);
    }
    if (!imageData) return null;

    const blob = new Blob([imageData]);
    const resUrl = URL.createObjectURL(blob);

    return resUrl;
}
