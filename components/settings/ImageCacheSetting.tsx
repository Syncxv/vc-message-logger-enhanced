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

import { classNameFactory } from "@api/Styles";
import { Button, Forms, Toasts } from "@webpack/common";

import { settings } from "../..";
import { DEFAULT_IMAGE_CACHE_DIR } from "../../utils/constants";

const cl = classNameFactory("folder-upload");

export function ImageCacheDir() {
    function onFolderSelect(path: string) {
        settings.store.imageCacheDir = path;

        Toasts.show({
            id: Toasts.genId(),
            type: Toasts.Type.SUCCESS,
            message: "Successfuly updated Image Cache Dir"
        });
    }

    return (
        <Forms.FormSection>
            <Forms.FormTitle>Select Image Cache Directory</Forms.FormTitle>
            <SelectFolderInput onFolderSelect={onFolderSelect} />
        </Forms.FormSection>
    );

}

function SelectFolderInput({ onFolderSelect }: { onFolderSelect: (path: string) => void; }) {
    const { imageCacheDir } = settings.store;
    return (
        <div className={cl("-container")}>
            <div className={cl("-input")}>
                {imageCacheDir == null || imageCacheDir === DEFAULT_IMAGE_CACHE_DIR ? "Choose Folder" : imageCacheDir}
            </div>
            <Button
                className={cl("-button")}
                size={Button.Sizes.SMALL}
                onClick={async () => {
                    const [path] = await showOpenDialog();
                    if (!path) return;

                    onFolderSelect(path);
                }}
            >
                Browse
            </Button>
        </div>
    );

}


async function showOpenDialog() {
    if (IS_VESKTOP)
        return window.MessageLoggerNative.fileManager.showOpenDialog({ properties: ["openDirectory", "single"] });

    return await DiscordNative.fileManager.showOpenDialog({ properties: ["openDirectory", "single"] });
}
