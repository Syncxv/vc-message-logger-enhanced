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

import { moment } from "@webpack/common";
import { User } from "discord-types/general";

import { loggedMessagesCache } from "../LoggedMessageManager";
import { LoggedMessage } from "../types";

// stolen from mlv2
export function cleanupUserObject(user: User) {
    /* backported from MLV2 rewrite */
    return {
        discriminator: user.discriminator,
        username: user.username,
        avatar: user.avatar,
        id: user.id,
        bot: user.bot,
        public_flags: typeof user.publicFlags !== "undefined" ? user.publicFlags : (user as any).public_flags
    };
}

// stolen from mlv2
export function findLastIndex<T>(array: T[], predicate: (e: T, t: number, n: T[]) => boolean) {
    let l = array.length;
    while (l--) {
        if (predicate(array[l], l, array))
            return l;
    }
    return -1;
}


// stolen from mlv2
// https://github.com/1Lighty/BetterDiscordPlugins/blob/master/Plugins/MessageLoggerV2/MessageLoggerV2.plugin.js#L2367


interface Id { id: string, time: number; }

const DISCORD_EPOCH = 1420070400000;

function convertIdToTime(id: string): number {
    return parseInt(id) / 4194304 + DISCORD_EPOCH;
}

function filterExistingMessages(ids: Id[], messages: LoggedMessage[]): Id[] {
    return ids.filter(({ id }) => messages.findIndex(msg => msg.id === id) === -1);
}

function sortIdsByTime(ids: Id[]): Id[] {
    return ids.slice().sort((a, b) => b.time - a.time);
}

export function reAddDeletedMessages(messages: LoggedMessage[], deletedMessages: string[], channelStart: boolean, channelEnd: boolean) {
    if (!messages.length || !deletedMessages?.length) return;

    const IDs: Id[] = messages.map(({ id }) => ({ id, time: convertIdToTime(id) }));
    const savedIDs: Id[] = deletedMessages
        .map(id => ({ id, time: convertIdToTime(id) }))
        .filter(({ id }) => !!loggedMessagesCache[id]);

    savedIDs.sort((a, b) => a.time - b.time);

    if (!savedIDs.length) return;

    const lowestTime = IDs[IDs.length - 1].time;
    const highestTime = IDs[0].time;

    const lowestIDX = channelEnd ? 0 : savedIDs.findIndex(e => e.time > lowestTime);
    if (lowestIDX === -1) return;

    const highestIDX = channelStart
        ? savedIDs.length - 1
        : savedIDs.slice().reverse().findIndex(e => e.time < highestTime);
    if (highestIDX === -1) return;

    const reAddIDs = savedIDs.slice(lowestIDX, savedIDs.length - highestIDX);

    const idsToAdd = filterExistingMessages(reAddIDs, messages);
    idsToAdd.push(...IDs);
    const sortedIds = sortIdsByTime(idsToAdd);

    for (let i = 0, len = sortedIds.length; i < len; i++) {
        const { id } = sortedIds[i];
        if (messages.findIndex(e => e.id === id) !== -1) continue;
        const record = loggedMessagesCache[id];
        messages.splice(i, 0, record.message!);
    }
}

export function mapEditHistory(m: any) {
    m.timestamp = moment(m.timestamp);
    return m;
}
