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

import "./styles.css";

import { addContextMenuPatch, NavContextMenuPatchCallback, removeContextMenuPatch } from "@api/ContextMenu";
import { definePluginSettings } from "@api/Settings";
import ErrorBoundary from "@components/ErrorBoundary";
import { Devs } from "@utils/constants";
import definePlugin, { OptionType } from "@utils/types";
import { Alerts, Button, FluxDispatcher, Menu, MessageStore, Toasts, UserStore } from "@webpack/common";

import { OpenLogsButton } from "./components/LogsButton";
import { openLogModal } from "./components/LogsModal";
import { addMessage, isLogEmpty, loggedMessagesCache, MessageLoggerStore, refreshCache, removeLog } from "./LoggedMessageManager";
import { LoadMessagePayload, LoggedMessage, LoggedMessageJSON, MessageDeletePayload, MessageUpdatePayload } from "./types";
import { cleanupUserObject, mapEditHistory, reAddDeletedMessages } from "./utils";
import { downloadLoggedMessages, uploadLogs } from "./utils/settingsUtils";


async function messageDeleteHandler(payload: MessageDeletePayload) {
    const message: LoggedMessage = MessageStore.getMessage(payload.channelId, payload.id);
    if (message == null || message.channel_id == null || !message.deleted) return;

    console.log("ADDING MESSAGE (DELETED)", message);
    await addMessage(message, "deletedMessages");
}

async function messageUpdateHandler(payload: MessageUpdatePayload) {
    const message: LoggedMessage = MessageStore.getMessage(payload.message.channel_id, payload.message.id);
    if (message == null || message.channel_id == null || message.editHistory == null || message.editHistory.length === 0) return;

    console.log("ADDING MESSAGE (EDITED)", message);
    await addMessage(message, "editedMessages");
}

// also stolen from mlv2
function messageLoadSuccess(payload: LoadMessagePayload) {
    const deletedMessages = loggedMessagesCache.deletedMessages[payload.channelId];
    const editedMessages = loggedMessagesCache.editedMessages[payload.channelId];
    const recordIDs: string[] = [...(deletedMessages || []), ...(editedMessages || [])];


    for (let i = 0; i < payload.messages.length; ++i) {
        const recievedMessage = payload.messages[i];
        const record = loggedMessagesCache[recievedMessage.id];

        if (record == null || record.message == null) continue;

        if (record.message.editHistory!.length !== 0) {
            payload.messages[i].editHistory = record.message.editHistory;
        }

    }

    const fetchUser = (id: string) => UserStore.getUser(id) || payload.messages.find(e => e.author.id === id);

    for (let i = 0, len = recordIDs.length; i < len; i++) {
        const id = recordIDs[i];
        if (!loggedMessagesCache[id]) continue;
        const { message } = loggedMessagesCache[id] as { message: LoggedMessageJSON; };

        for (let j = 0, len2 = message.mentions.length; j < len2; j++) {
            const user = message.mentions[j];
            const cachedUser = fetchUser((user as any).id || user);
            if (cachedUser) (message.mentions[j] as any) = cleanupUserObject(cachedUser);
        }

        message.embeds.map(m => ({ ...m, id: undefined }));

        const author = fetchUser(message.author.id);
        if (!author) continue;
        (message.author as any) = cleanupUserObject(author);
    }

    reAddDeletedMessages(payload.messages, deletedMessages, !payload.hasMoreAfter && !payload.isBefore, !payload.hasMoreBefore && !payload.isAfter);
}

export const settings = definePluginSettings({
    sortNewest: {
        default: true,
        type: OptionType.BOOLEAN,
        description: "Sort logs by newest",
    },

    importLogs: {
        type: OptionType.COMPONENT,
        description: "Import Logs",
        component: () =>
            <Button onClick={async () =>
                (await isLogEmpty()) ? Alerts.show({
                    title: "Are you sure?",
                    body: "Importing logs will overwrite your current logs.",
                    confirmText: "Import",
                    confirmColor: Button.Colors.RED,
                    cancelText: "Nevermind",
                    onConfirm: async () => uploadLogs()

                }) : uploadLogs()}>
                Import Logs
            </Button>,
    },
    exportLogs: {
        type: OptionType.COMPONENT,
        description: "Export Logs",
        component: () =>
            <Button onClick={downloadLoggedMessages}>
                Export Logs
            </Button>
    },
    openLogs: {
        type: OptionType.COMPONENT,
        description: "Open Logs",
        component: () =>
            <Button onClick={openLogModal}>
                Open Logs
            </Button>
    }
});



