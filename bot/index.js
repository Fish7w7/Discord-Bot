// bot/index.js - Bot Melhorado com Segurança e Performance
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
const voicePresets = require('./voice-presets');
const aiHandler = require('./gemini-handler');
const CommandHandler = require('./commands');
const moderation = require('./moderation');
const cooldownManager = require('./cooldown');

// ✅ CORREÇÃO: Nome da variável padronizado
const TOKEN = process.env.DISCORD_TOKEN || process.env.DISCORD_BOT_TOKEN;
const PORT = process.env.DASHBOARD_PORT || 3001;
const DASHBOARD_PASSWORD = process.env.DASHBOARD_PASSWORD;

if (!TOKEN) {
  console.error('❌ DISCORD_TOKEN não encontrado no .env!');
  process.exit(1);
}

if (!DASHBOARD_PASSWORD) {
  console.warn('⚠️ DASHBOARD_PASSWORD não configurado - Dashboard sem autenticação!');
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
app.use(express.json({ limit: '10mb' })); // ✅ Limite de payload
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
    aiResponsesGenerated: 0,
    audioPresetsPlayed: 0
  }
};

// Inicializar sistema de comandos
const commandHandler = new CommandHandler(client);

// ======================
// 🔐 MIDDLEWARE DE AUTENTICAÇÃO
// ======================
function authMiddleware(req, res, next) {
  if (!DASHBOARD_PASSWORD) {
    return next(); // Sem senha configurada, permite acesso
  }
  
  const authHeader = req.headers.authorization;
  if (!authHeader || authHeader !== `Bearer ${DASHBOARD_PASSWORD}`) {
    return res.status(401).json({ error: 'Não autorizado' });
  }
  
  next();
}

// ======================
// ✅ VALIDAÇÃO DE ENTRADA
// ======================
function validateChannelId(channelId) {
  if (!channelId || typeof channelId !== 'string') {
    throw new Error('ID de canal inválido');
  }
  if (!/^\d{17,19}$/.test(channelId)) {
    throw new Error('Formato de ID de canal inválido');
  }
  return true;
}

function validateMessageText(text) {
  if (!text || typeof text !== 'string') {
    throw new Error('Texto inválido');
  }
  if (text.length > 2000) {
    throw new Error('Texto muito longo (máximo 2000 caracteres)');
  }
  // Remove tags HTML perigosas
  const sanitized = text.replace(/<script[^>]*>.*?<\/script>/gi, '')
                        .replace(/<iframe[^>]*>.*?<\/iframe>/gi, '');
  return sanitized;
}

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
    
    // ✅ Verifica cooldown
    if (cooldownManager.isOnCooldown(message.author.id, message.channelId)) {
      console.log('🕐 Usuário em cooldown');
      return;
    }
    
    const shouldRespond = decideShouldRespond(message, content);
    if (!shouldRespond) {
      console.log('🤔 Decidiu não responder desta vez');
      return;
    }

    console.log('💬 Decidiu responder!');

    let response;
    
    if (config.aiSystem.enabled) {
      response = await aiHandler.generateResponse(message);
      state.stats.aiResponsesGenerated++;
    } else {
      response = config.aiSystem.fallbackResponses[
        Math.floor(Math.random() * config.aiSystem.fallbackResponses.length)
      ];
    }

    await sendMessage(message.channelId, response);

  } catch (error) {
    console.error('❌ Erro ao gerar resposta:', error);
  }
}

function decideShouldRespond(message, content) {
  const { responseProbability } = config.personality;
  
  if (content.includes(config.bot.name.toLowerCase()) || content.includes('lu ')) {
    return Math.random() < responseProbability.directMention;
  }
  
  if (message.reference) {
    return Math.random() < 0.8;
  }
  
  if (content.includes('?')) {
    return Math.random() < responseProbability.question;
  }
  
  const recentInChannel = state.recentMessages.filter(
    m => m.channelId === message.channelId && 
         Date.now() - m.timestamp < 60000
  ).length;
  
  if (recentInChannel > 3) {
    return Math.random() < responseProbability.conversation;
  }
  
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
// 🎤 VOICE
// ======================
async function joinVoice(channelId, shouldSpeak = false) {
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
      selfMute: true
    });
    
    await entersState(connection, VoiceConnectionStatus.Ready, 30_000);
    state.currentVoiceChannel = { id: channel.id, name: channel.name };
    state.stats.voiceJoins++;
    
    console.log('✅ Entrou no canal de voz (MUTADO)');
    
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

