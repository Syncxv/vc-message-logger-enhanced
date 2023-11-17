/*
 * Vencord, a Discord client mod
 * Copyright (c) 2023 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { access, mkdir, readdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

import { Queue } from "@utils/Queue";
import { dialog, IpcMainInvokeEvent } from "electron";

import { DATA_DIR } from "../../main/utils/constants";

// Map<attachmetId, path>()
const nativeSavedImages = new Map<string, string>();
export const getNativeSavedImages = () => nativeSavedImages;

export async function init(_event: IpcMainInvokeEvent, imageCacheDir?: string) {
    if (!imageCacheDir) imageCacheDir = await getDefaultNativeImageDir();

    await ensureDirectoryExists(imageCacheDir);
    const files = await readdir(imageCacheDir);
    for (const filename of files) {
        const attachmentId = getAttachmentIdFromFilename(filename);
        nativeSavedImages.set(attachmentId, path.join(imageCacheDir, filename));
    }
}

export async function getImageNative(_event: IpcMainInvokeEvent, attachmentId: string) {
    const imagePath = nativeSavedImages.get(attachmentId);
    if (!imagePath) return null;
    return await readFile(imagePath);
}

export async function writeImageNative(_event: IpcMainInvokeEvent, imageCacheDir: string, filename: string, content: Uint8Array) {
    if (!filename || !content) return;

    const attachmentId = getAttachmentIdFromFilename(filename);

    const existingImage = nativeSavedImages.get(attachmentId);
    if (existingImage) return;

    const imagePath = path.join(imageCacheDir, filename);
    await writeFile(imagePath, content);

    nativeSavedImages.set(attachmentId, imagePath);
}

export async function deleteFileNative(_event: IpcMainInvokeEvent, attachmentId: string) {
    const imagePath = nativeSavedImages.get(attachmentId);
    if (!imagePath) return;

    await unlink(imagePath);
}

const LOGS_DATA_FILENAME = "message-logger-logs.json";
const dataWriteQueue = new Queue();

export async function getLogsFromFs(_event: IpcMainInvokeEvent, logsDir: string) {
    if (!logsDir) logsDir = await getDefaultNativeLogsDir();

    await ensureDirectoryExists(logsDir);
    try {
        return JSON.parse(await readFile(path.join(logsDir, LOGS_DATA_FILENAME), "utf-8"));
    } catch { }

    return null;
}

export async function writeLogs(_event: IpcMainInvokeEvent, logsDir: string, contents: string) {
    if (!logsDir) logsDir = await getDefaultNativeLogsDir();

    dataWriteQueue.push(() => writeFile(path.join(logsDir, LOGS_DATA_FILENAME), contents));
}


export async function getDefaultNativeImageDir(): Promise<string> {
    return path.join(DATA_DIR, "savedImages");
}

export async function getDefaultNativeLogsDir(): Promise<string> {
    return path.join(DATA_DIR, "MessageLoggerData");
}

export async function showDirDialog() {
    const res = await dialog.showOpenDialog({ properties: ["openDirectory"] });
    return res.filePaths;
}

async function exists(filename: string) {
    try {
        await access(filename);
        return true;
    } catch (error) {
        return false;
    }
}

async function ensureDirectoryExists(cacheDir: string) {
    if (!await exists(cacheDir))
        await mkdir(cacheDir);
}

function getAttachmentIdFromFilename(filename: string) {
    return path.parse(filename).name;
}
