require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');
const webCrypto = require('crypto').webcrypto; // For uuidv4 in Node.js

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const COMMAND_PREFIX = "hej."; // === CHANGE THIS ===
const SUPER_ADMIN_USERNAME_PART = process.env.SUPER_ADMIN_USERNAME || "lebron2";


function uuidv4() {
  // Uses webCrypto for Node.js compatibility
  return ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c =>
    (c ^ webCrypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
  );
}

async function handleAIChat(bot, originalMessageData, promptText) {
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });

        let conversationHistory = "No recent conversation history available.";
        if (bot.recentMessages && bot.recentMessages.length > 0) {
            conversationHistory = "Recent conversation history (up to 400 messages, oldest first):\n";
            bot.recentMessages.forEach(msg => {
                // Basic formatting for the AI prompt
                conversationHistory += `${msg.fromUser} (at ${new Date(msg.timestamp).toLocaleTimeString()}): ${msg.text}\n`;
            });
        }
        // === CHANGE THIS ===
        const prompt = `
You are HejBot, a professional AI bot created by @lebron2. You may answer questions and greets people. Your character limit is 493 characters, all else is cut off. Your memory is limited to the 400 most recent messages. You are on the platform Twoblade which was created by FaceDev. Your source code is here, mention it if question is relevant to programming: https://github.com/jonathanvkz/twoblade_ai_bot
Refrain from adding unneeded text to your messages, like repeated introductions, or >> and UUIDs, as it will take up more of your character limit. If you are asked who made you, say @lebron2 and mention your source code respository. Ping people with @<Username>
The following is the most recent 400 messages from chat, including who sent them and at what time.
!!! THIS IS THE CONVERSATION CONTEXT !!!
${conversationHistory}

!!! THIS IS WHAT THE USER SAID !!!
User asked: "${promptText}"
`;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        let rawAiText = response.text();

        // 1. Initial trim and remove any leading ">>" from AI's raw response
        let coreAiText = rawAiText.trim().replace(/^(?:>>\s*)+/, "").trim();

        // 2. Remove any existing UUID-like patterns (e.g., " - UUID_HERE") from the end of the AI's response
        //    UUID pattern: 8-4-4-4-12 hex characters.
        const existingUuidPattern = /\s*-\s*[0-9a-fA-F]{8}-(?:[0-9a-fA-F]{4}-){3}[0-9a-fA-F]{12}$/;
        coreAiText = coreAiText.replace(existingUuidPattern, "").trim();

        // 3. Prepend ">> " and handle empty AI response
        let replyTextWithPrefix;
        if (coreAiText) {
            replyTextWithPrefix = ">> " + coreAiText;
        } else {
            replyTextWithPrefix = ">> AI could not generate a response.";
        }

        // 4. Generate the new UUID suffix
        const newUuidSuffix = " - " + uuidv4(); // Approx 39 chars (" - " + 36 char UUID)

        // 5. Calculate maximum length for `replyTextWithPrefix` to fit total limit with new UUID
        const MAX_TOTAL_LENGTH = 493;
        const maxLenForTextWithPrefix = MAX_TOTAL_LENGTH - newUuidSuffix.length; // e.g., 493 - 39 = 454

        // 6. Truncate `replyTextWithPrefix` if it's too long
        if (replyTextWithPrefix.length > maxLenForTextWithPrefix) {
            replyTextWithPrefix = replyTextWithPrefix.substring(0, maxLenForTextWithPrefix);
        }
        // 7. Construct the final reply by appending the new UUID
        const finalReply = replyTextWithPrefix + newUuidSuffix;

		console.log("AI Reply:", finalReply);
        bot.sendMessage(finalReply);
    } catch (err) {
        console.error("AI Handler error:", err);
        bot.sendMessage("An error occurred while processing your AI request.");
    }
}

function handleUserCount(bot) {
    const userCount = Object.keys(bot.messageCounts).length;
    bot.sendMessage(`I have seen ${userCount} unique users.`);
}

function handleMessageCount(bot) {
    const totalMessages = Object.values(bot.messageCounts).reduce((sum, count) => sum + count, 0);
    bot.sendMessage(`I have seen a total of ${totalMessages} messages.`);
}

