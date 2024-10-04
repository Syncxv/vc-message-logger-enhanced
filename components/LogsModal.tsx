/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { classNameFactory } from "@api/Styles";
import { openUserProfile } from "@utils/discord";
import { copyWithToast } from "@utils/misc";
import { closeAllModals, ModalContent, ModalFooter, ModalHeader, ModalProps, ModalRoot, ModalSize, openModal } from "@utils/modal";
import { LazyComponent, useAwaiter } from "@utils/react";
import { find, findByCode, findByCodeLazy } from "@webpack";
import { Alerts, Button, ChannelStore, ContextMenuApi, FluxDispatcher, Menu, NavigationRouter, React, TabBar, Text, TextInput, useMemo, useRef, useState } from "@webpack/common";
import { User } from "discord-types/general";

import { clearMessagesIDB, DBMessageRecord, DBMessageStatus, deleteMessageIDB, deleteMessagesIDB, getDateStortedMessagesByStatusIDB } from "../db";
import { settings } from "../index";
import { LoggedMessage, LoggedMessageJSON } from "../types";
import { messageJsonToMessageClass } from "../utils";



export interface MessagePreviewProps {
    className: string;
    author: User;
    message: LoggedMessage;
    compact: boolean;
    isGroupStart: boolean;
    hideSimpleEmbedContent: boolean;

    childrenAccessories: any;
}

export interface ChildrenAccProops {
    channelMessageProps: {
        compact: boolean;
        channel: any;
        message: LoggedMessage;
        groupId: string;
        id: string;
        isLastItem: boolean;
        isHighlight: boolean;
        renderContentOnly: boolean;
    };
    hasSpoilerEmbeds: boolean;
    isInteracting: boolean;
    isAutomodBlockedMessage: boolean;
    showClydeAiEmbeds: boolean;
}

const PrivateChannelRecord = findByCodeLazy(".is_message_request_timestamp,");
const MessagePreview = LazyComponent<MessagePreviewProps>(() => find(m => m?.type?.toString().includes("previewLinkTarget:") && !m?.type?.toString().includes("HAS_THREAD")));
const ChildrenAccessories = LazyComponent<ChildrenAccProops>(() => findByCode("channelMessageProps:{message:"));

const cl = classNameFactory("msg-logger-modal-");

enum LogTabs {
    DELETED = "Deleted",
    EDITED = "Edited",
    GHOST_PING = "Ghost Pinged"
}

interface Props {
    modalProps: ModalProps;
    initalQuery?: string;
}

