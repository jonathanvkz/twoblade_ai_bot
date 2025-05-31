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

      //if (msg.fromUser === 'user#twoblade.com') return;
      //here you can set persons to the bot  shouldnt answer

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
    });
  } catch (err) {
    console.error("something went wrong", err);
  }
})();