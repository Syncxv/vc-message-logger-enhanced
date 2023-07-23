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

import { Message, MessageJSON } from "discord-types/general";

export type RefrencedMessage = LoggedMessageJSON & { message_id: string; };
export interface LoggedMessageJSON extends Omit<Message, "timestamp"> {
    mention_everyone?: string;
    guildId?: string;
    guild_id?: string;
    ghostPinged?: boolean;
    timestamp: string;
    ourCache?: boolean;
    referenced_message: RefrencedMessage;
    message_reference: RefrencedMessage;

    deleted?: boolean;
    editHistory?: {
        timestamp: string;
        content: string;
    }[];
}

export interface LoggedMessage extends Message {
    deleted?: boolean,
    editHistory?: {
        timestamp: string;
        content: string;
    }[];
}


export interface MessageDeletePayload {
    type: string;
    guildId: string;
    id: string;
    channelId: string;
    mlDeleted?: boolean;
}

export interface MessageUpdatePayload {
    type: string;
    guildId: string;
    message: MessageJSON;
}

export interface MessageCreatePayload {
    type: string;
    guildId: string;
    channelId: string;
    message: MessageJSON;
    optimistic: boolean;
    isPushNotification: boolean;
}

export interface LoadMessagePayload {
    type: string;
    channelId: string;
    messages: LoggedMessageJSON[];
    isBefore: boolean;
    isAfter: boolean;
    hasMoreBefore: boolean;
    hasMoreAfter: boolean;
    limit: number;
    isStale: boolean;
}
type LoggedMessageId = {
    [channel_id: string]: string[];
};


export type LoggedMessageIds = {
    deletedMessages: LoggedMessageId;
    editedMessages: LoggedMessageId;
};

export type LoggedMessages = LoggedMessageIds & { [message_id: string]: { message?: LoggedMessageJSON; }; };