export function LogsModal({ modalProps, initalQuery }: Props) {
    const [x, setX] = useState(0);
    const forceUpdate = () => setX(e => e + 1);


    const [currentTab, setCurrentTab] = useState(LogTabs.DELETED);
    const [queryEh, setQuery] = useState(initalQuery ?? "");
    const [sortNewest, setSortNewest] = useState(settings.store.sortNewest);
    const [numDisplayedMessages, setNumDisplayedMessages] = useState(50);
    const contentRef = useRef<HTMLDivElement | null>(null);

    const [messages, _, pending] = useAwaiter(() => {
        return getDateStortedMessagesByStatusIDB(sortNewest, numDisplayedMessages, currentTab === LogTabs.DELETED ? DBMessageStatus.DELETED : DBMessageStatus.EDITED);
    }, {
        deps: [sortNewest, numDisplayedMessages, currentTab],
        fallbackValue: []
    });

    console.log(messages);

    // Flogger.timeEnd("hi");
    return (
        <ModalRoot className={cl("root")} {...modalProps} size={ModalSize.LARGE}>
            <ModalHeader className={cl("header")}>
                <TextInput value={queryEh} onChange={e => setQuery(e)} style={{ width: "100%" }} placeholder="Filter Messages" />
                <TabBar
                    type="top"
                    look="brand"
                    className={cl("tab-bar")}
                    selectedItem={currentTab}
                    onItemSelect={e => {
                        setCurrentTab(e);
                        setNumDisplayedMessages(50);
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
                    <TabBar.Item
                        className={cl("tab-bar-item")}
                        id={LogTabs.GHOST_PING}
                    >
                        Ghost Pinged
                    </TabBar.Item>
                </TabBar>
            </ModalHeader>
            <div style={{ opacity: modalProps.transitionState === 1 ? "1" : "0" }} className={cl("content-container")} ref={contentRef}>
                {
                    modalProps.transitionState === 1 &&
                    <ModalContent
                        className={cl("content")}
                    >
                        {messages.length === 0 && <EmptyLogs />}
                        {!pending && messages !== null && messages.length > 0 && (
                            <LogsContentMemo
                                visibleMessages={messages}
                                canLoadMore={messages.length >= 50}
                                tab={currentTab}
                                sortNewest={sortNewest}
                                forceUpdate={forceUpdate}
                                handleLoadMore={() => setNumDisplayedMessages(e => e + 50)}
                            />
                        )}
                    </ModalContent>
                }
            </div>
            <ModalFooter>
                <Button
                    color={Button.Colors.RED}
                    onClick={() => Alerts.show({
                        title: "Clear Logs",
                        body: "Are you sure you want to clear all the logs",
                        confirmText: "Clear",
                        confirmColor: Button.Colors.RED,
                        cancelText: "Cancel",
                        onConfirm: async () => {
                            await clearMessagesIDB();
                            forceUpdate();
                        }

                    })}
                >
                    Clear All Logs
                </Button>
                <Button
                    style={{ marginRight: "16px" }}
                    color={Button.Colors.YELLOW}
                    disabled={messages?.length === 0}
                    onClick={() => Alerts.show({
                        title: "Clear Logs",
                        body: `Are you sure you want to clear ${messages.length} logs`,
                        confirmText: "Clear",
                        confirmColor: Button.Colors.RED,
                        cancelText: "Cancel",
                        onConfirm: async () => {
                            await deleteMessagesIDB(messages.map(e => e.message_id));
                            forceUpdate();
                        }
                    })}
                >
                    Clear Visible Logs
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
    sortNewest: boolean;
    tab: LogTabs;
    visibleMessages: DBMessageRecord[];
    canLoadMore: boolean;
    forceUpdate: () => void;
    handleLoadMore: () => void;
}

function LogsContent({ visibleMessages, canLoadMore, sortNewest, tab, forceUpdate, handleLoadMore }: LogContentProps) {
    if (visibleMessages.length === 0)
        return <NoResults tab={tab} />;

    return (
        <div className={cl("content-inner")}>
            {visibleMessages
                .map(({ message }, i) => (
                    <LMessage
                        key={message.id}
                        log={{ message }}
                        forceUpdate={forceUpdate}
                        isGroupStart={isGroupStart(message, visibleMessages[visibleMessages.length - 1].message, sortNewest)}
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

const LogsContentMemo = LazyComponent(() => React.memo(LogsContent));


function NoResults({ tab }: { tab: LogTabs; }) {
    const generateSuggestedTabs = (tab: LogTabs) => {
        switch (tab) {
            case LogTabs.DELETED:
                return { nextTab: LogTabs.EDITED, lastTab: LogTabs.GHOST_PING };
            case LogTabs.EDITED:
                return { nextTab: LogTabs.GHOST_PING, lastTab: LogTabs.DELETED };
            case LogTabs.GHOST_PING:
                return { nextTab: LogTabs.DELETED, lastTab: LogTabs.EDITED };
            default:
                return { nextTab: "", lastTab: "" };
        }
    };

    const { nextTab, lastTab } = generateSuggestedTabs(tab);

    return (
        <div className={cl("empty-logs", "content-inner")} style={{ textAlign: "center" }}>
            <Text variant="text-lg/normal">
                No results in <b>{tab}</b>.
            </Text>
            <Text variant="text-lg/normal" style={{ marginTop: "0.2rem" }}>
                Maybe try <b>{nextTab}</b> or <b>{lastTab}</b>
            </Text>
        </div>
    );
}

function EmptyLogs() {
    return (
        <div className={cl("empty-logs", "content-inner")} style={{ textAlign: "center" }}>
            <Text variant="text-lg/normal">
                Empty eh
            </Text>
        </div>
    );

}

interface LMessageProps {
    log: { message: LoggedMessageJSON; };
    isGroupStart: boolean,
    forceUpdate: () => void;
}
function LMessage({ log, isGroupStart, forceUpdate, }: LMessageProps) {
    const message = useMemo(() => messageJsonToMessageClass(log), [log]);

    // console.log(message);

    if (!message) return null;

    return (
        <div
            onContextMenu={e => {
                ContextMenuApi.openContextMenu(e, () =>
                    <Menu.Menu
                        navId="message-logger"
                        onClose={() => FluxDispatcher.dispatch({ type: "CONTEXT_MENU_CLOSE" })}
                        aria-label="Message Logger"
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
                            key="open-user-profile"
                            id="open-user-profile"
                            label="Open user profile"
                            action={() => {
                                closeAllModals();
                                openUserProfile(message.author.id);
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
                            action={() =>
                                deleteMessageIDB(log.message.id)
                                    .then(() => {
                                        forceUpdate();
                                    })
                            }
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

                childrenAccessories={
                    <ChildrenAccessories
                        channelMessageProps={{
                            channel: ChannelStore.getChannel(message.channel_id) || new PrivateChannelRecord({ id: "" }),
                            message,
                            compact: false,
                            groupId: "1",
                            id: message.id,
                            isLastItem: false,
                            isHighlight: false,
                            renderContentOnly: false,
                        }}
                        hasSpoilerEmbeds={false}
                        isInteracting={false}
                        showClydeAiEmbeds={true}
                        isAutomodBlockedMessage={false}
                    />
                }

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

    if (currentMessage.id === previousMessage.id) return true;

    const [newestMessage, oldestMessage] = sortNewest
        ? [previousMessage, currentMessage]
        : [currentMessage, previousMessage];

    if (newestMessage.author.id !== oldestMessage.author.id) return true;

    const timeDifferenceInMinutes = Math.abs(
        (new Date(newestMessage.timestamp).getTime() - new Date(oldestMessage.timestamp).getTime()) / (1000 * 60)
    );

    return timeDifferenceInMinutes >= 5;
}
