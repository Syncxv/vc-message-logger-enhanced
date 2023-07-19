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
import { ModalContent, ModalFooter, ModalHeader, ModalProps, ModalRoot, ModalSize, openModal } from "@utils/modal";
import { LazyComponent, useAwaiter } from "@utils/react";
import { find, findLazy } from "@webpack";
import { Button, Forms, TabBar, TextInput, useMemo, useState } from "@webpack/common";
import { Message, User } from "discord-types/general";
import moment from "moment";

import { getLoggedMessages } from "../LoggedMessageManager";
import { LoggedMessage, LoggedMessages } from "../types";
import { mapEditHistory } from "../utils";

interface Props {
    modalProps: ModalProps;
}

export interface MessagePreviewProps {
    className: string;
    author: User;
    message: Message;
    compact: boolean;
    isGroupStart: boolean;
    hideSimpleEmbedContent: boolean;
}

const MessagePreview: React.FC<MessagePreviewProps> = LazyComponent(() => find(m => m?.type?.toString().includes("previewLinkTarget:") && !m?.type?.toString().includes("HAS_THREAD")));
const MessageClass: any = findLazy(m => m?.Z?.prototype?.isEdited);
const AuthorClass = findLazy(m => m?.Z?.prototype?.getAvatarURL);

const cl = classNameFactory("msg-logger-modal-");

enum LogTabs {
    DELETED = "deletedMessages",
    EDITED = "editedMessages"
}
export function LogsModal({ modalProps }: Props) {
    const [logs, _, pending] = useAwaiter(getLoggedMessages);
    const [currentTab, setCurrentTab] = useState(LogTabs.DELETED);
    console.log(logs, _, pending);

    return (
        <ModalRoot {...modalProps} size={ModalSize.LARGE}>
            <ModalHeader className={cl("header")}>
                <TextInput style={{ width: "100%" }} placeholder="Filter Messages" />
                <TabBar
                    type="top"
                    look="brand"
                    className={cl("tab-bar")}
                    selectedItem={currentTab}
                    onItemSelect={setCurrentTab}
                >
                    <TabBar.Item
                        className={cl("tab-bar-item")}
                        id={LogTabs.DELETED}
                    >
                        Deleted
                    </TabBar.Item>
                    <TabBar.Item
                        className={cl("tab-bar-item")}
                        id={LogTabs.EDITED}
                    >
                        Edited
                    </TabBar.Item>
                </TabBar>
            </ModalHeader>
            <ModalContent className={cl("content")}>
                <LogsContent logs={logs} tab={currentTab} />
            </ModalContent>
            <ModalFooter>
                <Button>Cool</Button>
            </ModalFooter>
        </ModalRoot>
    );
}


function LogsContent({ logs, tab }: { logs: LoggedMessages | null, tab: "deletedMessages" | "editedMessages"; }) {
    if (logs == null)
        return (
            <div className={cl("empty-logs")}>
                <Forms.FormText variant="text-lg/normal" style={{ textAlign: "center" }}>
                    Logs are empty
                </Forms.FormText>
            </div>
        );

    // this is shit but ill figure something out later
    const messages = tab === "deletedMessages" ? Object.values(logs.deletedMessages) : Object.values(logs.editedMessages);
    const flattenedMessages = messages.flat().slice(0, 50);

    return (
        <div className={cl("content-inner")}>
            {flattenedMessages.map(id => (
                <LMessage key={id} log={logs[id] as { message: LoggedMessage; }} />
            ))}
        </div>
    );
}


function LMessage({ log }: { log: { message: LoggedMessage; }; }) {
    const message = useMemo(() => {
        const message: LoggedMessage = new MessageClass.Z(log.message);
        message.timestamp = moment(message.timestamp);
        message.editedTimestamp = moment(message.editedTimestamp);
        const editHistory = message.editHistory?.map(mapEditHistory);
        if (editHistory) message.editHistory = editHistory;
        message.author = new AuthorClass.Z(message.author);
        return message;
    }, [log]);
    return (
        <div onContextMenu={() => console.log("HI")}>
            <MessagePreview
                className={`${cl("msg-preview")} ${message.deleted ? "messagelogger-deleted" : ""}`}
                author={message.author}
                message={message}
                compact={false}
                isGroupStart={true}
                hideSimpleEmbedContent={false}
            />
        </div>
    );
}

export const openLogModal = () => openModal(modalProps => <LogsModal modalProps={modalProps} />);