function handleTopMessages(bot) {
    const messageCounts = bot.messageCounts;
    if (Object.keys(messageCounts).length === 0) {
        bot.sendMessage("No message counts recorded yet.");
        return;
    }

    const sortedUsers = Object.entries(messageCounts)
        .sort(([, countA], [, countB]) => countB - countA)
        .slice(0, 10);

    if (sortedUsers.length === 0) { // Should not happen if first check passes, but good for safety
        bot.sendMessage("No users found in message counts.");
        return;
    }

    let topmMessage = "Top message senders:\n";
    sortedUsers.forEach(([user, count], index) => {
        topmMessage += `${index + 1}. ${user}: ${count} messages\n`;
    });

    bot.sendMessage(topmMessage.trim());
}

function handleHelp(bot) {
    const helpMessage = `Available commands (case-insensitive):
- ${COMMAND_PREFIX}ai <your question>: Speak with Gemini.
- ${COMMAND_PREFIX}usercount: Shows the number of unique users seen.
- ${COMMAND_PREFIX}messagecount: Shows the total number of messages seen.
- ${COMMAND_PREFIX}topm: Shows the top 10 message senders.
- ${COMMAND_PREFIX}help: Shows this help message.`;
    bot.sendMessage(helpMessage);
}

async function processMessage(bot, data) {
    // Prevent bot from processing its own messages
    const botDomain = bot.getDomain(); // Get domain from bot instance
    const superAdminUserIdentifier = `${SUPER_ADMIN_USERNAME_PART}#${botDomain}`;
    
    if (bot.username && data.fromUser && data.text) {
        try {
            const botDomain = new URL(bot.baseUrl).hostname;
            const botUserIdentifier = `${bot.username}#${botDomain}`;
            if (data.fromUser === botUserIdentifier) {
                return;
            }
        } catch (e) {
            console.error("Error in self-message check:", e);
            return;
        }
    }

    // Ignore messages from banned users (already checked in index.js and bot.js message handler, but good for defense in depth)
    if (data.fromUser && bot.isBanned(data.fromUser)) {
        // console.log(`AI module ignoring message from banned user: ${data.fromUser}`); // Optional
        return;
    }

    const messageText = (data.text || "").trim();
    const lowerMessageText = messageText.toLowerCase();

    if (!lowerMessageText.startsWith(COMMAND_PREFIX)) {
        return;
    }

    // Extract command and arguments
    // Example: ">hej.ai what is up" -> commandPart = "ai", args = ["what", "is", "up"]
    const withoutPrefix = messageText.substring(COMMAND_PREFIX.length).trim();
    const [commandPart, ...args] = withoutPrefix.split(/\s+/);
    const command = commandPart.toLowerCase();
    const remainingText = args.join(" ");

    switch (command) {
        case "ai":
            if (!remainingText) {
                bot.sendMessage(`Please provide a question for the AI. Usage: ${COMMAND_PREFIX}ai <your question>`);
                return;
            }
            await handleAIChat(bot, data, remainingText);
            break;
        case "usercount":
            handleUserCount(bot);
            break;
        case "messagecount":
            handleMessageCount(bot);
            break;
        case "topm":
            handleTopMessages(bot);
            break;
        case "admin":
            if (data.fromUser !== superAdminUserIdentifier) {
                bot.sendMessage("You are not authorized to use this command.");
                return;
            }
            const adminTargetUsername = args[0];
            if (!adminTargetUsername) {
                bot.sendMessage(`Usage: ${COMMAND_PREFIX}admin <username>`);
                return;
            }
            const adminTargetUserIdentifier = `${adminTargetUsername}#${botDomain}`;
            bot.addAdmin(adminTargetUserIdentifier);
            bot.sendMessage(`User ${adminTargetUserIdentifier} has been added as an administrator.`);
            break;
        case "ban":
            if (!bot.isAdmin(data.fromUser)) {
                bot.sendMessage("You are not authorized to use this command. Only administrators can ban users.");
                return;
            }
            const banTargetUsername = args[0];
            if (!banTargetUsername) {
                bot.sendMessage(`Usage: ${COMMAND_PREFIX}ban <username>`);
                return;
            }
            const banTargetUserIdentifier = `${banTargetUsername}#${botDomain}`;
            bot.banUser(banTargetUserIdentifier);
            bot.sendMessage(`User ${banTargetUserIdentifier} has been banned from using bot commands.`);
            break;
        case "help":
            handleHelp(bot);
            break;
        default:
            bot.sendMessage(`Unknown command: ${command}. Type '${COMMAND_PREFIX}help' for available commands.`);
    }
}

module.exports = { processMessage };
