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

import { MessageAttachment } from "@vencord/discord-types";
import { MessageStore } from "@webpack/common";

import { Flogger, settings } from "../..";
import type { DBMessageRecord } from "../../db";
import { LoggedAttachment, LoggedMessage, LoggedMessageJSON } from "../../types";
import { deleteImage, downloadAttachment, getImage, } from "./ImageManager";

export function getFileExtension(str: string) {
    const matches = str.match(/(\.[a-zA-Z0-9]+)(?:\?.*)?$/);
    if (!matches) return null;

    return matches[1];
}

export function isAttachmentGoodToCache(attachment: MessageAttachment, fileExtension: string) {
    if (attachment.size > settings.store.attachmentSizeLimitInMegabytes * 1024 * 1024) {
        Flogger.log("Attachment too large to cache", attachment.filename);
        return false;
    }
    const attachmentFileExtensionsStr = settings.store.attachmentFileExtensions.trim();

    if (attachmentFileExtensionsStr === "")
        return true;

    const allowedFileExtensions = attachmentFileExtensionsStr.split(",");

    if (fileExtension.startsWith(".")) {
        fileExtension = fileExtension.slice(1);
    }

    if (!fileExtension || !allowedFileExtensions.includes(fileExtension)) {
        Flogger.log("Attachment not in allowed file extensions", attachment.filename);
        return false;
    }

    return true;
}

export async function cacheMessageImages(message: LoggedMessage | LoggedMessageJSON) {
    try {
        for (const attachment of message.attachments) {
            const fileExtension = getFileExtension(attachment.filename ?? attachment.url) ?? attachment.content_type?.split("/")?.[1] ?? ".png";

            if (!isAttachmentGoodToCache(attachment, fileExtension)) {
                Flogger.log("skipping", attachment.filename);
                continue;
            }

            attachment.oldUrl = attachment.url;
            attachment.oldProxyUrl = attachment.proxy_url;

            // only normal urls work if theres a charset in the content type /shrug
            if (attachment.content_type?.includes(";")) {
                attachment.proxy_url = attachment.url;
            } else {
                // apparently proxy urls last longer
                attachment.url = attachment.proxy_url;
                attachment.proxy_url = attachment.url;
            }

            attachment.fileExtension = fileExtension;

            const path = await downloadAttachment(attachment);

            if (!path) {
                Flogger.error("Failed to cache attachment", attachment);
                continue;
            }

            attachment.path = path;
        }

    } catch (error) {
        Flogger.error("Error caching message images:", error);
    }
}

export async function deleteMessageImages(message: LoggedMessage | LoggedMessageJSON) {
    for (let i = 0; i < message.attachments.length; i++) {
        const attachment = message.attachments[i];
        await deleteImage(attachment.id);
    }
}

const chatBlobUrlCache = new Map<string, string>();
const logsBlobUrlCache = new Map<string, string>();
const activeChatBlobUrls = new Set<string>();
const activeLogsBlobUrls = new Set<string>();
const inFlightBlobLoads = new Map<string, Promise<string | null>>();

// attachment_id: message with mutated attachment urls
const chatBlobUrlOwners = new Map<string, { channelId: string; messageId: string; }>();

async function loadBlob(attachment: LoggedAttachment, cache: Map<string, string>, activeSet: Set<string>) {
    const imageData = await getImage(attachment.id, attachment.fileExtension);
    if (!imageData) return null;

    const blob = new Blob([imageData]);
    const resUrl = URL.createObjectURL(blob);
    cache.set(attachment.id, resUrl);
    activeSet.add(resUrl);

    return resUrl;
}

export const getAttachmentBlobUrl = async (attachment: LoggedAttachment, isLogs = false) => {
    const cache = isLogs ? logsBlobUrlCache : chatBlobUrlCache;
    const activeSet = isLogs ? activeLogsBlobUrls : activeChatBlobUrls;

    const cached = cache.get(attachment.id);
    if (cached) return cached;

    const key = `${isLogs}:${attachment.id}`;
    let pending = inFlightBlobLoads.get(key);
    if (!pending) {
        pending = loadBlob(attachment, cache, activeSet);
        inFlightBlobLoads.set(key, pending);
        pending.then(
            () => inFlightBlobLoads.delete(key),
            () => inFlightBlobLoads.delete(key)
        );
    }

    return pending;
};

export async function loadAttachmentBlobUrls(records: DBMessageRecord[], isLogs = false) {
    await Promise.all(records.map(async ({ message }) => {
        if (!message?.attachments) return;

        await Promise.all(message.attachments.map(async att => {
            try {
                const blobUrl = await getAttachmentBlobUrl(att, isLogs);
                if (blobUrl) {
                    att.url = blobUrl + "#";
                    att.proxy_url = blobUrl + "#";

                    if (!isLogs && message.channel_id && message.id)
                        chatBlobUrlOwners.set(att.id, { channelId: message.channel_id, messageId: message.id });
                }
            } catch (e) {
                Flogger.warn("Failed to load blob url for attachment", att.id, e);
            }
        }));
    }));

    return records;
}

export function revokeLogsBlobUrls() {
    for (const url of activeLogsBlobUrls) {
        URL.revokeObjectURL(url);
    }
    activeLogsBlobUrls.clear();
    logsBlobUrlCache.clear();
}

export function revokeChatBlobUrls() {
    for (const url of activeChatBlobUrls) {
        URL.revokeObjectURL(url);
    }
    activeChatBlobUrls.clear();
    chatBlobUrlCache.clear();
    chatBlobUrlOwners.clear();
}

// has() also checks the side cache, getMessage() doesnt. truncated messages sit in
// the side cache and come back on scroll-back still holding the url
export function sweepChatBlobUrls() {
    for (const [attachmentId, url] of chatBlobUrlCache) {
        const owner = chatBlobUrlOwners.get(attachmentId);

        if (!owner) continue;
        if (MessageStore.getMessages(owner.channelId)?.has(owner.messageId) !== false) continue;

        URL.revokeObjectURL(url);
        activeChatBlobUrls.delete(url);
        chatBlobUrlCache.delete(attachmentId);
        chatBlobUrlOwners.delete(attachmentId);
    }
}