export default definePlugin({
    name: "MessageLoggerThingy",
    authors: [Devs.Aria],
    description: "G'day",
    dependencies: ["MessageLogger"],

    patches: [
        {
            find: "displayName=\"MessageStore\"",
            replacement: {
                match: /LOAD_MESSAGES_SUCCESS:function\(\i\){/,
                replace: "$&$self.messageLoadSuccess(arguments[0]);"
            }
        },

        {
            find: "THREAD_STARTER_MESSAGE?null===",
            replacement: {
                match: /(attachments:.{1,3}\(.{1,500})deleted:.{1,50},editHistory:.{1,30},/,
                replace: "$1deleted: $self.getDeleted(...arguments),editHistory: $self.getEdited(...arguments),"
            }
        },

        {
            find: ".mobileToolbar",
            replacement: {
                match: /(function .{1,3}\(.\){)(.{1,200}toolbar.{1,100}mobileToolbar)/,
                replace: "$1$self.addIconToToolBar(arguments[0]);$2"
            }
        }
    ],
    settings,

    toolboxActions: {
        "Message Logger"() {
            openLogModal();
        }
    },

    addIconToToolBar(e: { toolbar: React.ReactNode[] | React.ReactNode; }) {
        if (Array.isArray(e.toolbar))
            return e.toolbar.push(
                <ErrorBoundary noop={true}>
                    <OpenLogsButton />
                </ErrorBoundary>
            );

        e.toolbar = [
            <ErrorBoundary noop={true}>
                <OpenLogsButton />
            </ErrorBoundary>,
            e.toolbar,
        ];
    },

    refreshCache,
    messageLoadSuccess,
    store: MessageLoggerStore,
    openLogModal,

    getDeleted(m1, m2) {
        const deleted = m2?.deleted;
        if (deleted == null && m1?.deleted != null) return m1.deleted;
        return deleted;
    },

    getEdited(m1, m2) {
        const editHistory = m2?.editHistory;
        if (editHistory == null && m1?.editHistory != null && m1.editHistory.length > 0)
            return m1.editHistory.map(mapEditHistory);
        return editHistory;
    },
    flux: {
        "MESSAGE_DELETE": messageDeleteHandler,
        "MESSAGE_UPDATE": messageUpdateHandler,
    },

    start() {
        addContextMenuPatch("message", openLogsPatch);
        addContextMenuPatch("channel-context", openLogsPatch);
        addContextMenuPatch("user-context", openLogsPatch);
    },

    stop() {
        removeContextMenuPatch("message", openLogsPatch);
        removeContextMenuPatch("channel-context", openLogsPatch);
        removeContextMenuPatch("user-context", openLogsPatch);

    }
});


const openLogsPatch: NavContextMenuPatchCallback = (children, props) => {
    if (!props) return;

    if (!children.some(child => child?.props?.id === "message-logger")) {
        children.push(
            <Menu.MenuSeparator />,
            <Menu.MenuItem
                id="message-logger"
                label="Message Logger"
            >

                <Menu.MenuItem
                    id="open-logs"
                    label="Open Logs"
                    action={() => openLogModal()}
                />

                {
                    props.navId === "message"
                    && (props.message?.deleted || props.message?.editHistory?.length > 0)
                    && (
                        <Menu.MenuItem
                            id="remove-message"
                            label={props.message?.deleted ? "Remove Message (Permanent)" : "Remove Message History (Permanent)"}
                            color="danger"
                            action={() =>
                                removeLog(props.message.id)
                                    .then(() => {
                                        if (props.message.deleted) {
                                            FluxDispatcher.dispatch({
                                                type: "MESSAGE_DELETE",
                                                channelId: props.message.channel_id,
                                                id: props.message.id,
                                                mlDeleted: true
                                            });
                                        } else {
                                            props.message.editHistory = [];
                                        }
                                    }).catch(() => Toasts.show({
                                        type: Toasts.Type.FAILURE,
                                        message: "Failed to remove message",
                                        id: Toasts.genId()
                                    }))

                            }
                        />
                    )
                }

            </Menu.MenuItem>
        );
    }
};
