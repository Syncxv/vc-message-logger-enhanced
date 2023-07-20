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


import { LoggedMessageJSON } from "../types";
import { getGuildIdByChannel } from "./index";
import { memoize } from "./memoize";


const validIdSearchTypes = ["server", "channel", "user", "message"] as const;
type ValidIdSearchTypesUnion = typeof validIdSearchTypes[number];

interface QueryResult {
    success: boolean;
    query: string;
    type?: ValidIdSearchTypesUnion;
    id?: string;
}

export const parseQuery = memoize((query: string): QueryResult => {
    const trimmedQuery = query.trim();
    if (!trimmedQuery) {
        return { success: false, query };
    }

    const [filter, rest] = trimmedQuery.split(" ", 2);
    if (!filter) {
        return { success: false, query };
    }

    const [type, id] = filter.split(":") as [ValidIdSearchTypesUnion, string];
    if (!type || !id || !validIdSearchTypes.includes(type)) {
        return { success: false, query };
    }

    return { success: true, type, id, query: rest ?? "" };
});


export const doesMatch = memoize((type: typeof validIdSearchTypes[number], value: string, message: LoggedMessageJSON) => {
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
            return getGuildIdByChannel(message.channel_id) === value;
        }
        default:
            return false;
    }
});
