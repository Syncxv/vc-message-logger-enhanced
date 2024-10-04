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

import { createStore } from "@api/DataStore";

import { Flogger, Native, settings } from ".";
import { LoggedMessage, LoggedMessageIds, LoggedMessageJSON, LoggedMessages, MessageRecord } from "./types";
import { cleanupMessage, getNative, sortMessagesByDate } from "./utils";
import { cacheMessageImages, deleteMessageImages } from "./utils/saveImage";
import { addMessageIDB, DBMessageStatus, deleteMessagesIDB } from "./db";

export const defaultLoggedMessages = { deletedMessages: {}, editedMessages: {}, };

export const LOGGED_MESSAGES_KEY = "logged-messages-hi";
export const MessageLoggerStore = createStore("MessageLoggerData", "MessageLoggerStore");

// this gets used by the logs modal. logs modal should only use saved messages not messages that are being processed
// also hasMessageInLogs should only check saved messages not the ones that are being processed
export let savedLoggedMessages: LoggedMessages = { ...defaultLoggedMessages };

export let loggedMessages: LoggedMessages = { ...defaultLoggedMessages };

(async () => {
    try {
        const Native = getNative();
        const res = await Native.getLogsFromFs();
        if (res != null) {
            Flogger.log("Got logged messages from native");
            loggedMessages = res;
            savedLoggedMessages = res;
            return;
        }

        Flogger.log("No logged messages found in native");
    } catch (error) {
        console.error("Error loading logged messages from the store:", error);
    }
})();

// api

export const saveLoggedMessages = async () => {
    if (settings.store.saveMessages) {
        await Native.writeLogs(JSON.stringify(loggedMessages));
    }
    savedLoggedMessages = loggedMessages;
};

export const addMessage = async (message: LoggedMessage | LoggedMessageJSON, status: DBMessageStatus, isBulk = false) => {
    if (settings.store.saveImages && status === DBMessageStatus.DELETED)
        await cacheMessageImages(message);
    const finalMessage = cleanupMessage(message);

    await addMessageIDB(finalMessage, status);
};


export const removeFromKey = (
    message_id: string,
    channel_id: string,
    loggedMessages: LoggedMessages,
    key: keyof LoggedMessageIds,
) => {
    if (loggedMessages[key][channel_id]) {
        loggedMessages[key][channel_id] = loggedMessages[key][channel_id].filter(msgid => msgid !== message_id);

        if (loggedMessages[key][channel_id].length === 0) {
            delete loggedMessages[key][channel_id];
        }
    }
};


export async function removeLogs(ids: string[]) {
    await deleteMessagesIDB(ids);
}



export async function clearLogs() {
    await Native.writeLogs(JSON.stringify(defaultLoggedMessages));
    loggedMessages = defaultLoggedMessages;
    savedLoggedMessages = defaultLoggedMessages;
}


// utils

export const hasMessageInLogs = (messageId: string) => {
    const bruh = Object.values(savedLoggedMessages)
        .filter(m => !Array.isArray(m)) as MessageRecord[];

    return bruh.find(m => m.message?.id === messageId);
};

export const hasLogs = async () => {
    const hasDeletedMessages = Object.keys(loggedMessages.deletedMessages).length > 0;
    const hasEditedMessages = Object.keys(loggedMessages.editedMessages).length > 0;

    const hasMessages = Object.keys(loggedMessages).filter(m => m !== "editedMessages" && m !== "deletedMessages").length > 0;

    if (hasDeletedMessages && hasEditedMessages && hasMessages) return true;

    return false;
};

export function findLoggedChannelByMessageIdSync(messageId: string, loggedMessages: LoggedMessages, key: keyof LoggedMessageIds) {
    for (const channelId in loggedMessages[key]) {
        if (loggedMessages[key][channelId].includes(messageId)) return channelId;
    }

    return null;
}

export async function findLoggedChannelByMessage(messageId: string, key?: keyof LoggedMessageIds): Promise<[string | null, keyof LoggedMessageIds]> {

    if (!key) {
        const id1 = findLoggedChannelByMessageIdSync(messageId, loggedMessages, "deletedMessages");
        if (id1) return [id1, "deletedMessages"];
        const id2 = findLoggedChannelByMessageIdSync(messageId, loggedMessages, "editedMessages");
        return [id2, "editedMessages"];
    }

    return [findLoggedChannelByMessageIdSync(messageId, loggedMessages, key), key];
}


export function getOldestMessage(loggedMessageIds: LoggedMessages) {
    const messags = Object.values(loggedMessageIds)
        .filter(m => !Array.isArray(m) && m.message != null) as MessageRecord[];

    const sortedMessages = messags.sort((a, b) => sortMessagesByDate(a.message.timestamp, b.message.timestamp));

    const oldestMessage = sortedMessages[sortedMessages.length - 1];

    return oldestMessage ?? null;
}

export function getMessage(channelId: string, messageId: string) {
    const messags = Object.values(savedLoggedMessages)
        .filter(m => !Array.isArray(m) && m.message != null) as MessageRecord[];

    return messags.find(m => m.message.channel_id === channelId && m.message.id === messageId);
}