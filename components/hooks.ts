/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { useEffect, useRef, useState } from "@webpack/common";

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

export function useMessages(query: string, currentTab: LogTabs, sortNewest: boolean, pageSize: number) {
    // only for initial load
    const [pending, setPending] = useState(true);
    const [messages, setMessages] = useState<DBMessageRecord[]>([]);
    const [hasMore, setHasMore] = useState(false);
    const [resetKey, setResetKey] = useState(0);
    const [loadMoreKey, setLoadMoreKey] = useState(0);
    // where we left off in the current session, so loadMore can continue from there
    const pageRef = useRef<{ session: string; lastId: string | null }>({ session: "", lastId: null });
    const loadingMoreRef = useRef(false);

    const debouncedQuery = useDebouncedValue(query, 300);
    // new session whenever anything that changes the results changes
    const session = `${currentTab}|${sortNewest}|${debouncedQuery}|${resetKey}`;

    useEffect(() => {
        imageUtils.revokeLogsBlobUrls();
        return () => imageUtils.revokeLogsBlobUrls();
    }, [debouncedQuery, currentTab, sortNewest, resetKey]);

    const loadPage = async (isActive: () => boolean, continuationKey?: string, append = false) => {
        const { messages: page, hasMore: pageHasMore } = await fetchPage(
            getStatus(currentTab),
            sortNewest,
            debouncedQuery,
            pageSize,
            continuationKey
        );

        const processedMessages = await imageUtils.loadAttachmentBlobUrls(page, true);
        if (!isActive()) return;

        setMessages(append ? prev => [...prev, ...processedMessages] : processedMessages);
        setHasMore(pageHasMore);
        pageRef.current = { session, lastId: processedMessages[processedMessages.length - 1]?.message_id ?? null };
        setPending(false);
    };

    useEffect(() => {
        let isMounted = true;
        pageRef.current = { session, lastId: null };

        loadPage(() => isMounted);

        return () => {
            isMounted = false;
        };

    }, [session, pageSize]);

    useEffect(() => {
        if (loadMoreKey === 0) return;

        let isMounted = true;
        const { session: pageSession, lastId } = pageRef.current;

        if (pageSession !== session || !lastId || loadingMoreRef.current) return;

        loadingMoreRef.current = true;

        loadPage(() => isMounted, lastId, true).finally(() => {
            loadingMoreRef.current = false;
        });

        return () => {
            isMounted = false;
        };

    }, [loadMoreKey, session, pageSize]);

    return {
        messages,
        hasMore,
        pending,
        reset: () => {
            setPending(true);
            setResetKey(k => k + 1);
        },
        loadMore: () => setLoadMoreKey(k => k + 1)
    };
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

async function fetchPage(
    status: DBMessageStatus,
    sortNewest: boolean,
    query: string,
    pageSize: number,
    continuationKey?: string
): Promise<{ messages: DBMessageRecord[]; hasMore: boolean }> {
    if (query === "") {
        const rawMessages = await getDateStortedMessagesByStatusIDB(sortNewest, pageSize + 1, status, continuationKey);
        const hasMore = rawMessages.length > pageSize;
        return {
            messages: hasMore ? rawMessages.slice(0, pageSize) : rawMessages,
            hasMore
        };
    }

    return searchMessagesIDB(status, sortNewest, query, pageSize, continuationKey);
}
