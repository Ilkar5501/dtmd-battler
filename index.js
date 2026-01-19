import "dotenv/config";
import {
  Client,
  GatewayIntentBits,
  Events,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} from "discord.js";

import characters from "./characters.js";
import { initDb, getUserInvIds, addCard, getInventory, getCard } from "./db.js";

// --------------------
// Settings
// --------------------
const SPAWN_CHANNEL_ID = "1429875206574313624";
const SPAWN_COOLDOWN_MS = 30_000;

// In-memory spawn state (one spawn at a time)
let lastSpawnAt = 0;
let activeSpawn = null; // { messageId, characterKey, claimed: boolean }

// --------------------
// Client setup
// --------------------
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

// --------------------
// Helpers
// --------------------
async function getLowestAvailableInvId(userId) {
  const ids = await getUserInvIds(userId); // sorted asc
  let expected = 1;
  for (const id of ids) {
    if (id === expected) expected++;
    else if (id > expected) break;
  }
  return expected;
}

// --------------------
// Ready
// --------------------
client.once(Events.ClientReady, async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);

  // Initialize DB tables
  await initDb();
  console.log("✅ DB ready");
});

// --------------------
// Spawn logic (message-triggered)
// --------------------
client.on(Events.MessageCreate, async (message) => {
  try {
    if (message.author.bot) return;
    if (message.channelId !== SPAWN_CHANNEL_ID) return;

    const now = Date.now();

    // enforce cooldown
    if (now - lastSpawnAt < SPAWN_COOLDOWN_MS) return;

    // only allow 1 active spawn at a time until it is claimed
    if (activeSpawn && !activeSpawn.claimed) return;

    // pick random character (1/22 assuming characters.length === 22)
    const picked = characters[Math.floor(Math.random() * characters.length)];

    const embed = new EmbedBuilder().setTitle(picked.name).setImage(picked.imageUrl);

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`claim:${picked.key}`)
        .setLabel("Claim")
        .setStyle(ButtonStyle.Success)
    );

    const sent = await message.channel.send({ embeds: [embed], components: [row] });

    activeSpawn = { messageId: sent.id, characterKey: picked.key, claimed: false };
    lastSpawnAt = now;
  } catch (err) {
    console.error("spawn error:", err);
  }
});

// --------------------
// Interactions (buttons + slash commands)
// --------------------
client.on(Events.InteractionCreate, async (interaction) => {
  try {
    // --------------------
    // Claim button
    // --------------------
    if (interaction.isButton() && interaction.customId.startsWith("claim:")) {
      // Must match the active spawn message
      if (!activeSpawn || interaction.message.id !== activeSpawn.messageId) {
        return interaction.reply({ content: "That spawn is no longer active.", ephemeral: true });
      }

      if (activeSpawn.claimed) {
        return interaction.reply({ content: "Already claimed!", ephemeral: true });
      }

      const userId = interaction.user.id;
      const characterKey = activeSpawn.characterKey;

      // Mark claimed first to prevent double-claim in the same process
      activeSpawn.claimed = true;

      // Assign lowest available inventory ID
      const invId = await getLowestAvailableInvId(userId);

      // Save to DB
      await addCard(userId, invId, characterKey);

      // Disable the button
      const disabledRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`claim:${characterKey}`)
          .setLabel("Claimed")
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(true)
      );

      await interaction.update({ components: [disabledRow] });

      // Public message announcing winner
      await interaction.followUp({
        content: `✅ <@${userId}> claimed **#${invId}**!`,
        ephemeral: false,
      });

      return;
    }

    // --------------------
    // Slash commands
    // --------------------
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === "inventory") {
      const rows = await getInventory(interaction.user.id);

      if (!rows.length) {
        return interaction.reply({ content: "You have no cards yet.", ephemeral: true });
      }

      // Show a simple list: #ID — Character Name
      const lines = rows.map((r) => {
        const picked = characters.find((c) => c.key === r.character_key);
        const display = picked ? picked.name : r.character_key;
        return `#${r.inv_id} — ${display}`;
      });

      return interaction.reply({ content: lines.join("\n"), ephemeral: true });
    }

    if (interaction.commandName === "card") {
      const id = interaction.options.getInteger("id");
      const card = await getCard(interaction.user.id, id);

      if (!card) {
        return interaction.reply({ content: "Card not found for that ID.", ephemeral: true });
      }

      const picked = characters.find((c) => c.key === card.character_key);
      if (!picked) {
        return interaction.reply({
          content: "That card exists, but the character list is missing its data.",
          ephemeral: true,
        });
      }

      const embed = new EmbedBuilder().setTitle(picked.name).setImage(picked.imageUrl);

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }
  } catch (err) {
    console.error("interaction error:", err);
    if (interaction.isRepliable()) {
      try {
        await interaction.reply({ content: "Something went wrong.", ephemeral: true });
      } catch {}
    }
  }
});

client.login(process.env.DISCORD_TOKEN);
