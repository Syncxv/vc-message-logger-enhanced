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

import { findByPropsLazy, findLazy } from "@webpack";
import { ChannelStore, moment, UserStore } from "@webpack/common";

import { LoggedMessage, LoggedMessageJSON } from "../types";
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

export const mapEditHistory = (m: any) => {
    m.timestamp = moment(m.timestamp);
    return m;
};

export const messageJsonToMessageClass = memoize((log: { message: LoggedMessageJSON; }) => {
    // console.time("message populate");
    const message: LoggedMessage = new MessageClass(log.message);
    message.timestamp = moment(message.timestamp);

    const editHistory = message.editHistory?.map(mapEditHistory);
    if (editHistory && editHistory.length > 0) {
        message.editHistory = editHistory;
    }
    if (message.editedTimestamp)
        message.editedTimestamp = moment(message.editedTimestamp);
    message.author = new AuthorClass(message.author);
    (message.author as any).nick = (message.author as any).globalName ?? message.author.username;

    message.embeds = message.embeds.map(e => embedModule.sanitizeEmbed(message.channel_id, message.id, e));
    // console.timeEnd("message populate");
    return message;
});
