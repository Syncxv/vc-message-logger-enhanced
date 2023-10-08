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

import {
    createStore,
    del,
    entries,
    get,
    keys,
    set,
    UseStore,
} from "@api/DataStore";

const defaultStore = createStore("MessageLoggerImageData", "MessageLoggerImageStore");

async function getCustomStore(customStore?: UseStore): Promise<UseStore> {
    return customStore || defaultStore;
}

export const mkdir = async (path: string) => { };

export async function access(filename: string, mode?: number, customStore?: UseStore): Promise<void> {
    const store = await getCustomStore(customStore);
    const fileKeys = await keys(store);
    if (fileKeys.includes(filename)) return;
    throw Error("doesnt exist eh");
}

export async function readFile(filename: string, customStore?: UseStore): Promise<any> {
    const store = await getCustomStore(customStore);
    return get(filename, store);
}

export async function writeFile(filename: string, content: any, customStore?: UseStore): Promise<void> {
    const store = await getCustomStore(customStore);
    await set(filename, content, store);
}

export async function deleteFile(filename: string, customStore?: UseStore): Promise<void> {
    const store = await getCustomStore(customStore);
    await del(filename, store);
}

export async function listFiles(customStore?: UseStore): Promise<IDBValidKey[]> {
    const store = await getCustomStore(customStore);
    return keys(store);
}

export async function listFilesAndContents(customStore?: UseStore): Promise<[IDBValidKey, any][]> {
    const store = await getCustomStore(customStore);
    return entries(store);
}
