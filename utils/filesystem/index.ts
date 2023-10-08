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

import * as indexeddbFS from "./indexeddb-fs";

interface FileSystem {
    readFile(filename: string, encoding?: string): Promise<string | Buffer>;
    writeFile(filename: string, data: string | Uint8Array, encoding?: string): Promise<void>;
    deleteFile(filename: string): Promise<void>;
    access(path: string, mode?: number): Promise<void>;
    mkdir(path: string): Promise<void>;
    listFiles(): Promise<IDBValidKey[]>;
}

let fileSystem: FileSystem;

export function hasAccessToFileSystem() {
    const req = window.require;
    if (!req) return false;

    const fs = req("node:fs/promises");
    if (fs == null || fs.readFile == null || fs.writeFile == null) return false;
    return true;
}

export const nativeFileSystemAccess = hasAccessToFileSystem();

if (nativeFileSystemAccess) {
    try {
        fileSystem = window.require("node:fs/promises");
    } catch (err) {
        console.error("failed to get node fs", err);
        fileSystem = indexeddbFS as FileSystem;
    }
} else {
    fileSystem = indexeddbFS as FileSystem;
}

export const { readFile, writeFile, deleteFile, listFiles, access, mkdir } = fileSystem;

export async function exists(filename: string) {
    try {
        await access(filename);
        return true;
    } catch (error) {
        return false;
    }
}
