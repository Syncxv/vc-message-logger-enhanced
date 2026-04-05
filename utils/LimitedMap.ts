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

export class LimitedMap<K, V> {
    public map: Map<K, V> = new Map();
    constructor(private limit?: number | (() => number)) { }

    set(key: K, value: V) {
        const currentLimit = typeof this.limit === "function" ? this.limit() : this.limit;
        if (currentLimit !== undefined && currentLimit > 0 && this.map.size >= currentLimit) {
            // delete the first entry
            this.map.delete(this.map.keys().next().value!);
        }
        this.map.set(key, value);
    }

    get(key: K) {
        return this.map.get(key);
    }

    has(key: K) {
        return this.map.has(key);
    }

    delete(key: K) {
        return this.map.delete(key);
    }

    clear() {
        this.map.clear();
    }
}
