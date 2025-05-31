require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');
const webCrypto = require('crypto').webcrypto; // For uuidv4 in Node.js

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const COMMAND_PREFIX = "hej.";

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
            conversationHistory = "Recent conversation history (up to 200 messages, oldest first):\n";
            bot.recentMessages.forEach(msg => {
                // Basic formatting for the AI prompt
                conversationHistory += `${msg.fromUser} (at ${new Date(msg.timestamp).toLocaleTimeString()}): ${msg.text}\n`;
            });
        }

        const prompt = `
You are HejBot, a professional AI created by @lebron2. You may answer questions and greets people. Your character limit is 493 characters, all else is cut off.
!!! THIS IS THE CONVERSATION CONTEXT !!!
${conversationHistory}

!!! THIS IS WHAT THE USER ASKED !!!
User asked: "${promptText}"
`;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        let replyText = response.text();
        
        // Ensure reply is not empty and prepend ">> "
        replyText = replyText ? ">> " + replyText : ">> AI could not generate a response.";

        // Add UUID, ensuring the total length respects the character limit if possible (though this is hard to enforce perfectly here)
        const uuidSuffix = " - " + uuidv4();
        if (replyText.length + uuidSuffix.length > 490) { // 493 - ">> " length approx
            replyText = replyText.substring(0, 490 - uuidSuffix.length);
        }
        const reply = replyText + uuidSuffix;
		
		console.log("AI Reply:", reply);
        bot.sendMessage(reply);
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

function handleHelp(bot) {
    const helpMessage = `Available commands (case-insensitive):
- ${COMMAND_PREFIX}ai <your question>: Speak with Gemini.
- ${COMMAND_PREFIX}usercount: Shows the number of unique users seen.
- ${COMMAND_PREFIX}messagecount: Shows the total number of messages seen.
- ${COMMAND_PREFIX}help: Shows this help message.`;
    bot.sendMessage(helpMessage);
}

async function processMessage(bot, data) {
    // Prevent bot from processing its own messages
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
        case "help":
            handleHelp(bot);
            break;
        default:
            bot.sendMessage(`Unknown command: ${command}. Type '${COMMAND_PREFIX}help' for available commands.`);
    }
}

module.exports = { processMessage };
