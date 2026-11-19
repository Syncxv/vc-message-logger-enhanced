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

import assert from "node:assert/strict";
import test from "node:test";

import { createMessageLimitEnforcer, getMessageLimitDeleteCount } from "./messageLimitEnforcer.ts";

test("coalesces concurrent requests and reruns after writes during cleanup", async () => {
    let runs = 0;
    let release;
    const blocked = new Promise(resolve => { release = resolve; });
    const enforce = createMessageLimitEnforcer(async () => {
        runs++;
        if (runs === 1)
            await blocked;
    });

    const requests = Array.from({ length: 100 }, () => enforce());
    assert.equal(runs, 1);
    assert.ok(requests.every(request => request === requests[0]));
    release();
    await Promise.all(requests);
    assert.equal(runs, 2);

    await enforce();
    assert.equal(runs, 3);
});

test("allows retry after failed enforcement", async () => {
    let runs = 0;
    const enforce = createMessageLimitEnforcer(async () => {
        runs++;
        if (runs === 1)
            throw new Error("failed cleanup");
    });

    await assert.rejects(enforce(), /failed cleanup/);
    await enforce();
    assert.equal(runs, 2);
});

test("trims below the hard limit to avoid deleting on every write", () => {
    assert.equal(getMessageLimitDeleteCount(50000, 50000), 0);
    assert.equal(getMessageLimitDeleteCount(50001, 50000), 501);
    assert.equal(getMessageLimitDeleteCount(49500, 50000), 0);
    assert.equal(getMessageLimitDeleteCount(101, 100), 2);
    assert.equal(getMessageLimitDeleteCount(5001, 5000), 51);
    assert.equal(getMessageLimitDeleteCount(1000001, 1000000), 1001);
});
