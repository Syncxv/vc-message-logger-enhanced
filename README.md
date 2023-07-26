# vc-message-logger-enhanced

## Features
- Restore deleted and edited messages even after reloading Discord (optional).
- Log messages from channels or DMs you haven't opened.
- View logs in a modal that shows your logged messages.
  - Sort messages based on timestamps.
  - Search logs by channel ID, user ID, server ID, and message ID.
  - Ghost Pinged tab to track and view ghost pings.
- Set a message limit to manage the number of saved logs (settings).
- Blacklist servers, channels, and users to prevent logging specific content.
- Whitelist feature to selectively allow logging for specific servers, channels, or users.
- Whitelist overrides server blacklist, allowing logging of whitelisted users' actions in blacklisted servers and channels.
- Export logs for backup and analysis purposes.
- Import logs to restore previous logging data.

  
### **Note:** Enabling "Cache Messages From Servers" can increase the size of log records and disk space usage. Consider this before enabling the feature.

# How to update
cd into your vencord folder and run this
```bash
cd src/userplugins/vc-message-logger-enhanced
git pull
pnpm build
```


# Changelog

## Version 1.2.0
- Render Embeds in logs modal :D

## Version 1.1.0

- Added Whitelist feature
- Improved message caching:
  - Graylisted messages that aren't cached by Discord won't be saved
- Added Ghost Ping Tab
- Improved searching functionality:
  - Can now search by names in addition to existing search options
- Added an automatic update check feature
- Improved modal performance for better user experience

# Demo
https://github.com/Syncxv/vc-message-logger-enhanced/assets/47534062/de932bff-91fe-4825-8ef7-551cf245e51a

## found a bug?
Message me on discord. @daveyy1
