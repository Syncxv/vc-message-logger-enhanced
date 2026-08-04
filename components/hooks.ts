/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { useEffect, useState } from "@webpack/common";

import { DBMessageRecord, DBMessageStatus, getDateStortedMessagesByStatusIDB, searchMessagesIDB } from "../db";
import * as imageUtils from "../utils/saveImage";
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

export function useMessages(query: string, currentTab: LogTabs, sortNewest: boolean, numDisplayedMessages: number) {
    // only for initial load
    const [pending, setPending] = useState(true);
    const [messages, setMessages] = useState<DBMessageRecord[]>([]);
    const [statusTotal, setStatusTotal] = useState<number>(0);

    const debouncedQuery = useDebouncedValue(query, 300);

    useEffect(() => {
        let isMounted = true;

        const loadMessages = async () => {
            const status = getStatus(currentTab);

            imageUtils.revokeLogsBlobUrls();

            if (debouncedQuery === "") {
                const rawMessages = await getDateStortedMessagesByStatusIDB(sortNewest, numDisplayedMessages + 1, status, true);
                const hasMore = rawMessages.length > numDisplayedMessages;
                const slicedMessages = hasMore ? rawMessages.slice(0, numDisplayedMessages) : rawMessages;

                const processedMessages = await imageUtils.loadAttachmentBlobUrls(slicedMessages, true);

                if (isMounted) {
                    setMessages(processedMessages);
                    setStatusTotal(hasMore ? Number.MAX_SAFE_INTEGER : processedMessages.length);
                }

                setPending(false);
            } else {
                const { messages: rawMessages, hasMore } = await searchMessagesIDB(
                    status,
                    sortNewest,
                    debouncedQuery,
                    numDisplayedMessages
                );

                const processedMessages = await imageUtils.loadAttachmentBlobUrls(rawMessages, true);

                if (isMounted) {
                    setMessages(processedMessages);
                    setStatusTotal(hasMore ? Number.MAX_SAFE_INTEGER : processedMessages.length);
                }
                setPending(false);
            }
        };

        loadMessages();

        return () => {
            isMounted = false;
            imageUtils.revokeLogsBlobUrls();
        };

    }, [debouncedQuery, sortNewest, numDisplayedMessages, currentTab, pending]);


    return { messages, statusTotal, pending, reset: () => setPending(true) };
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
