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

import { Native, settings } from "../..";
import { DEFAULT_IMAGE_CACHE_DIR } from "../../utils/constants";

const cl = classNameFactory("folder-upload");

export function ImageCacheDir({ option }) {
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
            <Forms.FormTitle>{option.description}</Forms.FormTitle>
            <SelectFolderInput path={settings.store.imageCacheDir} onFolderSelect={onFolderSelect} />
        </Forms.FormSection>
    );
}

export function LogsDir({ option }) {
    function onFolderSelect(path: string) {
        settings.store.logsDir = path;

        Toasts.show({
            id: Toasts.genId(),
            type: Toasts.Type.SUCCESS,
            message: "Successfuly updated Logs Dir"
        });
    }

    return (
        <Forms.FormSection>
            <Forms.FormTitle>{option.description}</Forms.FormTitle>
            <SelectFolderInput path={settings.store.logsDir} onFolderSelect={onFolderSelect} />
        </Forms.FormSection>
    );
}

export function SelectFolderInput({ path, onFolderSelect }: { path: string, onFolderSelect: (path: string) => void; }) {
    return (
        <div className={cl("-container")}>
            <div className={cl("-input")}>
                {path == null || path === DEFAULT_IMAGE_CACHE_DIR ? "Choose Folder" : path}
            </div>
            <Button
                className={cl("-button")}
                size={Button.Sizes.SMALL}
                onClick={async () => {
                    const [path] = await Native.showDirDialog();
                    if (!path) return;

                    onFolderSelect(path);
                }}
            >
                Browse
            </Button>
        </div>
    );

}
