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

import {
    createStore,
    del,
    get,
    promisifyRequest,
    set,
    UseStore,
} from "@api/DataStore";

import { Flogger, settings } from "../..";
import { getLoggedMessages } from "../../LoggedMessageManager";
import { MessageRecord, SavedImages } from "../../types";
import { DEFAULT_IMAGE_CACHE_DIR } from "../constants";
import { getSavedImageByAttachmentOrImagePath } from ".";


let defaultGetStoreFunc: UseStore;

export function defaultGetMessageLoggerImageDataStore() {
    if (!defaultGetStoreFunc) {
        defaultGetStoreFunc = createStore("MessageLoggerImageData", "MessageLoggerImageStore");
    }
    return defaultGetStoreFunc;
}

let fs: typeof import("node:fs/promises");

export let savedImages: SavedImages = {};
export const SAVED_IMAGES_KEY = "saved-images-gang";
export const HAS_CHECKED_FOR_IMAGES_KEY = "has-checked-for-images";

(async () => {
    try {
        const res = await defaultGetMessageLoggerImageDataStore()("readonly", store => promisifyRequest<SavedImages>(store.get(SAVED_IMAGES_KEY)));
        if (res != null) {
            savedImages = res;
        }

        const hasChckedSavedImages = await get(HAS_CHECKED_FOR_IMAGES_KEY, defaultGetMessageLoggerImageDataStore());
        if (!hasChckedSavedImages)
            await checkForSavedImages();

    } catch (error) {
        console.error("Error getting saved images", error);
    }
})();

export function initNodeFs() {
    try {

        const req = window.coolRequire;
        if (!req) return false;

        fs = req("node:fs/promises");
        if (fs == null || fs.readFile == null || fs.writeFile == null) return false;
        return true;
    } catch (err) {
        Flogger.error("initNodeFs errored", err);
    }

    return false;
}

export const nativeFileSystemAccess = initNodeFs();

export async function getImage(imagePath: string, customStore = defaultGetMessageLoggerImageDataStore()): Promise<any> {
    if (!nativeFileSystemAccess || imagePath.startsWith(DEFAULT_IMAGE_CACHE_DIR))
        return get(imagePath, customStore);

    return await fs.readFile(imagePath);
}

export async function writeImage(imagePath: string, content: any, customStore = defaultGetMessageLoggerImageDataStore()): Promise<void> {
    if (!nativeFileSystemAccess || imagePath.startsWith(DEFAULT_IMAGE_CACHE_DIR))
        return await set(imagePath, content, customStore);

    fs.writeFile(imagePath, content);
}

export async function deleteImage(imagePath: string, customStore = defaultGetMessageLoggerImageDataStore()): Promise<void> {
    if (!nativeFileSystemAccess || imagePath.startsWith(DEFAULT_IMAGE_CACHE_DIR))
        return await del(imagePath, customStore);

    await fs.rm(imagePath);
}



export async function getDefaultNativePath(): Promise<string | null> {
    try {
        const path = window.coolRequire("path");
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


async function exists(filename: string) {
    try {
        await fs.access(filename);
        return true;
    } catch (error) {
        return false;
    }
}


export async function checkImageCacheDir(cacheDir: string) {
    if (!nativeFileSystemAccess) return;

    if (!await exists(cacheDir))
        await fs.mkdir(cacheDir);
}


// this only runs once for each client you use.
async function checkForSavedImages() {
    await set(HAS_CHECKED_FOR_IMAGES_KEY, true, defaultGetMessageLoggerImageDataStore());

    const loggedMessagIds = await getLoggedMessages();
    const messags = Object.values(loggedMessagIds)
        .filter(m => !Array.isArray(m) && m.message != null) as MessageRecord[];

    const messagsWithSavedImags = messags.filter(m => m.message.attachments.some(a => a.path != null));

    let numImagesFound = 0;

    for (const { message } of messagsWithSavedImags) {
        for (const attachment of message.attachments) {
            const blobUrl = await getSavedImageByAttachmentOrImagePath(attachment);
            if (blobUrl == null) continue;

            savedImages[attachment.id] = {
                messageId: message.id,
                attachmentId: attachment.id,
            };

            const finalUrl = blobUrl + "#";

            attachment.blobUrl = finalUrl;
            attachment.url = finalUrl;
            attachment.proxy_url = finalUrl;

            numImagesFound++;

        }
    }

    if (numImagesFound)
        await set(SAVED_IMAGES_KEY, savedImages, defaultGetMessageLoggerImageDataStore());

    return numImagesFound;
}

export const saveSavedImages = async (_savedImages?: SavedImages) => await set(SAVED_IMAGES_KEY, _savedImages ?? savedImages, defaultGetMessageLoggerImageDataStore());
