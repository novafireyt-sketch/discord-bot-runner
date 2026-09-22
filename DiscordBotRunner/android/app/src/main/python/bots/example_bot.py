"""Example Python Discord bot (discord.py).

Rename or copy this file to add your own bots. The filename becomes the bot
name shown in the app.
"""

import asyncio

import discord

_client = None
_loop = None


class ExampleClient(discord.Client):
    async def on_ready(self):
        print("Logged in as %s" % self.user)

    async def on_message(self, message):
        if message.author == self.user:
            return
        if message.content == "!ping":
            await message.channel.send("Pong from a phone!")


def start(token, emit):
    global _client, _loop
    if not token:
        raise RuntimeError("No bot token supplied. Paste a token in the app.")
    _loop = asyncio.new_event_loop()
    asyncio.set_event_loop(_loop)
    intents = discord.Intents.default()
    intents.message_content = True
    _client = ExampleClient(intents=intents)
    _loop.run_until_complete(_client.start(token))


def stop():
    global _client, _loop
    if _client is not None and _loop is not None:
        asyncio.run_coroutine_threadsafe(_client.close(), _loop)
