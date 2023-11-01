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

import { sleep } from "@utils/misc";

import { Flogger, settings } from "../..";
import { getLoggedMessages, loggedMessagesCache } from "../../LoggedMessageManager";
import { LoggedAttachment, LoggedMessage, LoggedMessageJSON } from "../../types";
import { DEFAULT_IMAGE_CACHE_DIR } from "../constants";
import { memoize } from "../memoize";
import { sortMessagesByDate } from "../misc";
import { checkImageCacheDir, deleteImage, getImage, getImageCacheDir, nativeFileSystemAccess, savedImages, saveSavedImages as saveBruhSavedImages, writeImage, } from "./ImageManager";

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

export async function cacheImage(url: string, attachmentIdx: number, attachmentId: string, messageId: string, channelId: string, fileExtension: string | null, attempts = 0) {
    const res = await fetch(url);
    if (res.status !== 200) {
        if (res.status === 404 || res.status === 403) return;
        attempts++;
        if (attempts > 3) {
            Flogger.warn(`Failed to get image ${attachmentId} for caching, error code ${res.status}`);
            return;
        }

        await sleep(1000);
        return cacheImage(url, attachmentIdx, attachmentId, messageId, channelId, fileExtension, attempts);
    }
    const ab = await res.arrayBuffer();
    const imageCacheDir = await getImageCacheDir();
    const path = `${imageCacheDir}/${attachmentId}${fileExtension}`;
    await checkImageCacheDir(imageCacheDir);
    await writeImage(path, new Uint8Array(ab));

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
            const path = await cacheImage(attachment.url, i, attachment.id, message.id, message.channel_id, fileExtension);

            if (path == null) {
                Flogger.error("Failed to save image from attachment. id: ", attachment.id);
                continue;
            }

            attachment.fileExtension = fileExtension;
            attachment.path = path;
            attachment.nativefileSystem = nativeFileSystemAccess;

            savedImages[attachment.id] = {
                messageId: message.id,
                attachmentId: attachment.id,
            };
        }

        if (settings.store.imagesLimit > 0 && Object.keys(savedImages).length > settings.store.imagesLimit) {
            await deleteOldestImage();
        }

        // save sounds weird now
        await saveBruhSavedImages();
    } catch (error) {
        Flogger.error("Error caching message images:", error);
    }
}

export async function deleteMessageImages(message: LoggedMessage | LoggedMessageJSON) {
    for (let i = 0; i < message.attachments.length; i++) {
        const attachment = message.attachments[i];
        if (!attachment.path) continue;

        await deleteImage(attachment.path);
        delete savedImages[attachment.id];
    }
    await saveBruhSavedImages();
}

export async function deleteOldestImage() {
    const sorted = Object.keys(savedImages).sort(sortMessagesByDate);
    const oldestAttachmentId = sorted[sorted.length - 1];

    if (!oldestAttachmentId) return Flogger.warn("savedImages is likely empty",);

    const loggedMessages = await getLoggedMessages();
    const { messageId } = savedImages[oldestAttachmentId];
    const record = loggedMessages[messageId];

    if (!record?.message) {
        Flogger.warn("message with id %s not found", messageId);
        delete savedImages[oldestAttachmentId];
        return;
    }

    const attachment = record.message.attachments.find(m => m.id === oldestAttachmentId);
    if (!attachment || !attachment.path) {
        Flogger.warn("attachment with id %s not found", oldestAttachmentId);
        delete savedImages[oldestAttachmentId];
        return;
    }
    await deleteImage(attachment.path);
    delete savedImages[oldestAttachmentId];

    await saveBruhSavedImages();
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
    const imageCacheDir = await getImageCacheDir();

    let imagePath = `${imageCacheDir}/${attachmentId}${fileExtension}`;

    const res = await getSavedImageByAttachmentOrImagePath(null, imagePath);
    if (res) return res;


    // if it is a real native path (eg. C:\Monke\Path)
    if (settings.store.imageCacheDir !== DEFAULT_IMAGE_CACHE_DIR)
        // search for it in IndexedDB
        imagePath = `${DEFAULT_IMAGE_CACHE_DIR}/${attachmentId}${fileExtension}`;

    return await getSavedImageByAttachmentOrImagePath(null, imagePath);
});


// what the fuck is this
export async function getSavedImageByAttachmentOrImagePath(attachment?: LoggedAttachment | null, imgPath?: string) {
    const imagePath = attachment?.path ?? imgPath;

    if (!imagePath) return null;

    const imageData = await getImage(imagePath);
    if (!imageData) return null;

    const blob = new Blob([imageData]);
    const resUrl = URL.createObjectURL(blob);

    return resUrl;
}
