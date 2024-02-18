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

import { get, set } from "@api/DataStore";
import { PluginNative } from "@utils/types";
import { findByPropsLazy, findLazy } from "@webpack";
import { ChannelStore, UserStore } from "@webpack/common";

import { LOGGED_MESSAGES_KEY, MessageLoggerStore } from "../LoggedMessageManager";
import { LoggedMessage, LoggedMessageJSON } from "../types";
import { DEFAULT_IMAGE_CACHE_DIR } from "./constants";
import { DISCORD_EPOCH } from "./index";
import { memoize } from "./memoize";

const MessageClass: any = findLazy(m => m?.prototype?.isEdited);
const AuthorClass = findLazy(m => m?.prototype?.getAvatarURL);
const embedModule = findByPropsLazy("sanitizeEmbed");

export function getGuildIdByChannel(channel_id: string) {
    return ChannelStore.getChannel(channel_id)?.guild_id;
}

export const isGhostPinged = (message?: LoggedMessageJSON) => {
    return message?.ghostPinged || message?.deleted && hasPingged(message);

};

export const hasPingged = (message?: LoggedMessageJSON | { mention_everyone: boolean, mentions: any[]; }) => {
    return message && !!(
        message.mention_everyone ||
        message.mentions?.find(m => (typeof m === "string" ? m : m.id) === UserStore.getCurrentUser().id)
    );
};

export const discordIdToDate = (id: string) => new Date((parseInt(id) / 4194304) + DISCORD_EPOCH);

export const sortMessagesByDate = (timestampA: string, timestampB: string) => {
    // very expensive
    // const timestampA = discordIdToDate(a).getTime();
    // const timestampB = discordIdToDate(b).getTime();
    // return timestampB - timestampA;

    // newest first
    if (timestampA < timestampB) {
        return 1;
    } else if (timestampA > timestampB) {
        return -1;
    } else {
        return 0;
    }
};



// stolen from mlv2
export function findLastIndex<T>(array: T[], predicate: (e: T, t: number, n: T[]) => boolean) {
    let l = array.length;
    while (l--) {
        if (predicate(array[l], l, array))
            return l;
    }
    return -1;
}

const getTimestamp = (timestamp: any): Date => {
    return new Date(timestamp);
};

export const mapEditHistory = (m: any) => {
    m.timestamp = getTimestamp(m.timestamp);
    return m;
};


export const messageJsonToMessageClass = memoize((log: { message: LoggedMessageJSON; }) => {
    // console.time("message populate");
    if (!log?.message) return null;

    const message: LoggedMessage = new MessageClass(log.message);
    // @ts-ignore
    message.timestamp = getTimestamp(message.timestamp);

    const editHistory = message.editHistory?.map(mapEditHistory);
    if (editHistory && editHistory.length > 0) {
        message.editHistory = editHistory;
    }
    if (message.editedTimestamp)
        message.editedTimestamp = getTimestamp(message.editedTimestamp) as any;
    message.author = new AuthorClass(message.author);
    (message.author as any).nick = (message.author as any).globalName ?? message.author.username;

    message.embeds = message.embeds.map(e => embedModule.sanitizeEmbed(message.channel_id, message.id, e));
    // console.timeEnd("message populate");
    return message;
});


export function parseJSON(json?: string | null) {
    try {
        return JSON.parse(json!);
    } finally {
        return null;
    }
}

export async function doesBlobUrlExist(url: string) {
    const res = await fetch(url);
    return res.ok;
}

export function getNative(): PluginNative<typeof import("../native")> {
    if (IS_WEB) {
        const Native = {
            getLogsFromFs: async () => get(LOGGED_MESSAGES_KEY, MessageLoggerStore),
            writeLogs: async (logs: string) => set(LOGGED_MESSAGES_KEY, JSON.parse(logs), MessageLoggerStore),
            getDefaultNativeImageDir: async () => DEFAULT_IMAGE_CACHE_DIR,
            getDefaultNativeDataDir: async () => "",
            deleteFileNative: async () => { },
            chooseDir: async (x: string) => "",
            getSettings: async () => ({ imageCacheDir: DEFAULT_IMAGE_CACHE_DIR, logsDir: "" }),
            init: async () => { },
            initDirs: async () => { },
            getImageNative: async (x: string) => new Uint8Array(0),
            getNativeSavedImages: async () => new Map(),
            messageLoggerEnhancedUniqueIdThingyIdkMan: async () => { },
            showItemInFolder: async () => { },
            writeImageNative: async () => { },
            getCommitHash: async () => ({ ok: true, value: "" }),
            getRepoInfo: async () => ({ ok: true, value: { repo: "", gitHash: "" } }),
            getNewCommits: async () => ({ ok: true, value: [] }),
            update: async () => ({ ok: true, value: "" }),
        } satisfies PluginNative<typeof import("../native")>;

        return Native;

    }

    return Object.values(VencordNative.pluginHelpers)
        .find(m => m.messageLoggerEnhancedUniqueIdThingyIdkMan) as PluginNative<typeof import("../native")>;

}
