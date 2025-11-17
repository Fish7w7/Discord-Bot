// bot/index.js - Bot com Sistema de IA v3.0
require('dotenv').config();
const { Client, GatewayIntentBits, ActivityType } = require('discord.js');
const { 
  joinVoiceChannel, 
  VoiceConnectionStatus, 
  entersState,
  getVoiceConnection 
} = require('@discordjs/voice');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const config = require('../bot.config');
const ttsManager = require('./tts');
const aiHandler = require('./gemini-handler');  // ⭐ Gemini API MELHORADO

const TOKEN = process.env.DISCORD_BOT_TOKEN;
const PORT = process.env.DASHBOARD_PORT || 3001;

if (!TOKEN) {
  console.error('❌ DISCORD_BOT_TOKEN não encontrado no .env!');
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMembers
  ]
});

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.use(cors());
app.use(express.json());
app.use(express.static('dashboard/public'));

let state = {
  isOnline: false,
  currentGuild: null,
  currentChannel: null,
  currentVoiceChannel: null,
  recentMessages: [],
  stats: {
    messagesSent: 0,
    reactionsAdded: 0,
    voiceJoins: 0,
    aiResponsesGenerated: 0  // ⭐ NOVO
  }
};

// ======================
// UTILIDADES
// ======================

function randomDelay(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function simulateTyping(channel) {
  const duration = randomDelay(
    config.personality.typingDuration.min,
    config.personality.typingDuration.max
  );
  channel.sendTyping().catch(() => {});
  return new Promise(resolve => setTimeout(resolve, duration));
}

// ======================
// 😊 REAÇÕES CONTEXTUAIS
// ======================

function getContextualReaction(message) {
  const content = message.content.toLowerCase();
  
  const reactionMap = {
    'te amo|amo|love|coração|❤️': ['❤️', '😊', '🥰', '😍'],
    'kkk|haha|rsrs|lol|engracado|engraçado': ['😂', '🤣', '😆'],
    'pizza|hamburguer|comida|fome|delicia|delícia': ['🍕', '🍔', '🤤', '😋'],
    'jogo|jogar|game|valorant|ganhou|win': ['🎮', '🏆', '🔥', '💪'],
    'triste|sad|chato|ruim|problema': ['😢', '😔', '💔'],
    'odeio|raiva|merda|porra|caralho': ['😡', '👀', '🔥'],
    'nossa|caramba|wtf|serio|sério': ['😱', '😲', '👀'],
    'verdade|exato|concordo|sim|certeza': ['👍', '✅', '💯'],
    'nao|não|nunca|jamais': ['❌', '🚫', '👎'],
    '.*': ['👀', '🔥', '💀', '😎', '🤔']
  };
  
  for (const [pattern, emojis] of Object.entries(reactionMap)) {
    const regex = new RegExp(pattern, 'i');
    if (regex.test(content)) {
      return emojis[Math.floor(Math.random() * emojis.length)];
    }
  }
  
  return config.vocabulary.emojis[Math.floor(Math.random() * config.vocabulary.emojis.length)];
}

// ======================
// 🧠 SISTEMA DE RESPOSTA INTELIGENTE COM IA
// ======================

async function handleIntelligentResponse(message) {
  try {
    const content = message.content.toLowerCase();
    
    // 1. Decide se deve responder
    const shouldRespond = decideShouldRespond(message, content);
    if (!shouldRespond) {
      console.log('🤔 Decidiu não responder desta vez');
      return;
    }

    console.log('💬 Decidiu responder!');

    // 2. Gera resposta usando IA
    let response;
    
    if (config.aiSystem.enabled) {
      response = await aiHandler.generateResponse(message);
      state.stats.aiResponsesGenerated++;
    } else {
      // Fallback se IA desabilitada
      response = config.aiSystem.fallbackResponses[
        Math.floor(Math.random() * config.aiSystem.fallbackResponses.length)
      ];
    }

    // 3. Envia resposta
    await sendMessage(message.channelId, response);

  } catch (error) {
    console.error('❌ Erro ao gerar resposta:', error);
  }
}

function decideShouldRespond(message, content) {
  const { responseProbability } = config.personality;
  
  // PRIORIDADE 1: Menção direta (SEMPRE responde)
  if (content.includes(config.bot.name.toLowerCase()) || content.includes('lu ')) {
    return Math.random() < responseProbability.directMention;
  }
  
  // PRIORIDADE 2: Resposta direta ao bot
  if (message.reference) {
    // Se alguém respondeu uma mensagem do bot, responde de volta!
    return Math.random() < 0.8; // 80% de chance
  }
  
  // PRIORIDADE 3: Pergunta
  if (content.includes('?')) {
    return Math.random() < responseProbability.question;
  }
  
  // PRIORIDADE 4: Conversa ativa (várias mensagens recentes no canal)
  const recentInChannel = state.recentMessages.filter(
    m => m.channelId === message.channelId && 
         Date.now() - m.timestamp < 60000 // Último minuto
  ).length;
  
  if (recentInChannel > 3) {
    // Canal ativo, responde mais
    return Math.random() < responseProbability.conversation;
  }
  
  // PRIORIDADE 5: Resposta aleatória
  return Math.random() < responseProbability.random;
}

// ======================
// ENVIAR MENSAGEM
// ======================

async function sendMessage(channelId, text) {
  try {
    const channel = await client.channels.fetch(channelId);
    if (!channel || !channel.isTextBased()) {
      return { success: false, error: 'Canal inválido' };
    }

    const delay = randomDelay(
      config.personality.responseDelay.min,
      config.personality.responseDelay.max
    );
    
    await new Promise(resolve => setTimeout(resolve, delay));
    await simulateTyping(channel);
    
    const sentMessage = await channel.send(text);
    state.stats.messagesSent++;
    
    console.log('✅ Mensagem enviada:', text);
    
    return { success: true, message: sentMessage, humanizedText: text };
  } catch (error) {
    console.error('❌ Erro ao enviar mensagem:', error);
    return { success: false, error: error.message };
  }
}

// ======================
// VOICE (mantido igual)
// ======================

async function joinVoice(channelId, shouldSpeak = true) {
  try {
    const channel = await client.channels.fetch(channelId);
    if (!channel || !channel.isVoiceBased()) {
      return { success: false, error: 'Canal de voz inválido' };
    }
    
    const existingConnection = getVoiceConnection(channel.guild.id);
    if (existingConnection) existingConnection.destroy();
    
    const connection = joinVoiceChannel({
      channelId: channel.id,
      guildId: channel.guild.id,
      adapterCreator: channel.guild.voiceAdapterCreator,
      selfDeaf: false,
      selfMute: false
    });
    
    await entersState(connection, VoiceConnectionStatus.Ready, 30_000);
    state.currentVoiceChannel = { id: channel.id, name: channel.name };
    state.stats.voiceJoins++;
    
    if (shouldSpeak) {
      setTimeout(async () => {
        const greetings = ['fala galera', 'e ai pessoal', 'opa', 'salve'];
        const greeting = greetings[Math.floor(Math.random() * greetings.length)];
        const conn = getVoiceConnection(channel.guild.id);
        if (conn) await ttsManager.addToQueue(greeting, conn);
      }, 2000);
    }
    
    return { success: true, channelName: channel.name };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

function leaveVoice(guildId) {
  try {
    const connection = getVoiceConnection(guildId);
    if (connection) {
      connection.destroy();
      state.currentVoiceChannel = null;
      return { success: true };
    }
    return { success: false, error: 'Não está em nenhum canal' };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function speakInVoice(text) {
  try {
    if (!state.currentVoiceChannel) {
      return { success: false, error: 'Não está em nenhum canal de voz' };
    }
    const connection = getVoiceConnection(state.currentGuild.id);
    if (!connection) {
      return { success: false, error: 'Conexão de voz perdida' };
    }
    await ttsManager.addToQueue(text, connection);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// ======================
// EVENTOS DISCORD
// ======================

client.once('clientReady', async () => {
  console.log('✅ Bot conectado como:', client.user.tag);
  console.log('🎭 Personificando:', config.bot.name);
  console.log('🤖 Sistema de IA:', config.aiSystem.enabled ? 'ATIVADO' : 'DESATIVADO');
  
  const { status } = config.bot;

  try {
    const presence = {
      activities: [{
        name: status.name,
        type: ActivityType.Playing,
        details: status.details || undefined,
        state: status.state || undefined,
      }],
      status: 'online'
    };

    if (status.timestamps) {
      presence.activities[0].timestamps = { start: Date.now() };
    }

    await client.user.setPresence(presence);
    console.log(`✅ Rich Presence: PLAYING ${status.name}`);
  } catch (error) {
    console.error('❌ Erro ao definir Rich Presence:', error);
  }
  
  const guild = client.guilds.cache.first();
  if (guild) {
    state.currentGuild = { id: guild.id, name: guild.name };
    state.isOnline = true;
    console.log('🏠 Servidor:', guild.name);
  }
  
  io.emit('botReady', { ready: true, guild: state.currentGuild });

  // Limpa histórico antigo periodicamente
  setInterval(() => {
    aiHandler.clearOldHistory();
  }, 60000);  // A cada 1 minuto
});

client.on('messageCreate', async (message) => {
  if (message.author.id === client.user.id) return;
  if (message.author.bot) return;

  // Atualiza feed
  state.recentMessages.unshift({
    id: message.id,
    author: message.author.username,
    content: message.content,
    channelId: message.channelId,
    channelName: message.channel.name,
    timestamp: message.createdTimestamp,
    guildId: message.guildId
  });
  
  if (state.recentMessages.length > 50) {
    state.recentMessages = state.recentMessages.slice(0, 50);
  }
  
  io.emit('newMessage', {
    author: message.author.username,
    content: message.content,
    channel: message.channel.name,
    timestamp: new Date().toLocaleTimeString()
  });

  // 🧠 RESPOSTA INTELIGENTE COM IA
  await handleIntelligentResponse(message);
  
  // 😊 REAÇÕES
  if (Math.random() < config.personality.reactionChance) {
    try {
      const emoji = getContextualReaction(message);
      await message.react(emoji);
      state.stats.reactionsAdded++;
    } catch (error) {
      console.error('❌ Erro ao reagir:', error);
    }
  }
});

client.on('voiceStateUpdate', async (oldState, newState) => {
  if (newState.member.id === client.user.id) return;
  
  if (!oldState.channelId && newState.channelId) {
    console.log(`🎤 ${newState.member.user.username} entrou no canal`);
    
    if (Math.random() < config.personality.voiceJoinChance) {
      const delay = randomDelay(5000, 30000);
      setTimeout(async () => {
        await joinVoice(newState.channelId);
      }, delay);
    }
  }
  
  if (oldState.channelId && !newState.channelId) {
    const channel = oldState.channel;
    if (state.currentVoiceChannel && channel.members.size === 1) {
      setTimeout(() => leaveVoice(oldState.guild.id), randomDelay(5000, 15000));
    }
  }
});

// ======================
// API REST
// ======================

app.get('/api/status', (req, res) => {
  res.json({
    online: state.isOnline,
    bot: { username: client.user?.username, id: client.user?.id, ...config.bot },
    guild: state.currentGuild,
    stats: state.stats,
    aiEnabled: config.aiSystem.enabled  // ⭐ NOVO
  });
});

app.get('/api/messages', (req, res) => {
  res.json({ messages: state.recentMessages });
});

app.get('/api/channels', async (req, res) => {
  try {
    if (!state.currentGuild) return res.json({ channels: [] });
    const guild = await client.guilds.fetch(state.currentGuild.id);
    const channels = guild.channels.cache
      .filter(c => c.isTextBased())
      .map(c => ({ id: c.id, name: c.name, type: c.type }));
    res.json({ channels });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/voice-channels', async (req, res) => {
  try {
    if (!state.isOnline || !state.currentGuild) {
      return res.json({ channels: [], error: 'Bot ainda conectando...' });
    }
    const guild = await client.guilds.fetch(state.currentGuild.id);
    const voiceChannels = guild.channels.cache
      .filter(c => c.isVoiceBased())
      .map(c => ({ id: c.id, name: c.name, members: c.members.size }));
    res.json({ channels: voiceChannels });
  } catch (error) {
    res.status(500).json({ error: error.message, channels: [] });
  }
});

app.post('/api/voice/join', async (req, res) => {
  const result = await joinVoice(req.body.channelId);
  res.json(result);
});

app.post('/api/voice/leave', async (req, res) => {
  if (!state.currentGuild) return res.status(400).json({ error: 'Não está em nenhum servidor' });
  const result = leaveVoice(state.currentGuild.id);
  res.json(result);
});

app.get('/api/voice/status', (req, res) => {
  res.json({ inVoice: state.currentVoiceChannel !== null, channel: state.currentVoiceChannel });
});

app.post('/api/voice/speak', async (req, res) => {
  if (!req.body.text) return res.status(400).json({ error: 'text é obrigatório' });
  const result = await speakInVoice(req.body.text);
  res.json(result);
});

app.post('/api/voice/stop', (req, res) => {
  ttsManager.stop();
  res.json({ success: true });
});

app.post('/api/send', async (req, res) => {
  const { channelId, text } = req.body;
  if (!channelId || !text) return res.status(400).json({ error: 'channelId e text são obrigatórios' });
  const result = await sendMessage(channelId, text);
  res.json(result);
});

// ======================
// WEBSOCKET
// ======================

io.on('connection', (socket) => {
  console.log('📱 Dashboard conectado');
  socket.on('sendMessage', async (data) => {
    const result = await sendMessage(data.channelId, data.text);
    socket.emit('messageSent', result);
  });
  socket.on('disconnect', () => console.log('📱 Dashboard desconectado'));
});

// ======================
// INICIAR
// ======================

server.listen(PORT, () => {
  console.log(`🌐 Dashboard rodando em http://localhost:${PORT}`);
});

client.login(TOKEN).catch(error => {
  console.error('❌ Erro ao conectar bot:', error);
  process.exit(1);
});