async function playAudioPreset(presetId) {
  try {
    if (!state.currentVoiceChannel) {
      return { success: false, error: 'Não está em nenhum canal de voz' };
    }
    
    const connection = getVoiceConnection(state.currentGuild.id);
    if (!connection) {
      return { success: false, error: 'Conexão de voz perdida' };
    }
    
    const result = await voicePresets.playPreset(presetId, connection);
    
    if (result.success) {
      state.stats.audioPresetsPlayed++;
    }
    
    return result;
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
  console.log('🎵 Presets de áudio:', voicePresets.getPresets().length);
  console.log('🛡️ Sistema de moderação:', 'ATIVO');
  console.log('❄️ Sistema de cooldown:', 'ATIVO');
  
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

  // ✅ Limpeza periódica de memória
  setInterval(() => {
    aiHandler.clearOldHistory();
    
    // Limitar mensagens recentes (evita vazamento de memória)
    const oneHourAgo = Date.now() - 3600000;
    state.recentMessages = state.recentMessages
      .filter(msg => msg.timestamp > oneHourAgo)
      .slice(0, 50);
    
    console.log(`🧹 Limpeza: ${state.recentMessages.length} mensagens recentes`);
  }, 300000); // A cada 5 minutos
});

client.on('messageCreate', async (message) => {
  if (message.author.id === client.user.id) return;
  if (message.author.bot) return;

  // ✅ Sistema de comandos
  if (message.content.startsWith('!')) {
    await commandHandler.handle(message, state, moderation);
    return;
  }

  // ✅ Sistema de moderação
  const modCheck = moderation.shouldIgnoreMessage(message);
  if (modCheck.shouldIgnore) {
    console.log(`🚫 Mensagem ignorada: ${modCheck.reason}`);
    return;
  }

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

  await handleIntelligentResponse(message);
  
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
        await joinVoice(newState.channelId, false);
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

// ✅ Tratamento global de erros
process.on('unhandledRejection', (error) => {
  console.error('❌ Unhandled Rejection:', error);
});

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
});

// ======================
// 🌐 API REST (COM AUTENTICAÇÃO)
// ======================
app.get('/api/status', (req, res) => {
  res.json({
    online: state.isOnline,
    bot: { username: client.user?.username, id: client.user?.id, ...config.bot },
    guild: state.currentGuild,
    stats: state.stats,
    aiEnabled: config.aiSystem.enabled,
    moderation: moderation.getStats(),
    cooldown: cooldownManager.getStats()
  });
});

app.get('/api/messages', (req, res) => {
  res.json({ messages: state.recentMessages.slice(0, 30) }); // ✅ Limita a 30
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

// ✅ Rotas protegidas com autenticação
app.post('/api/voice/join', authMiddleware, async (req, res) => {
  try {
    validateChannelId(req.body.channelId);
    const result = await joinVoice(req.body.channelId, false);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/voice/leave', authMiddleware, async (req, res) => {
  if (!state.currentGuild) return res.status(400).json({ error: 'Não está em nenhum servidor' });
  const result = leaveVoice(state.currentGuild.id);
  res.json(result);
});

app.get('/api/voice/status', (req, res) => {
  res.json({ inVoice: state.currentVoiceChannel !== null, channel: state.currentVoiceChannel });
});

app.get('/api/voice/presets', (req, res) => {
  const presets = voicePresets.getPresets();
  res.json({ presets });
});

app.post('/api/voice/play-preset', authMiddleware, async (req, res) => {
  if (!req.body.presetId) return res.status(400).json({ error: 'presetId é obrigatório' });
  const result = await playAudioPreset(req.body.presetId);
  res.json(result);
});

app.post('/api/send', authMiddleware, async (req, res) => {
  try {
    const { channelId, text } = req.body;
    
    if (!channelId || !text) {
      return res.status(400).json({ error: 'channelId e text são obrigatórios' });
    }
    
    validateChannelId(channelId);
    const sanitizedText = validateMessageText(text);
    
    const result = await sendMessage(channelId, sanitizedText);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// ======================
// WEBSOCKET
// ======================
io.on('connection', (socket) => {
  console.log('📱 Dashboard conectado');
  
  socket.on('sendMessage', async (data) => {
    try {
      validateChannelId(data.channelId);
      const sanitizedText = validateMessageText(data.text);
      const result = await sendMessage(data.channelId, sanitizedText);
      socket.emit('messageSent', result);
    } catch (error) {
      socket.emit('messageSent', { success: false, error: error.message });
    }
  });
  
  socket.on('disconnect', () => console.log('📱 Dashboard desconectado'));
});

// ======================
// INICIAR
// ======================
server.listen(PORT, () => {
  console.log(`🌐 Dashboard rodando em http://localhost:${PORT}`);
  if (DASHBOARD_PASSWORD) {
    console.log('🔐 Dashboard protegido com senha');
  } else {
    console.warn('⚠️ Dashboard SEM proteção de senha!');
  }
});

client.login(TOKEN).catch(error => {
  console.error('❌ Erro ao conectar bot:', error);
  process.exit(1);
});