const axios = require("axios").default;
const { io } = require("socket.io-client");
const tough = require("tough-cookie");
const EventEmitter = require("events");
const fs = require("fs");
const path = require("path");
const { processMessage } = require("./ai");

const MESSAGE_COUNTS_FILE_PATH = path.join(__dirname, "..", "messageCounts.json");
const RECENT_MESSAGES_FILE_PATH = path.join(__dirname, "..", "recentMessages.json");
const ADMINS_FILE_PATH = path.join(__dirname, "..", "admins.json");
const BANNED_USERS_FILE_PATH = path.join(__dirname, "..", "bannedUsers.json");
const MAX_RECENT_MESSAGES = 400;
const cf_clearance = process.env.CF_CLEARANCE;

class TwoBladeBot extends EventEmitter {
    constructor(baseUrl = "https://twoblade.com") {
        super();
        this.baseUrl = baseUrl;
        this.username = null;
        this.password = null;
        this.cookies = new tough.CookieJar();
        this.socket = null;
        this.authToken = null; 
        this.connected = false;
        this.messageCounts = this._loadMessageCounts();
        this.recentMessages = this._loadRecentMessages(); // Load recent messages on init
        this.admins = this._loadAdmins();
        this.bannedUsers = this._loadBannedUsers();
        this.startedAt = null;
    }

    _loadMessageCounts() {
        try {
            if (fs.existsSync(MESSAGE_COUNTS_FILE_PATH)) {
                const data = fs.readFileSync(MESSAGE_COUNTS_FILE_PATH, "utf-8");
                const counts = JSON.parse(data);
                console.log("Successfully loaded message counts from file.");
                return counts;
            }
        } catch (error) {
            console.error("Error loading message counts from file:", error);
        }
        console.log("No message counts file found or error loading, starting with empty counts.");
        return {};
    }

    _saveMessageCounts() {
        try {
            fs.writeFileSync(MESSAGE_COUNTS_FILE_PATH, JSON.stringify(this.messageCounts, null, 2));
            // console.log("Successfully saved message counts to file."); // Optional: for debugging
        } catch (error) {
            console.error("Error saving message counts to file:", error);
        }
    }

    _loadRecentMessages() {
        try {
            if (fs.existsSync(RECENT_MESSAGES_FILE_PATH)) {
                const data = fs.readFileSync(RECENT_MESSAGES_FILE_PATH, "utf-8");
                const messages = JSON.parse(data);
                console.log("Successfully loaded recent messages from file.");
                return Array.isArray(messages) ? messages : [];
            }
        } catch (error) {
            console.error("Error loading recent messages from file:", error);
        }
        console.log("No recent messages file found or error loading, starting with empty history.");
        return [];
    }

    _saveRecentMessages() {
        try {
            fs.writeFileSync(RECENT_MESSAGES_FILE_PATH, JSON.stringify(this.recentMessages, null, 2));
        } catch (error) {
            console.error("Error saving recent messages to file:", error);
        }
    }

    _loadAdmins() {
        try {
            if (fs.existsSync(ADMINS_FILE_PATH)) {
                const data = fs.readFileSync(ADMINS_FILE_PATH, "utf-8");
                const adminList = JSON.parse(data);
                console.log("Successfully loaded admins from file.");
                return Array.isArray(adminList) ? adminList : [];
            }
        } catch (error) {
            console.error("Error loading admins from file:", error);
        }
        console.log("No admins file found or error loading, starting with empty list.");
        return [];
    }

    _saveAdmins() {
        try {
            fs.writeFileSync(ADMINS_FILE_PATH, JSON.stringify(this.admins, null, 2));
        } catch (error) {
            console.error("Error saving admins to file:", error);
        }
    }

    _loadBannedUsers() {
        try {
            if (fs.existsSync(BANNED_USERS_FILE_PATH)) {
                const data = fs.readFileSync(BANNED_USERS_FILE_PATH, "utf-8");
                const bannedList = JSON.parse(data);
                console.log("Successfully loaded banned users from file.");
                return Array.isArray(bannedList) ? bannedList : [];
            }
        } catch (error) {
            console.error("Error loading banned users from file:", error);
        }
        console.log("No banned users file found or error loading, starting with empty list.");
        return [];
    }

    _saveBannedUsers() {
        try {
            fs.writeFileSync(BANNED_USERS_FILE_PATH, JSON.stringify(this.bannedUsers, null, 2));
        } catch (error) {
            console.error("Error saving banned users to file:", error);
        }
    }

    getDomain() {
        try {
            return new URL(this.baseUrl).hostname;
        } catch (e) {
            console.error("Error parsing baseUrl to get domain:", e);
            return "default.domain"; // Fallback domain
        }
    }

