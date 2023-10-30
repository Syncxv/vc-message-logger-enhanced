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

import { createStore, promisifyRequest } from "@api/DataStore";
import { DataStore } from "@api/index";

import { settings } from ".";
import { LoggedMessage, LoggedMessageIds, LoggedMessageJSON, LoggedMessages, MessageRecord } from "./types";
import { cleanupMessage, sortMessagesByDate } from "./utils";
import { cacheMessageImages, deleteMessageImages } from "./utils/saveImage";

export const defaultLoggedMessages = { deletedMessages: {}, editedMessages: {}, };

export const LOGGED_MESSAGES_KEY = "logged-messages-hi";
export const MessageLoggerStore = createStore("MessageLoggerData", "MessageLoggerStore");

export let loggedMessagesCache: LoggedMessages = defaultLoggedMessages;


(async () => {
    try {
        const res = await MessageLoggerStore("readonly", store => promisifyRequest<LoggedMessages>(store.get(LOGGED_MESSAGES_KEY)));
        if (res != null)
            loggedMessagesCache = res;
    } catch (error) {
        console.error("Error loading logged messages from the store:", error);
    }
})();

// api

export const getLoggedMessages = async (): Promise<LoggedMessages> => {
    return settings.store.saveMessages
        ? (await DataStore.get(LOGGED_MESSAGES_KEY, MessageLoggerStore)) ?? defaultLoggedMessages
        : loggedMessagesCache;
};
export const refreshCache = async () => loggedMessagesCache = await getLoggedMessages();


export const saveLoggedMessages = async (loggedMessages: LoggedMessages) => {
    if (settings.store.saveMessages) {
        await DataStore.set(LOGGED_MESSAGES_KEY, loggedMessages, MessageLoggerStore);
        await refreshCache();
    } else {
        loggedMessagesCache = loggedMessages;
    }
};

export const addMessage = async (message: LoggedMessage | LoggedMessageJSON, key: keyof LoggedMessageIds) => {
    if (settings.store.saveImages && key === "deletedMessages")
        await cacheMessageImages(message);
    const loggedMessages = await getLoggedMessages();
    const finalMessage = cleanupMessage(message);
    loggedMessages[message.id] = { message: finalMessage };

    if (!loggedMessages[key][message.channel_id])
        loggedMessages[key][message.channel_id] = [];

    if (!loggedMessages[key][message.channel_id].includes(message.id))
        loggedMessages[key][message.channel_id].push(message.id);

    // if limit is negative or 0 there is no limit
    if (settings.store.messageLimit > 0 && (Object.keys(loggedMessages).length - 2) > settings.store.messageLimit)
        await deleteOldestMessageWithoutSaving(loggedMessages);

    await saveLoggedMessages(loggedMessages);
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

function removeLogWithoutSaving(messageId: string, loggedMessages: LoggedMessages) {
    const record = loggedMessages[messageId];
    if (record) {
        const channel_id = record.message?.channel_id;

        if (channel_id != null) {
            removeFromKey(messageId, channel_id, loggedMessages, "editedMessages");
            removeFromKey(messageId, channel_id, loggedMessages, "deletedMessages");
        }

        delete loggedMessages[messageId];
    }

    return loggedMessages;
}



export async function removeLogs(ids: string[]) {
    const loggedMessages = await getLoggedMessages();
    for (const msgId of ids) {
        removeLogWithoutSaving(msgId, loggedMessages);
    }
    await saveLoggedMessages(loggedMessages);
}

export async function removeLog(id: string) {
    const loggedMessages = await getLoggedMessages();
    const record = loggedMessages[id];

    if (record?.message)
        deleteMessageImages(record.message);

    removeLogWithoutSaving(id, loggedMessages);

    await saveLoggedMessages(loggedMessages);

}

export async function clearLogs() {
    await DataStore.set(LOGGED_MESSAGES_KEY, defaultLoggedMessages, MessageLoggerStore);
    await refreshCache();
}


// utils

export const hasLogs = async () => {
    const logs = await getLoggedMessages();
    const hasDeletedMessages = Object.keys(logs.deletedMessages).length > 0;
    const hasEditedMessages = Object.keys(logs.editedMessages).length > 0;

    const hasMessages = Object.keys(logs).filter(m => m !== "editedMessages" && m !== "deletedMessages").length > 0;

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
    const loggedMessages = await getLoggedMessages();

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

export async function deleteOldestMessageWithoutSaving(loggedMessages: LoggedMessages) {
    const oldestMessage = getOldestMessage(loggedMessages);
    if (!oldestMessage || !oldestMessage.message) {
        console.warn("couldnt find oldest message. oldestMessage == null || oldestMessage.message == null");
        return loggedMessages;
    }

    const { message } = oldestMessage;

    const [channelId, key] = await findLoggedChannelByMessage(message.id);

    if (!channelId || !key) {
        console.warn("couldnt find oldest message. channelId =", channelId, " key =", key);
        return loggedMessages;
    }

    removeLogWithoutSaving(message.id, loggedMessages);
    // console.log("removing", message);

    return loggedMessages;
}
