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

import { Flogger, settings } from ".";
import { addMessageIDB, db, DBMessageStatus, deleteMessagesBulkIDB, getOldestMessageIdsIDB } from "./db";
import { createMessageLimitEnforcer, getMessageLimitDeleteCount } from "./messageLimitEnforcer";
import { LoggedMessage, LoggedMessageJSON } from "./types";
import { cleanupMessage } from "./utils";
import { cacheMessageImages } from "./utils/saveImage";

const enforceMessageLimit = createMessageLimitEnforcer(async () => {
    if (settings.store.messageLimit > 0) {
        const currentMessageCount = await db.count("messages");
        const messagesToDelete = getMessageLimitDeleteCount(currentMessageCount, settings.store.messageLimit);
        if (messagesToDelete > 0) {
            const oldestMessageIds = await getOldestMessageIdsIDB(messagesToDelete);

            Flogger.info(`Deleting ${oldestMessageIds.length} oldest messages`);
            await deleteMessagesBulkIDB(oldestMessageIds);
        }
    }
});

export const addMessage = async (message: LoggedMessage | LoggedMessageJSON, status: DBMessageStatus) => {
    if (settings.store.saveImages && status === DBMessageStatus.DELETED)
        await cacheMessageImages(message);
    const finalMessage = cleanupMessage(message);

    await addMessageIDB(finalMessage, status);
    await enforceMessageLimit();
};
