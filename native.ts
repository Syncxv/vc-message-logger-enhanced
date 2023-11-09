/*
 * Vencord, a Discord client mod
 * Copyright (c) 2023 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { access, mkdir, readdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

import type { IpcMainInvokeEvent } from "electron";

import { DATA_DIR } from "../../main/utils/constants";

// Map<attachmetId, path>()
const nativeSavedImages = new Map<string, string>();
export const getNativeSavedImages = () => nativeSavedImages;

export async function init(_event: IpcMainInvokeEvent, imageCacheDir?: string) {
    if (!imageCacheDir) imageCacheDir = await getDefaultNativePath();

    await checkImageCacheDir(imageCacheDir);
    const files = await readdir(imageCacheDir);
    for (const filename of files) {
        const attachmentId = path.parse(filename).name;
        nativeSavedImages.set(attachmentId, path.join(imageCacheDir, filename));
    }
}

export async function getImageNative(_event: IpcMainInvokeEvent, attachmentId: string) {
    const imagePath = nativeSavedImages.get(attachmentId);
    if (!imagePath) return null;
    return await readFile(imagePath);
}

export async function writeImageNative(_event: IpcMainInvokeEvent, attachmentId: string, imagePath: string, content: Uint8Array) {
    if (!attachmentId || !imagePath || !content) return;

    const existingImage = nativeSavedImages.get(attachmentId);
    if (existingImage) return;

    await checkImageCacheDir(imagePath);
    await writeFile(imagePath, content);

    nativeSavedImages.set(attachmentId, imagePath);
}

export async function deleteFileNative(_event: IpcMainInvokeEvent, attachmentId: string) {
    const imagePath = nativeSavedImages.get(attachmentId);
    if (!imagePath) return;

    await unlink(imagePath);
}

export async function getDefaultNativePath(): Promise<string> {
    return path.join(DATA_DIR, "savedImages");
}

async function exists(filename: string) {
    try {
        await access(filename);
        return true;
    } catch (error) {
        return false;
    }
}

async function checkImageCacheDir(cacheDir: string) {
    if (!await exists(cacheDir))
        await mkdir(cacheDir);
}

