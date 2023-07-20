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

import { ChannelStore } from "@webpack/common";

import { LoggedMessageJSON } from "../types";

const validIdSearchTypes = ["server", "channel", "user", "message"] as const;
type ValidIdSearchTypesUnion = typeof validIdSearchTypes[number];

export function parseQuery(query: string) {
    let filter;
    let rest;

    filter = query.substring(0, query.indexOf(" "));
    rest = query.substring(query.indexOf(" ") + 1);
    if (!filter) {
        filter = query;
        rest = "";
    }

    if (!filter)
        return {
            success: false,
            query,
        };

    const splitted = filter.split(":");
    if (splitted.length < 2)
        return {
            success: false,
            query,
        };

    const [type, id] = splitted as [ValidIdSearchTypesUnion, string];

    if (!type || !id)
        return {
            success: false,
            query,
        };


    if (!validIdSearchTypes.includes(type))
        return {
            success: false,
            query,
        };

    return {
        success: true,
        key: type,
        id,
        query: rest
    };
}


export function doesMatch(type: typeof validIdSearchTypes[number], value: string, message: LoggedMessageJSON) {
    switch (type) {
        case "channel":
            return message.channel_id === value;
        case "message":
            return message.id === value;
        case "user":
            return message.author.id === value;
        case "server": {
            if (message.guildId)
                return message.guildId === value;
            const guild_id = ChannelStore.getChannel(message.channel_id)?.guild_id;
            return guild_id === value;
        }
        default:
    }
}
