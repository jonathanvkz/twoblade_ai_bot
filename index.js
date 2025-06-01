// index.js
require("dotenv").config();
const TwoBladeBot = require("./Bot/bot");

(async () => {
  const bot = new TwoBladeBot("https://twoblade.com");
  const username = process.env.TB_USERNAME;
  const password = process.env.TB_PASSWORD;

  try {
    await bot.start(username, password);
    console.log("HejBot connected - Version: 1.0");

    bot.on("ready", () => {
      setTimeout(() => {
        bot.sendMessage(
          "index.js >> HejBot Connected\n"
        )
      }, 3000);
    });

    bot.on("message", msg => {
      if (typeof msg !== 'object') return;

      if (msg && msg.fromUser && bot.isBanned(msg.fromUser)) {
        console.log(`Ignoring message from banned user: ${msg.fromUser}`);
        return;
      }

      const frameWidth = 60;

      const formatLine = (label, value) => {
        const content = `${label}: '${value}',`;
        const padding = frameWidth - content.length - 3;
        return `| ${content}${' '.repeat(Math.max(padding, 0))}|`;
      };

      const shortText = msg.text.length > 35 ? msg.text.substring(0, 35) + "..." : msg.text;
      const border = '='.repeat(frameWidth);

      console.log(" ");
      console.log(border);
      console.log("|   new message :".padEnd(frameWidth - 1) + "|");
      console.log(formatLine("  id", msg.id));
      console.log(formatLine("  text", shortText));
      console.log(formatLine("  fromUser", msg.fromUser));
      console.log(border);
      console.log(" ");
    });

    bot.on("disconnect", () => {
      console.log("Bot disconnected!");
      // socket.io-client handles reconnection attempts by default.
      // You could add custom logic here if the bot needs to take specific actions
      // upon disconnection beyond what socket.io-client provides.
    });

    // Catch errors emitted by the bot instance to prevent unhandled error crashes
    bot.on("error", (err) => {
      console.error("Bot encountered an error:", err.message);
      if (err.stack) {
        console.error(err.stack);
      }
      // The socket.io-client will attempt to reconnect for transport errors.
      // If errors persist or are critical (e.g., reconnect_failed), manual intervention might be needed.
    });
  } catch (err) {
    console.error("Something went wrong during bot initialization or login:", err);
  }
})();
