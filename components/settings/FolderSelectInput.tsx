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
import { copyWithToast } from "@utils/misc";
import { Button, Forms, Toasts } from "@webpack/common";

import { Native, settings } from "../..";
import { DEFAULT_IMAGE_CACHE_DIR } from "../../utils/constants";

const cl = classNameFactory("folder-upload");

function createDirSelector(settingKey: "logsDir" | "imageCacheDir", successMessage: string) {
    return function DirSelector({ option }) {
        if (IS_WEB) return null;

        function onFolderSelect(path: string) {
            settings.store[settingKey] = path;

            Toasts.show({
                id: Toasts.genId(),
                type: Toasts.Type.SUCCESS,
                message: successMessage
            });
        }

        return (
            <Forms.FormSection>
                <Forms.FormTitle>{option.description}</Forms.FormTitle>
                <SelectFolderInput path={settings.store[settingKey]} onFolderSelect={onFolderSelect} />
            </Forms.FormSection>
        );
    };
}

export const ImageCacheDir = createDirSelector("imageCacheDir", "Successfully updated Image Cache Dir");
export const LogsDir = createDirSelector("logsDir", "Successfully updated Logs Dir");


export function SelectFolderInput({ path, onFolderSelect }: { path: string, onFolderSelect: (path: string) => void; }) {
    function getDirName(path: string) {
        const parts = path.split("\\").length > 1 ? path.split("\\") : path.split("/");

        return parts.slice(parts.length - 2, parts.length).join("\\");
    }
    return (
        <div className={cl("-container")}>
            <div onClick={() => copyWithToast(path)} className={cl("-input")}>
                {path == null || path === DEFAULT_IMAGE_CACHE_DIR ? "Choose Folder" : getDirName(path)}
            </div>
            <Button
                className={cl("-button")}
                size={Button.Sizes.SMALL}
                onClick={async () => {
                    const [resPath] = await Native.showDirDialog(path);
                    if (!resPath) return;

                    onFolderSelect(resPath);
                }}
            >
                Browse
            </Button>
        </div>
    );

}
