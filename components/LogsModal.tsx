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
import { ModalContent, ModalFooter, ModalHeader, ModalProps, ModalRoot, ModalSize, openModal } from "@utils/modal";
import { LazyComponent, useAwaiter } from "@utils/react";
import { find, findLazy } from "@webpack";
import { Alerts, Button, ChannelStore, ContextMenu, FluxDispatcher, Forms, Menu, NavigationRouter, TabBar, TextInput, useCallback, useMemo, useState } from "@webpack/common";
import { Message, User } from "discord-types/general";
import moment from "moment";

import { clearLogs, defaultLoggedMessages, getLoggedMessages, removeLog } from "../LoggedMessageManager";
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
    const [x, setX] = useState(0);
    const forceUpdate = () => setX(e => e + 1);
    const [logs, _, pending] = useAwaiter(getLoggedMessages, {
        fallbackValue: defaultLoggedMessages,
        deps: [x]
    });
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
                <LogsContent logs={logs} tab={currentTab} forceUpdate={forceUpdate} onClose={modalProps.onClose} />
            </ModalContent>
            <ModalFooter>
                <Button
                    color={Button.Colors.RED}
                    onClick={() => Alerts.show({
                        title: "Clear Logs",
                        body: "Are you sure you want to delete all the logs",
                        confirmText: "Clear",
                        confirmColor: Button.Colors.RED,
                        cancelText: "Cancel",
                        onConfirm: async () => {
                            await clearLogs();
                            forceUpdate();
                        }

                    })}
                >
                    Clear Logs
                </Button>
            </ModalFooter>
        </ModalRoot>
    );
}

interface LogContentProps {
    logs: LoggedMessages | null,
    tab: "deletedMessages" | "editedMessages";
    forceUpdate: () => void;
    onClose: () => void;
}
function LogsContent({ logs, tab, forceUpdate, onClose }: LogContentProps) {
    const [numDisplayedMessages, setNumDisplayedMessages] = useState(50);
    const handleLoadMore = useCallback(() => {
        setNumDisplayedMessages(prevNum => prevNum + 50);
    }, []);

    const messages = tab === "deletedMessages" ? Object.values(logs?.deletedMessages ?? {}) : Object.values(logs?.editedMessages ?? {});
    const flattenedMessages = messages.flat().slice(0, numDisplayedMessages);
    if (logs == null || messages.length === 0)
        return (
            <div className={cl("empty-logs")}>
                <Forms.FormText variant="text-lg/normal" style={{ textAlign: "center" }}>
                    Empty eh
                </Forms.FormText>
            </div>
        );

    const canLoadMore = numDisplayedMessages < messages.flat().length;

    return (
        <div className={cl("content-inner")}>
            {flattenedMessages.map(id => (
                <LMessage key={id} log={logs[id] as { message: LoggedMessage; }} forceUpdate={forceUpdate} onClose={onClose} />
            ))}
            {canLoadMore && <Button style={{ marginTop: "1rem", width: "100%" }} size={Button.Sizes.SMALL} onClick={() => handleLoadMore()}>Load More</Button>}
        </div>
    );
}

interface LMessageProps { log: { message: LoggedMessage; }; forceUpdate: () => void; onClose: () => void; }
function LMessage({ log, forceUpdate, onClose }: LMessageProps) {
    const message = useMemo(() => {
        const message: LoggedMessage = new MessageClass.Z(log.message);
        message.timestamp = moment(message.timestamp);
        message.editedTimestamp = moment(message.editedTimestamp);
        const editHistory = message.editHistory?.map(mapEditHistory);
        if (editHistory) message.editHistory = editHistory;
        message.author = new AuthorClass.Z(message.author);
        if ("globalName" in message.author) {
            (message.author as any).nick = message.author.globalName ?? message.author.username;
        }
        return message;
    }, [log]);
    return (
        <div onContextMenu={e => {
            ContextMenu.open(e, () =>
                <Menu.Menu
                    navId="gif-collection-id"
                    onClose={() => FluxDispatcher.dispatch({ type: "CONTEXT_MENU_CLOSE" })}
                    aria-label="Gif Collections"
                >
                    <Menu.MenuItem
                        key="jump-to-message"
                        id="jump-to-message"
                        label="Jump To Message"
                        action={() => {
                            NavigationRouter.transitionTo(`/channels/${ChannelStore.getChannel(message.channel_id)?.guild_id ?? "@me"}/${message.channel_id}${message.id ? "/" + message.id : ""}`);
                            onClose();
                        }}
                    />

                    <Menu.MenuItem
                        key="copy-user-id"
                        id="copy-user-id"
                        label="Copy User ID"
                        action={() => copyWithToast(message.author.id)}
                    />

                    <Menu.MenuItem
                        key="copy-message-id"
                        id="copy-message-id"
                        label="Copy Message ID"
                        action={() => copyWithToast(message.id)}
                    />

                    <Menu.MenuItem
                        key="copy-content"
                        id="copy-content"
                        label="Copy Content"
                        action={() => copyWithToast(message.content)}
                    />

                    <Menu.MenuItem
                        key="delete-log"
                        id="delete-log"
                        label="Delete Log"
                        color="danger"
                        action={() => removeLog(log.message.id).then(() => forceUpdate())}
                    />


                </Menu.Menu>
            );
        }}>
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
