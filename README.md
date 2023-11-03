# vc-message-logger-enhanced

## Features

-   Restore deleted and edited messages even after reloading Discord (optional).
-   Log messages from channels or DMs you haven't opened.
-   Save deleted images
-   View logs in a modal that shows your logged messages.
    -   Sort messages based on timestamps.
    -   Search logs by channel ID, user ID, server ID, and message ID.
    -   Ghost Pinged tab to track and view ghost pings.
-   Set a message limit to manage the number of saved logs (settings).
-   Blacklist servers, channels, and users to prevent logging specific content.
-   Whitelist feature to selectively allow logging for specific servers, channels, or users.
-   Whitelist overrides server blacklist, allowing logging of whitelisted users' actions in blacklisted servers and channels.
-   Export logs for backup and analysis purposes.
-   Import logs to restore previous logging data.

### **Note:** Enabling "Cache Messages From Servers" can increase the size of log records and disk space usage. Consider this before enabling the feature.

# How to Install

tutorial: https://youtu.be/8wexjSo8fNw

# How to update

cd into your vencord folder and run this

```bash
cd src/userplugins/vc-message-logger-enhanced
git pull
pnpm build
```

# Save images to real folder

add this line `import "./userplugins/vc-message-logger-enhanced/utils/freedom/importMeToPreload";` to src/preload.ts

<details>
<summary>Diff</summary>

```diff
/*
 * Vencord, a modification for Discord's desktop app
 * Copyright (c) 2022 Vendicated and contributors
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

+ import "./userplugins/vc-message-logger-enhanced/utils/freedom/importMeToPreload";

import { debounce } from "@utils/debounce";
import { contextBridge, webFrame } from "electron";
import { readFileSync, watch } from "fs";
import { join } from "path";

import VencordNative from "./VencordNative";
```

</details>

after that run `pnpm build` and completely restart discord (or go to Settings -> Vencord -> Restart Client)

you should see an option to select the image cache folder. by default the folder is here: `%appdata%\Vencord\savedImages`

# Changelog

## Version 1.4.0

-   Save Images :D

## Version 1.3.2

-   Fixed Modal and Toolbox Icon
-   Made update message less confusing https://github.com/Syncxv/vc-message-logger-enhanced/issues/2

## Version 1.3.1

-   Added option to always log Direct Messages by [@CatGirlDShadow](https://github.com/CatGirlDShadow) in https://github.com/Syncxv/vc-message-logger-enhanced/pull/1
-   Added option to always log Selected Channel by [@CatGirlDShadow](https://github.com/CatGirlDShadow) in https://github.com/Syncxv/vc-message-logger-enhanced/pull/1
-   Added option to ignore muted Categories by [@CatGirlDShadow](https://github.com/CatGirlDShadow) in https://github.com/Syncxv/vc-message-logger-enhanced/pull/1
-   Added option to ignore muted Channels by [@CatGirlDShadow](https://github.com/CatGirlDShadow) in https://github.com/Syncxv/vc-message-logger-enhanced/pull/1

## Version 1.3.0

-   Log bulk deleted messages (feat)
-   Ignore muted guild option (feat)
-   Fix Limits not working (fix)
-   Fix message limit not working (fix)

most of the big exams are over :D
can finally go back to makin tuff

## Version 1.2.0

-   Render Embeds in logs modal :D

## Version 1.1.0

-   Added Whitelist feature
-   Improved message caching:
    -   Graylisted messages that aren't cached by Discord won't be saved
-   Added Ghost Ping Tab
-   Improved searching functionality:
    -   Can now search by names in addition to existing search options
-   Added an automatic update check feature
-   Improved modal performance for better user experience

# Demo

https://github.com/Syncxv/vc-message-logger-enhanced/assets/47534062/de932bff-91fe-4825-8ef7-551cf245e51a

## found a bug?

Message me on discord. @daveyy1
