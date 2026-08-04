/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { LoggedMessageJSON } from "./types";
import { getMessageStatus } from "./utils";
import { DB_NAME, DB_VERSION } from "./utils/constants";
import { DBSchema, IDBPDatabase, openDB } from "./utils/idb";
import { doesMatch, tokenizeQuery } from "./utils/parseQuery";

export enum DBMessageStatus {
    DELETED = "DELETED",
    EDITED = "EDITED",
    GHOST_PINGED = "GHOST_PINGED",
}

export interface DBMessageRecord {
    message_id: string;
    channel_id: string;
    status: DBMessageStatus;
    message: LoggedMessageJSON;
}

export interface MLIDB extends DBSchema {
    messages: {
        key: string;
        value: DBMessageRecord;
        indexes: {
            by_channel_id: string;
            by_status: DBMessageStatus;
            by_timestamp: string;
            by_timestamp_and_message_id: [string, string];
        };
    };

}

export let db: IDBPDatabase<MLIDB>;

export async function initIDB() {

    db = await openDB<MLIDB>(DB_NAME, DB_VERSION, {
        upgrade(db) {
            const messageStore = db.createObjectStore("messages", { keyPath: "message_id" });
            messageStore.createIndex("by_channel_id", "channel_id");
            messageStore.createIndex("by_status", "status");
            messageStore.createIndex("by_timestamp", "message.timestamp");
            messageStore.createIndex("by_timestamp_and_message_id", ["channel_id", "message.timestamp"]);
        }
    });
}
initIDB();

export async function hasMessageIDB(message_id: string) {

    return (await db.count("messages", message_id)) > 0;
}

export async function countMessagesIDB() {

    return await db.count("messages");
}

export async function countMessagesByStatusIDB(status: DBMessageStatus) {

    return await db.countFromIndex("messages", "by_status", status);
}

export async function getAllMessagesIDB() {

    return await db.getAll("messages");
}

export async function getMessagesForChannelIDB(channel_id: string) {

    return await db.getAllFromIndex("messages", "by_channel_id", channel_id);
}

export async function getMessageIDB(message_id: string) {

    return await db.get("messages", message_id);
}

export async function getMessagesByStatusIDB(status: DBMessageStatus) {

    return await db.getAllFromIndex("messages", "by_status", status);
}

export async function getOldestMessagesIDB(limit: number) {

    return await db.getAllFromIndex("messages", "by_timestamp", undefined, limit);
}

export async function* iterateAllMessagesIDB(batchSize = 100) {
    let lastId: string | undefined;
    while (true) {
        const batch: DBMessageRecord[] = [];

        const tx = db.transaction("messages");
        const range = lastId ? IDBKeyRange.lowerBound(lastId, true) : undefined;
        let cursor = await tx.store.openCursor(range);

        while (cursor && batch.length < batchSize) {
            batch.push(cursor.value);
            cursor = await cursor.continue();
        }

        if (batch.length === 0) break;

        lastId = batch[batch.length - 1].message_id;

        yield batch;

        if (batch.length < batchSize) break;
    }
}

export async function getDateStortedMessagesByStatusIDB(newest: boolean, limit: number, status: DBMessageStatus, skipCache = false) {

    const tx = db.transaction("messages", "readonly");
    const { store } = tx;
    const index = store.index("by_status");

    const direction = newest ? "prev" : "next";
    let cursor = await index.openCursor(IDBKeyRange.only(status), direction);

    if (!cursor) {
        console.log("No messages found");
        return [];
    }

    const messages: DBMessageRecord[] = [];
    while (cursor) {
        messages.push(cursor.value);
        if (messages.length >= limit) break;
        cursor = await cursor.continue();
    }

    return messages;
}

export async function getMessagesByChannelAndAfterTimestampIDB(channel_id: string, start: string, end?: string) {

    const tx = db.transaction("messages", "readonly");
    const { store } = tx;
    const index = store.index("by_timestamp_and_message_id");

    const range = end
        ? IDBKeyRange.bound([channel_id, start], [channel_id, end])
        : IDBKeyRange.bound([channel_id, start], [channel_id, "\uffff"]);

    let cursor = await index.openCursor(range);

    if (!cursor) {
        console.log("No messages found in range");
        return [];
    }

    const messages: DBMessageRecord[] = [];
    while (cursor) {
        messages.push(cursor.value);
        cursor = await cursor.continue();
    }

    return messages;
}

export async function addMessageIDB(message: LoggedMessageJSON, status: DBMessageStatus) {

    await db.put("messages", {
        channel_id: message.channel_id,
        message_id: message.id,
        status,
        message,
    });
}

export async function addMessagesBulkIDB(messages: LoggedMessageJSON[], status?: DBMessageStatus) {

    const tx = db.transaction("messages", "readwrite");
    const { store } = tx;

    await Promise.all([
        ...messages.map(message => store.add({
            channel_id: message.channel_id,
            message_id: message.id,
            status: status ?? getMessageStatus(message),
            message,
        })),
        tx.done
    ]);
}

export async function deleteMessageIDB(message_id: string) {

    await db.delete("messages", message_id);
}

export async function deleteMessagesBulkIDB(message_ids: string[]) {

    const tx = db.transaction("messages", "readwrite");
    const { store } = tx;

    await Promise.all([...message_ids.map(id => store.delete(id)), tx.done]);
}

// deleting db is instant. fallback to chunked deletion if the delete fails.
export async function clearMessagesIDB() {

    const deleted = await new Promise<boolean>(resolve => {
        db.close();
        const req = indexedDB.deleteDatabase(DB_NAME);
        req.onsuccess = () => resolve(true);
        req.onerror = () => resolve(false);
    });

    await initIDB();
    if (!deleted) await clearMessagesChunkedIDB();
}

// faster than db.clear on large dbs
async function clearMessagesChunkedIDB() {
    const CLEAR_BATCH_SIZE = 5000;
    while (true) {
        const tx = db.transaction("messages", "readwrite", { durability: "relaxed" });
        const { store } = tx;
        const keys = (await store.getAllKeys(undefined, CLEAR_BATCH_SIZE)) as string[];
        if (keys.length === 0) {
            await tx.done;
            break;
        }

        const range = IDBKeyRange.bound(keys[0], keys[keys.length - 1]);
        await Promise.all([store.delete(range), tx.done]);
    }
}

export async function searchMessagesIDB(
    status: DBMessageStatus,
    newest: boolean,
    query: string,
    limit: number,
    offset = 0
) {

    const tx = db.transaction("messages", "readonly");
    const { store } = tx;
    const index = store.index("by_status");

    const direction = newest ? "prev" : "next";
    let cursor = await index.openCursor(IDBKeyRange.only(status), direction);

    const { queries, rest } = tokenizeQuery(query);

    const matchedMessages: DBMessageRecord[] = [];
    let skipped = 0;

    while (cursor) {
        const record = cursor.value;

        let matches = true;
        for (const q of queries) {
            const matching = doesMatch(q.key, q.value, record.message);
            if (q.negate ? matching : !matching) {
                matches = false;
                break;
            }
        }

        if (matches) {
            const contentLower = record.message.content.toLowerCase();
            const matchesText = rest.every(r => contentLower.includes(r.toLowerCase()));

            if (matchesText) {
                if (skipped < offset) {
                    skipped++;
                } else {
                    matchedMessages.push(record);
                    if (matchedMessages.length >= limit) {
                        break;
                    }
                }
            }
        }

        cursor = await cursor.continue();
    }

    return {
        messages: matchedMessages,
        hasMore: cursor !== null
    };
}
