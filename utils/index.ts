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
export function reAddDeletedMessages(messages: LoggedMessage[], deletedMessages: string[], channelStart: boolean, channelEnd: boolean) {
    if (!messages.length || !deletedMessages?.length) return;
    const DISCORD_EPOCH = 14200704e5;
    const IDs: Id[] = [];
    const savedIDs: Id[] = [];

    for (let i = 0, len = messages.length; i < len; i++) {
        const { id } = messages[i];
        IDs.push({ id: id, time: (parseInt(id) / 4194304) + DISCORD_EPOCH });
    }
    for (let i = 0, len = deletedMessages.length; i < len; i++) {
        const id = deletedMessages[i];
        const record = loggedMessagesCache[id];
        if (!record) continue;
        savedIDs.push({ id: id, time: (parseInt(id) / 4194304) + DISCORD_EPOCH });
    }
    savedIDs.sort((a, b) => a.time - b.time);
    if (!savedIDs.length) return;
    const { time: lowestTime } = IDs[IDs.length - 1];
    const [{ time: highestTime }] = IDs;
    const lowestIDX = channelEnd ? 0 : savedIDs.findIndex(e => e.time > lowestTime);
    if (lowestIDX === -1) return;
    const highestIDX = channelStart ? savedIDs.length - 1 : findLastIndex(savedIDs, e => e.time < highestTime);
    if (highestIDX === -1) return;
    const reAddIDs = savedIDs.slice(lowestIDX, highestIDX + 1);
    reAddIDs.push(...IDs);
    reAddIDs.sort((a, b) => b.time - a.time);
    for (let i = 0, len = reAddIDs.length; i < len; i++) {
        const { id } = reAddIDs[i];
        if (messages.findIndex(e => e.id === id) !== -1) continue;
        const record = loggedMessagesCache[id];
        messages.splice(i, 0, record.message!);
    }
}

export function mapEditHistory(m: any) {
    m.timestamp = moment(m.timestamp);
    return m;
}
