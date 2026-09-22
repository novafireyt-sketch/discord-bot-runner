'use strict';

// Example Node.js Discord bot.
//
// Contract used by main.js:
//   module.exports.start(ctx) -> optional handle, may be async
//   module.exports.stop(handle) -> optional, may be async
//
// ctx = {token, name, log(line), error(line)}

const {Client, GatewayIntentBits} = require('discord.js');

let client = null;

module.exports = {
  async start(ctx) {
    if (!ctx.token) {
      throw new Error('No bot token supplied. Paste a token in the app.');
    }

    client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
      ],
    });

    client.once('ready', function () {
      ctx.log('Logged in as ' + client.user.tag);
    });

    client.on('messageCreate', async function (message) {
      if (message.author.bot) {
        return;
      }
      if (message.content === '!ping') {
        await message.reply('Pong from a phone!');
      }
    });

    client.on('error', function (err) {
      ctx.error(err.message);
    });

    await client.login(ctx.token);
    return {client: client};
  },

  async stop() {
    if (client) {
      await client.destroy();
      client = null;
    }
  },
};
