import { DB_NAME, DB_VERSION } from "./utils/constants";
import { DBSchema, IDBPDatabase, openDB } from "./utils/idb";
import { LoggedMessageJSON } from "./types";

export enum DBMessageStatus {
    DELETED = "DELETED",
    EDITED = "EDITED",
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
            by_channel_and_message_id: [string, string];
        };
    };

}

export let db: IDBPDatabase<MLIDB>;
export const cachedMessages = new Map<string, LoggedMessageJSON>();

function cacheRecords(records: DBMessageRecord[]) {
    records.forEach(r => cachedMessages.set(r.message_id, r.message));
    return records;
}

function cacheRecord(record?: DBMessageRecord | null) {
    if (!record) return record;

    cachedMessages.set(record.message_id, record.message);
    return record;
}

export async function initIDB() {
    db = await openDB<MLIDB>(DB_NAME, DB_VERSION, {
        upgrade(db) {
            const messageStore = db.createObjectStore("messages", { keyPath: "message_id" });
            messageStore.createIndex("by_channel_id", "channel_id");
            messageStore.createIndex("by_status", "status");
            messageStore.createIndex("by_timestamp", "message.timestamp");
            messageStore.createIndex("by_channel_and_message_id", ["channel_id", "message_id"]);

        }
    });
}
initIDB();

export async function getAllMessagesIDB() {
    return cacheRecords(await db.getAll("messages"));
}

export async function getMessagesForChannelIDB(channel_id: string) {
    return cacheRecords(await db.getAllFromIndex("messages", "by_channel_id", channel_id));
}

export async function getMessageIDB(message_id: string) {
    return cacheRecord(await db.get("messages", message_id));
}

export async function getMessagesByStatusIDB(status: DBMessageStatus) {
    return cacheRecords(await db.getAllFromIndex("messages", "by_status", status));
}

export async function getDateStortedMessages(newest: boolean) {
    return cacheRecords(await db.getAllFromIndex("messages", "by_timestamp", newest ? "prev" : "next"));
}


export async function getMessagesByChannelBetweenIDB(channel_id: string, start: string, end: string) {
    const tx = db.transaction("messages", "readonly");
    const store = tx.store;
    const index = store.index("by_channel_and_message_id");

    const [lower, upper] = start <= end ? [start, end] : [end, start];
    const keyRange = IDBKeyRange.bound([channel_id, lower], [channel_id, upper]);

    const records = await index.getAll(keyRange);

    return cacheRecords(records);
}

export async function addMessageIDB(message: LoggedMessageJSON, status: DBMessageStatus) {
    await db.put("messages", {
        channel_id: message.channel_id,
        message_id: message.id,
        status,
        message,
    });

    cachedMessages[message.id] = message;
}

export async function deleteMessageIDB(message_id: string) {
    await db.delete("messages", message_id);

    cachedMessages.delete(message_id);
}

export async function deleteMessagesIDB(message_ids: string[]) {
    const tx = db.transaction("messages", "readwrite");
    const store = tx.store;

    await Promise.all([...message_ids.map(id => store.delete(id)), tx.done]);
    message_ids.forEach(id => cachedMessages.delete(id));
}