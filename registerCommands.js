import 'dotenv/config';
import { REST, Routes, SlashCommandBuilder } from 'discord.js';

const commands = [
  new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Test command')
].map(cmd => cmd.toJSON());

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.CLIENT_ID;

if (!token) throw new Error("Missing DISCORD_TOKEN in .env");
if (!clientId) throw new Error("Missing CLIENT_ID in .env");

const rest = new REST({ version: '10' }).setToken(token);

await rest.put(
  Routes.applicationCommands(clientId),
  { body: commands }
);

console.log("✅ Commands registered globally!");
