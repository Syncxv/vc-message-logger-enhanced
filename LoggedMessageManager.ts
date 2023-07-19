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

import { LoggedMessage, LoggedMessages } from "./types";

export const LOGGED_MESSAGES_KEY = "logged-messages-hi";

export const MessageLoggerStore = createStore("MessageLoggerData", "MessageLoggerStore");

export let loggedMessagesCache: LoggedMessages = { deletedMessages: {}, editedMessages: {}, };
(async () => {
    try {
        const res = await MessageLoggerStore("readonly", store => promisifyRequest<LoggedMessages>(store.get(LOGGED_MESSAGES_KEY)));
        if (res != null)
            loggedMessagesCache = res;
    } catch (error) {
        console.error("Error loading logged messages from the store:", error);
    }
})();


export const getLoggedMessages = async (): Promise<LoggedMessages> => (await DataStore.get(LOGGED_MESSAGES_KEY, MessageLoggerStore)) ?? { deletedMessages: {}, editedMessages: {} };
export const refreshCache = async () => loggedMessagesCache = await getLoggedMessages();

export const addMessage = async (message: LoggedMessage, key: "deletedMessages" | "editedMessages") => {
    const loggedMessages = await getLoggedMessages();
    loggedMessages[message.id] = { message: JSON.parse(JSON.stringify(message.toJS())) };

    if (!loggedMessages[key][message.channel_id])
        loggedMessages[key][message.channel_id] = [];

    if (!loggedMessages[key][message.channel_id].includes(message.id)) {
        loggedMessages[key][message.channel_id].push(message.id);
    }

    await DataStore.set(LOGGED_MESSAGES_KEY, loggedMessages, MessageLoggerStore);
    await refreshCache();
};


export async function removeLog(id: string) {
    const loggedMessages = await getLoggedMessages();
    if (loggedMessages[id]) {
        const message = loggedMessages[id];
        const channel_id = message.message?.channel_id || undefined;

        const removeFromKey = (key: "editedMessages" | "deletedMessages") => {
            if (loggedMessages[key][channel_id!]) {
                loggedMessages[key][channel_id!] = loggedMessages[key][channel_id!].filter(msgid => msgid !== id);

                if (loggedMessages[key][channel_id!].length === 0) {
                    delete loggedMessages[key][channel_id!];
                }
            }
        };

        removeFromKey("editedMessages");
        removeFromKey("deletedMessages");

        delete loggedMessages[id];

        await DataStore.set(LOGGED_MESSAGES_KEY, loggedMessages, MessageLoggerStore);
        await refreshCache();
    }
}



export const isLogEmpty = async () => {
    const logs = await getLoggedMessages();
    const hasDeletedMessages = Object.keys(logs.deletedMessages).length > 0;
    const hasEditedMessages = Object.keys(logs.editedMessages).length > 0;

    const hasMessages = Object.keys(logs).filter(m => m !== "editedMessages" && m !== "deletedMessages").length > 0;

    if (hasDeletedMessages && hasEditedMessages && hasMessages) return true;

    return false;

};
