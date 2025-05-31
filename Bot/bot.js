const axios = require("axios").default;
const { io } = require("socket.io-client");
const tough = require("tough-cookie");
const EventEmitter = require("events");
const fs = require("fs");
const path = require("path");
const { processMessage } = require("./ai");

const MESSAGE_COUNTS_FILE_PATH = path.join(__dirname, "..", "messageCounts.json");
const RECENT_MESSAGES_FILE_PATH = path.join(__dirname, "..", "recentMessages.json");
const MAX_RECENT_MESSAGES = 200;
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

        this.socket.on("disconnect", () => {
            this.connected = false;
            this.emit("disconnect");
        });

        this.socket.on("connect_error", (err) => {
            this.emit("error", err);
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

    destroy() {
        if (this.socket) {
            this.socket.disconnect();
        }
    }
}

module.exports = TwoBladeBot;
