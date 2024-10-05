/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { useEffect, useRef, useState } from "@webpack/common";

import { countMessagesByStatusIDB, DBMessageRecord, DBMessageStatus, getDateStortedMessagesByStatusIDB } from "../db";
import { doesMatch, tokenizeQuery } from "../utils/parseQuery";
import { LogTabs } from "./LogsModal";

function useDebouncedValue<T>(value: T, delay: number): T {
    const [debouncedValue, setDebouncedValue] = useState(value);

    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedValue(value);
        }, delay);

        return () => {
            clearTimeout(handler);
        };
    }, [value, delay]);

    return debouncedValue;
}

export function useMessages(query: string, currentTab: LogTabs, sortNewest: boolean, numDisplayedMessages: number, forceUpdate: () => void) {
    // only for initial load
    const [pending, setPending] = useState(true);

    const messagesRef = useRef({} as { [key in LogTabs]: { messages: DBMessageRecord[], total: number; } });
    const { messages, total } = messagesRef.current[currentTab] ?? {};

    const debouncedQuery = useDebouncedValue(query, 500);

    const getMessagesForTab = async () => {
        const status = getStatus(currentTab);
        const messages = await getDateStortedMessagesByStatusIDB(sortNewest, numDisplayedMessages, status);
        const total = await countMessagesByStatusIDB(status);
        messagesRef.current[currentTab] = {
            messages,
            total,
        };
    };

    useEffect(() => {
        const doStuff = async () => {
            if (pending) {
                await getMessagesForTab();
                setPending(false);
                forceUpdate();
            }
        };

        doStuff();

    }, [sortNewest, numDisplayedMessages, currentTab]);


    useEffect(() => {
        const searchMessags = async () => {
            // since this is indexeddb we cant do complex queries, so we just get all messages and filter them here
            const { queries, rest } = tokenizeQuery(debouncedQuery);
            if (queries.length === 0 && rest.length === 0) {
                await getMessagesForTab();
                forceUpdate();
            }

            const status = getStatus(currentTab);
            const messages = await getDateStortedMessagesByStatusIDB(sortNewest, Number.MAX_SAFE_INTEGER, status);

            // for loops in a filter XD
            const filteredMessages = messages.filter(record => {
                for (const query of queries) {
                    const matching = doesMatch(query.key, query.value, record.message);
                    if (query.negate ? matching : !matching) {
                        return false;
                    }
                }

                return rest.every(r => record.message.content.toLowerCase().includes(r.toLowerCase()));

            });

            messagesRef.current[currentTab] = {
                messages: filteredMessages,
                total: Number.MAX_SAFE_INTEGER,
            };

            forceUpdate();
        };

        searchMessags();

    }, [debouncedQuery, sortNewest, currentTab]);


    return { messages, total, pending };
}


function getStatus(currentTab: LogTabs) {
    return currentTab === LogTabs.DELETED ? DBMessageStatus.DELETED : currentTab === LogTabs.EDITED ? DBMessageStatus.EDITED : DBMessageStatus.GHOST_PINGED;
}
