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

import { MessageStore, moment } from "@webpack/common";
import { User } from "discord-types/general";

import { loggedMessagesCache } from "../LoggedMessageManager";
import { LoggedMessageJSON } from "../types";


export function cleanupMessage(message: any) {
    const ret = JSON.parse(JSON.stringify(message.toJS()));
    if (ret.type === 19) {
        ret.message_reference = message.message_reference || message.messageReference;
        if (ret.message_reference) {
            if (message.referenced_message) {
                ret.referenced_message = cleanupMessage(message.referenced_message);
            } else if (MessageStore.getMessage(ret.message_reference.channel_id, ret.message_reference.message_id)) {
                ret.referenced_message = cleanupMessage(MessageStore.getMessage(ret.message_reference.channel_id, ret.message_reference.message_id));
            }
        }
    }

    return ret;
}

// stolen from mlv2
export function cleanupEmbed(embed) {
    /* backported code from MLV2 rewrite */
    if (!embed.id) return embed; /* already cleaned */
    const retEmbed: any = {};
    if (typeof embed.rawTitle === "string") retEmbed.title = embed.rawTitle;
    if (typeof embed.rawDescription === "string") retEmbed.description = embed.rawDescription;
    if (typeof embed.referenceId !== "undefined") retEmbed.reference_id = embed.referenceId;
    // if (typeof embed.color === "string") retEmbed.color = ZeresPluginLibrary.ColorConverter.hex2int(embed.color);
    if (typeof embed.type !== "undefined") retEmbed.type = embed.type;
    if (typeof embed.url !== "undefined") retEmbed.url = embed.url;
    if (typeof embed.provider === "object") retEmbed.provider = { name: embed.provider.name, url: embed.provider.url };
    if (typeof embed.footer === "object") retEmbed.footer = { text: embed.footer.text, icon_url: embed.footer.iconURL, proxy_icon_url: embed.footer.iconProxyURL };
    if (typeof embed.author === "object") retEmbed.author = { name: embed.author.name, url: embed.author.url, icon_url: embed.author.iconURL, proxy_icon_url: embed.author.iconProxyURL };
    if (typeof embed.timestamp === "object" && embed.timestamp._isAMomentObject) retEmbed.timestamp = embed.timestamp.milliseconds();
    if (typeof embed.thumbnail === "object") {
        if (typeof embed.thumbnail.proxyURL === "string" || (typeof embed.thumbnail.url === "string" && !embed.thumbnail.url.endsWith("?format=jpeg"))) {
            retEmbed.thumbnail = {
                url: embed.thumbnail.url,
                proxy_url: typeof embed.thumbnail.proxyURL === "string" ? embed.thumbnail.proxyURL.split("?format")[0] : undefined,
                width: embed.thumbnail.width,
                height: embed.thumbnail.height
            };
        }
    }
    if (typeof embed.image === "object") {
        retEmbed.image = {
            url: embed.image.url,
            proxy_url: embed.image.proxyURL,
            width: embed.image.width,
            height: embed.image.height
        };
    }
    if (typeof embed.video === "object") {
        retEmbed.video = {
            url: embed.video.url,
            proxy_url: embed.video.proxyURL,
            width: embed.video.width,
            height: embed.video.height
        };
    }
    if (Array.isArray(embed.fields) && embed.fields.length) {
        retEmbed.fields = embed.fields.map(e => ({ name: e.rawName, value: e.rawValue, inline: e.inline }));
    }
    return retEmbed;
}

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
export function reAddDeletedMessages(messages: LoggedMessageJSON[], deletedMessages: string[], channelStart: boolean, channelEnd: boolean) {
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
        if (!record.message) continue;
        messages.splice(i, 0, record.message);
    }

    console.log(messages);
}

export function mapEditHistory(m: any) {
    m.timestamp = moment(m.timestamp);
    return m;
}
