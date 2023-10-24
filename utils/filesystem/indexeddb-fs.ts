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


let defaultGetStoreFunc: UseStore;

function defaultGetStore() {
    if (!defaultGetStoreFunc) {
        defaultGetStoreFunc = createStore("MessageLoggerImageData", "MessageLoggerImageStore");
    }
    return defaultGetStoreFunc;
}


export const mkdir = async (path: string) => { };

export async function access(filename: string, mode?: number, customStore = defaultGetStore()): Promise<void> {
    const fileKeys = await keys(customStore);
    if (fileKeys.includes(filename)) return;
    throw Error("doesnt exist eh");
}

export async function readFile(filename: string, customStore = defaultGetStore()): Promise<any> {
    return get(filename, customStore);
}

export async function writeFile(filename: string, content: any, customStore = defaultGetStore()): Promise<void> {
    await set(filename, content, customStore);
}

export async function deleteFile(filename: string, customStore = defaultGetStore()): Promise<void> {
    await del(filename, customStore);
}

export async function listFiles(customStore = defaultGetStore()): Promise<IDBValidKey[]> {
    return keys(customStore);
}

export async function listFilesAndContents(customStore = defaultGetStore()): Promise<[IDBValidKey, any][]> {
    return entries(customStore);
}