    async login(username, password) {
        this.username = username;
        this.password = password;

        const url = `${this.baseUrl}/login`;
        const headers = {
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': 'Mozilla/5.0',
            'Referer': `${this.baseUrl}/login`,
            'Origin': this.baseUrl,
            'Cookie': `cf_clearance=${cf_clearance}`
        };

        const data = new URLSearchParams();
        data.append("username", username);
        data.append("password", password);

        const response = await axios.post(url, data.toString(), {
            headers,
            withCredentials: true
        });

        const setCookies = response.headers['set-cookie'] || [];

        let authToken = null;
        for (const rawCookie of setCookies) {
            this.cookies.setCookieSync(rawCookie, this.baseUrl);
            const cookie = tough.Cookie.parse(rawCookie);
            if (cookie?.key === "auth_token") {
                authToken = cookie.value;
            }
        }

        if (!authToken) {
            throw new Error("auth_token cookie not found in login response");
        }

        this.authToken = authToken;
        this.emit("login", this.username);
    }

    async connect() {
        if (!this.authToken) {
            throw new Error("Must login before connecting");
        }

        const cookieString = `cf_clearance=${cf_clearance}; auth_token=${this.authToken}`;

        this.socket = io(this.baseUrl, {
            path: "/ws/socket.io",
            transports: ["websocket"],
            auth: { token: this.authToken },
            extraHeaders: {
                Cookie: cookieString,
                Origin: this.baseUrl
            }
        });

        this.socket.on("connect", () => {
            this.connected = true;
            this.emit("ready");
            this.startedAt = Date.now();
        });

        this.socket.on("disconnect", (reason) => {
            this.connected = false;
            this.emit("disconnect", reason);
            console.log(`Bot disconnected from WebSocket. Reason: ${reason}`);
            // socket.io-client will attempt to reconnect automatically for most reasons
            // unless reconnection is disabled or it was a client-initiated disconnect.
        });

        this.socket.on("connect_error", (err) => {
            console.error("Socket connection error:", err.message);
            this.emit("error", err);
        });

        // Optional: Listen to other reconnection-related events for more detailed logging or handling
        this.socket.on("reconnect_attempt", (attempt) => {
            console.log(`Socket attempting to reconnect... (Attempt: ${attempt})`);
            this.emit("reconnecting", attempt); // Emit custom event if needed elsewhere
        });

        this.socket.on("reconnect", (attempt) => {
            this.connected = true; // Ensure connected status is updated
            console.log(`Socket reconnected successfully! (Attempt: ${attempt})`);
            this.emit("reconnect", attempt); // Emit custom event if useful
            // Consider if 'ready' event or similar logic should be re-triggered here
        });

        this.socket.on("reconnect_error", (err) => {
            console.error("Socket reconnection error:", err.message);
            // Propagate as a general error, which should be caught in index.js
            this.emit("error", new Error(`Reconnection attempt failed: ${err.message}`));
        });

        this.socket.on("reconnect_failed", () => {
            console.error("Socket reconnection failed after all attempts.");
            // Propagate as a general error, which should be caught in index.js
            this.emit("error", new Error("Socket reconnection ultimately failed. The bot may need a manual restart or intervention."));
        });

        this.socket.on("users_count", (count) => {
            this.emit("users_count", count);
        });
        this.socket.on("recent_messages", (messages) => {
            this.emit("recent_messages", messages);
        });

        this.socket.on("message", (data) => {
            this.emit("message", data);

            // Store message for counts
            const user = data.fromUser || 'Unknown';
            if (!this.messageCounts[user]) {
                this.messageCounts[user] = 0;
            }
            this.messageCounts[user]++;
            this._saveMessageCounts(); // Save counts after each update

            // Store message for recent history
            if (data.text && data.fromUser) {
                const messageEntry = {
                    fromUser: data.fromUser,
                    text: data.text,
                    timestamp: new Date().toISOString()
                };
                this.recentMessages.push(messageEntry);
                if (this.recentMessages.length > MAX_RECENT_MESSAGES) {
                    this.recentMessages.shift(); // Keep only the last MAX_RECENT_MESSAGES
                }
                this._saveRecentMessages(); // Save recent messages after each update
            }

            if (!data?.text || typeof data.text !== "string") return;
            const text = data.text.trim();

            processMessage(this, data);

        });
    }

    sendMessage(text) {
        if (!this.connected || !this.socket) {
            throw new Error("Not connected to socket");
        }
        this.socket.emit("message", text);
    }

    async start(username, password) {
        await this.login(username, password);
        await this.connect();
    }

    // Admin management
    addAdmin(userIdentifier) {
        if (!this.admins.includes(userIdentifier)) {
            this.admins.push(userIdentifier);
            this._saveAdmins();
            console.log(`Admin added: ${userIdentifier}`);
        }
    }

    isAdmin(userIdentifier) {
        return this.admins.includes(userIdentifier);
    }

    // Ban management
    banUser(userIdentifier) {
        if (!this.bannedUsers.includes(userIdentifier)) {
            this.bannedUsers.push(userIdentifier);
            this._saveBannedUsers();
            console.log(`User banned: ${userIdentifier}`);
        }
    }

    isBanned(userIdentifier) {
        return this.bannedUsers.includes(userIdentifier);
    }

    destroy() {
        if (this.socket) {
            this.socket.disconnect();
        }
    }
}

module.exports = TwoBladeBot;
