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
import { closeAllModals, ModalContent, ModalFooter, ModalHeader, ModalProps, ModalRoot, ModalSize, openModal } from "@utils/modal";
import { LazyComponent, useAwaiter } from "@utils/react";
import { find, findLazy } from "@webpack";
import { Alerts, Button, ChannelStore, ContextMenu, FluxDispatcher, Forms, Menu, NavigationRouter, TabBar, Text, TextInput, useCallback, useMemo, useRef, useState } from "@webpack/common";
import { User } from "discord-types/general";
import moment from "moment";

import { settings } from "..";
import { clearLogs, defaultLoggedMessages, getLoggedMessages, removeLog } from "../LoggedMessageManager";
import { LoggedMessage, LoggedMessageJSON, LoggedMessages } from "../types";
import { mapEditHistory } from "../utils";
import { doesMatch, parseQuery } from "../utils/parseQuery";



export interface MessagePreviewProps {
    className: string;
    author: User;
    message: LoggedMessage;
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


interface Props {
    modalProps: ModalProps;
    initalQuery?: string;
}
export function LogsModal({ modalProps, initalQuery }: Props) {
    const [x, setX] = useState(0);
    const forceUpdate = () => setX(e => e + 1);

    const [logs, _, pending] = useAwaiter(getLoggedMessages, {
        fallbackValue: defaultLoggedMessages,
        deps: [x]
    });
    const [currentTab, setCurrentTab] = useState(LogTabs.DELETED);
    const [query, setQuery] = useState(initalQuery ?? "");
    const [sortNewest, setSortNewest] = useState(settings.store.sortNewest);
    const contentRef = useRef<HTMLDivElement | null>(null);

    console.log(logs, _, pending, contentRef);

    return (
        <ModalRoot className={cl("root")} {...modalProps} size={ModalSize.LARGE}>
            <ModalHeader className={cl("header")}>
                <TextInput value={query} onChange={e => setQuery(e)} style={{ width: "100%" }} placeholder="Filter Messages" />
                <TabBar
                    type="top"
                    look="brand"
                    className={cl("tab-bar")}
                    selectedItem={currentTab}
                    onItemSelect={e => {
                        setCurrentTab(e);
                        contentRef.current?.firstElementChild?.scrollTo(0, 0);
                        // forceUpdate();
                    }}
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
            <div className={cl("content-container")} ref={contentRef}>
                <ModalContent
                    className={cl("content")}
                >
                    <LogsContent
                        messages={
                            currentTab === LogTabs.DELETED
                                ? Object.values(logs?.deletedMessages ?? {})
                                : Object.values(logs?.editedMessages ?? {})
                        }
                        tab={currentTab}
                        logs={logs}
                        forceUpdate={forceUpdate}
                        query={query}
                        sortNewest={sortNewest}
                    />
                </ModalContent>
            </div>
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
                <Button
                    look={Button.Looks.LINK}
                    color={Button.Colors.PRIMARY}
                    onClick={() => {
                        setSortNewest(e => {
                            const val = !e;
                            settings.store.sortNewest = val;
                            return val;
                        });
                        contentRef.current?.firstElementChild?.scrollTo(0, 0);
                    }}
                >
                    Sort {sortNewest ? "Oldest First" : "Newest First"}
                </Button>
            </ModalFooter>
        </ModalRoot>
    );
}

interface LogContentProps {
    logs: LoggedMessages | null,
    query: string;
    sortNewest: boolean;
    messages: string[],
    tab: LogTabs;
    forceUpdate: () => void;
}
function LogsContent({ logs, query: queryEh, messages, sortNewest, tab, forceUpdate, }: LogContentProps) {
    const [numDisplayedMessages, setNumDisplayedMessages] = useState(50);
    const handleLoadMore = useCallback(() => {
        setNumDisplayedMessages(prevNum => prevNum + 50);
    }, []);

    if (logs == null || messages.length === 0)
        return (
            <div className={cl("empty-logs", "content-inner")}>
                <Forms.FormText variant="text-lg/normal" style={{ textAlign: "center" }}>
                    Empty eh
                </Forms.FormText>
            </div>
        );



    console.time("hi");

    const { success, type, id, query } = parseQuery(queryEh);

    const flattendAndfilteredAndSortedMessages = messages
        .flat()
        .filter(m => logs[m]?.message != null && (success === false ? true : doesMatch(type!, id!, logs[m].message!)))
        .filter(m => logs[m]?.message?.content?.toLowerCase()?.includes(query.toLowerCase()) ?? logs[m].message?.editHistory?.map(m => m.content?.toLowerCase()).includes(query.toLowerCase()))
        .sort((a, b) => {
            const timestampA = new Date(logs[a]?.message?.timestamp ?? "2023-07-20T15:34:29.064Z").getTime();
            const timestampB = new Date(logs[b]?.message?.timestamp ?? "2023-07-20T15:34:29.064Z").getTime();
            return sortNewest ? timestampB - timestampA : timestampA - timestampB;
        });
    const visibleMessages = flattendAndfilteredAndSortedMessages.slice(0, numDisplayedMessages);

    const canLoadMore = numDisplayedMessages < flattendAndfilteredAndSortedMessages.length;

    if (visibleMessages.length === 0)
        return (
            <div className={cl("empty-logs", "content-inner")}>
                <Text variant="text-lg/normal" style={{ textAlign: "center", }}>
                    No results in <b>{tab === LogTabs.DELETED ? "deleted messages" : "edited message"}</b> maybe try <b>{tab === LogTabs.DELETED ? "edited message" : "deleted messages"}</b>
                </Text>
            </div>
        );

    console.timeEnd("hi");
    return (
        <div className={cl("content-inner")}>
            {visibleMessages
                .map((id, i) => (
                    <LMessage
                        key={id}
                        log={logs[id] as { message: LoggedMessageJSON; }}
                        forceUpdate={forceUpdate}
                        isGroupStart={isGroupStart(logs[id].message, logs[visibleMessages[i - 1]]?.message, sortNewest)}
                    />
                ))}
            {
                canLoadMore &&
                <Button
                    style={{ marginTop: "1rem", width: "100%" }}
                    size={Button.Sizes.SMALL} onClick={() => handleLoadMore()}
                >
                    Load More
                </Button>
            }
        </div>
    );
}

interface LMessageProps {
    log: { message: LoggedMessageJSON; };
    isGroupStart: boolean,
    forceUpdate: () => void;
}
function LMessage({ log, isGroupStart, forceUpdate, }: LMessageProps) {
    const message = useMemo(() => {
        const message: LoggedMessage = new MessageClass.Z(log.message);
        message.timestamp = moment(message.timestamp);

        const editHistory = message.editHistory?.map(mapEditHistory);
        if (editHistory && editHistory.length > 0) {
            message.editHistory = editHistory;
            message.editedTimestamp = moment(message.editedTimestamp);
        }
        message.author = new AuthorClass.Z(message.author);
        if ("globalName" in message.author) {
            (message.author as any).nick = message.author.globalName ?? message.author.username;
        } else {
            (message.author as any).nick = message.author.username;
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
                            closeAllModals();
                        }}
                    />

                    <Menu.MenuItem
                        key="copy-content"
                        id="copy-content"
                        label="Copy Content"
                        action={() => copyWithToast(message.content)}
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
                        key="copy-channel-id"
                        id="copy-channel-id"
                        label="Copy Channel ID"
                        action={() => copyWithToast(message.channel_id)}
                    />

                    {
                        log.message.guildId != null
                        && (
                            <Menu.MenuItem
                                key="copy-server-id"
                                id="copy-server-id"
                                label="Copy Server ID"
                                action={() => copyWithToast(log.message.guildId!)}
                            />
                        )
                    }

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
                isGroupStart={isGroupStart}
                hideSimpleEmbedContent={false}
            />
        </div>
    );
}

export const openLogModal = (initalQuery?: string) => openModal(modalProps => <LogsModal modalProps={modalProps} initalQuery={initalQuery} />);

function isGroupStart(
    currentMessage: LoggedMessageJSON | undefined,
    previousMessage: LoggedMessageJSON | undefined,
    sortNewest: boolean
) {
    if (!currentMessage || !previousMessage) return true;

    const [newestMessage, oldestMessage] = sortNewest
        ? [previousMessage, currentMessage]
        : [currentMessage, previousMessage];

    if (newestMessage.author.id !== oldestMessage.author.id) return true;

    const timeDifferenceInMinutes = Math.abs(
        (new Date(newestMessage.timestamp).getTime() - new Date(oldestMessage.timestamp).getTime()) / (1000 * 60)
    );

    return timeDifferenceInMinutes >= 5;
}
