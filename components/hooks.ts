/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { useEffect, useState } from "@webpack/common";

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
    const [messages, setMessages] = useState<DBMessageRecord[]>([]);
    const [total, setTotal] = useState<number>(0);

    const debouncedQuery = useDebouncedValue(query, 300);

    useEffect(() => {
        let isMounted = true;

        const fetchMessages = async () => {
            const status = getStatus(currentTab);

            if (debouncedQuery === "") {
                const [messages, total] = await Promise.all([
                    getDateStortedMessagesByStatusIDB(sortNewest, numDisplayedMessages, status),
                    countMessagesByStatusIDB(status),
                ]);

                if (isMounted) {
                    setMessages(messages);
                    setTotal(total);
                }

                setPending(false);
            } else {
                const allMessages = await getDateStortedMessagesByStatusIDB(sortNewest, Number.MAX_SAFE_INTEGER, status);
                const { queries, rest } = tokenizeQuery(debouncedQuery);

                const filteredMessages = allMessages.filter(record => {
                    for (const query of queries) {
                        const matching = doesMatch(query.key, query.value, record.message);
                        if (query.negate ? matching : !matching) {
                            return false;
                        }
                    }

                    return rest.every(r =>
                        record.message.content.toLowerCase().includes(r.toLowerCase())
                    );
                });

                if (isMounted) {
                    setMessages(filteredMessages.slice(0, numDisplayedMessages));
                    setTotal(Number.MAX_SAFE_INTEGER);
                }
                setPending(false);
            }
        };

        fetchMessages();

        return () => {
            isMounted = false;
        };

    }, [debouncedQuery, sortNewest, numDisplayedMessages, currentTab, pending]);


    return { messages, total, pending, reset: () => setPending(true) };
}


function getStatus(currentTab: LogTabs) {
    switch (currentTab) {
        case LogTabs.DELETED:
            return DBMessageStatus.DELETED;
        case LogTabs.EDITED:
            return DBMessageStatus.EDITED;
        default:
            return DBMessageStatus.GHOST_PINGED;
    }
}
