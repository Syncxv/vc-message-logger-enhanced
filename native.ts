/*
 * Vencord, a Discord client mod
 * Copyright (c) 2023 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { execFile as cpExecFile } from "node:child_process";
import { access, mkdir, readdir, readFile, unlink, writeFile } from "node:fs/promises";
import path, { join } from "node:path";
import { promisify } from "node:util";

import { Queue } from "@utils/Queue";
import { dialog, IpcMainInvokeEvent } from "electron";

import { serializeErrors } from "../../main/updater/common";
import { DATA_DIR } from "../../main/utils/constants";

// so we can filter the native helpers by this key
export function messageLoggerEnhancedUniqueIdThingyIdkMan() { }

// Map<attachmetId, path>()
const nativeSavedImages = new Map<string, string>();
export const getNativeSavedImages = () => nativeSavedImages;

export async function init(_event: IpcMainInvokeEvent, imageCacheDir?: string) {
    if (!imageCacheDir) imageCacheDir = await getDefaultNativeImageDir();

    if (nativeSavedImages.size > 0) nativeSavedImages.clear();

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
    if (!logsDir) logsDir = await getDefaultNativeDataDir();

    await ensureDirectoryExists(logsDir);
    try {
        return JSON.parse(await readFile(path.join(logsDir, LOGS_DATA_FILENAME), "utf-8"));
    } catch { }

    return null;
}

export async function writeLogs(_event: IpcMainInvokeEvent, logsDir: string, contents: string) {
    if (!logsDir) logsDir = await getDefaultNativeDataDir();

    dataWriteQueue.push(() => writeFile(path.join(logsDir, LOGS_DATA_FILENAME), contents));
}


export async function getDefaultNativeImageDir(): Promise<string> {
    return path.join(await getDefaultNativeDataDir(), "savedImages");
}

export async function getDefaultNativeDataDir(): Promise<string> {
    return path.join(DATA_DIR, "MessageLoggerData");
}

export async function showDirDialog() {
    const res = await dialog.showOpenDialog({ properties: ["openDirectory"] });
    return res.filePaths;
}


// utils

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

let cwd: string | null = null;

async function getCwd() {
    if (cwd) return cwd;

    const VENCORD_USER_PLUGIN_DIR = join(__dirname, "..", "src", "userplugins");
    const dirs = await readdir(VENCORD_USER_PLUGIN_DIR, { withFileTypes: true });

    for (const dir of dirs) {
        if (!dir.isDirectory()) continue;

        const pluginDir = join(VENCORD_USER_PLUGIN_DIR, dir.name);
        const files = await readdir(pluginDir);

        if (files.includes("LoggedMessageManager.ts")) return cwd = join(VENCORD_USER_PLUGIN_DIR, dir.name);
    }


    // how did we get here
    throw new Error("Couldn't find plugin directory");
}

// its messy but none of these are exported so i gotta just copy paste it :pensive:

const execFile = promisify(cpExecFile);

const isFlatpak = process.platform === "linux" && Boolean(process.env.FLATPAK_ID?.includes("discordapp") || process.env.FLATPAK_ID?.includes("Discord"));

if (process.platform === "darwin") process.env.PATH = `/usr/local/bin:${process.env.PATH}`;


async function git(...args: string[]) {
    const opts = { cwd: await getCwd() };

    if (isFlatpak) return execFile("flatpak-spawn", ["--host", "git", ...args], opts);
    else return execFile("git", args, opts);
}


export const pull = serializeErrors(async () => {
    const res = await git("pull");
    return res.stdout.includes("Fast-forward");
});


export const build = serializeErrors(async () => {
    const opts = { cwd: await getCwd() };

    const command = isFlatpak ? "flatpak-spawn" : "node";
    const args = isFlatpak ? ["--host", "node", "scripts/build/build.mjs"] : ["scripts/build/build.mjs"];

    const res = await execFile(command, args, opts);

    return !res.stderr.includes("Build failed");
});



export const calculateGitChanges = serializeErrors(async () => {
    await git("fetch");

    const branch = await git("branch", "--show-current");

    const res = await git("log", `HEAD...origin/${branch.stdout.trim()}`, "--pretty=format:%an/%h/%s");

    const commits = res.stdout.trim();
    return commits ? commits.split("\n").map(line => {
        const [author, hash, ...rest] = line.split("/");
        return {
            hash, author, message: rest.join("/")
        };
    }) : [];
});


export const getRepo = serializeErrors(async () => {
    const opts = { cwd: await getCwd() };

    const res = await execFile("git", ["remote", "get-url", "origin"], opts);

    return res.stdout.trim()
        .replace(/git@(.+):/, "https://$1/")
        .replace(/\.git$/, "");
});


export const getCurrentHash = serializeErrors(async () => {
    const opts = { cwd: await getCwd() };

    const res = await execFile("git", ["rev-parse", "HEAD"], opts);

    return res.stdout.trim();
});


export const testError = serializeErrors(async () => {
    const opts = { cwd: await getCwd() };

    const res = await execFile("git", ["remotezzz", "get-url", "origin"], opts);

    return res.stdout.trim()
        .replace(/git@(.+):/, "https://$1/")
        .replace(/\.git$/, "");
});


