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
import { nativeFileSystemAccess } from "../../utils/filesystem";

const cl = classNameFactory("folder-upload");

export function ImageCacheDir() {
    if (!nativeFileSystemAccess) return null;

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


// you Can only select folders in desktop version
// so i can use DiscorNative RIGHT?
function SelectFolderInput({ onFolderSelect }: { onFolderSelect: (path: string) => void; }) {
    return (
        <div className={cl("-container")}>
            <div className={cl("-input")}>
                {settings.store.imageCacheDir === DEFAULT_IMAGE_CACHE_DIR ? "Choose Folder" : settings.store.imageCacheDir}
            </div>
            <Button
                className={cl("-button")}
                size={Button.Sizes.SMALL}
                onClick={async () => {
                    const [path] = await DiscordNative.fileManager.showOpenDialog({ properties: ["openDirectory", "single"] });
                    if (!path) return;

                    onFolderSelect(path);
                }}
            >
                Browse
            </Button>
        </div>
    );

}
