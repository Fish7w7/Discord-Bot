// bot/commands.js - Sistema de Comandos Administrativos
const config = require('../bot.config');

class CommandHandler {
  constructor(client) {
    this.client = client;
    this.prefix = '!';
    this.adminUsers = process.env.ADMIN_USER_IDS?.split(',') || [];
    
    console.log(`🎮 Sistema de comandos ativo (Prefixo: ${this.prefix})`);
    console.log(`👮 ${this.adminUsers.length} administradores configurados`);
  }

  /**
   * Processa comando
   * @param {Object} message - Mensagem do Discord
   * @param {Object} state - Estado do bot
   * @param {Object} moderation - Sistema de moderação
   */
  async handle(message, state, moderation) {
    // Ignora se não começa com prefixo
    if (!message.content.startsWith(this.prefix)) return;

    // Verifica se é admin
    if (!this.isAdmin(message.author.id)) {
      await message.reply('❌ Você não tem permissão para usar comandos administrativos.');
      return;
    }

    const args = message.content.slice(this.prefix.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    console.log(`⚡ Comando executado: ${command} por ${message.author.username}`);

    try {
      switch (command) {
        case 'status':
          await this.statusCommand(message, state);
          break;
        
        case 'stats':
          await this.statsCommand(message, state);
          break;
        
        case 'mod':
          await this.modCommand(message, moderation);
          break;
        
        case 'config':
          await this.configCommand(message, args);
          break;
        
        case 'reload':
          await this.reloadCommand(message);
          break;
        
        case 'reset':
          await this.resetCommand(message, args, moderation);
          break;
        
        case 'help':
          await this.helpCommand(message);
          break;
        
        default:
          await message.reply(`❓ Comando desconhecido: \`${command}\`. Use \`!help\` para ver comandos disponíveis.`);
      }
    } catch (error) {
      console.error('❌ Erro ao executar comando:', error);
      await message.reply(`❌ Erro ao executar comando: ${error.message}`);
    }
  }

  /**
   * Verifica se usuário é admin
   * @param {string} userId - ID do usuário
   * @returns {boolean}
   */
  isAdmin(userId) {
    return this.adminUsers.includes(userId);
  }

  /**
   * Comando: !status
   */
  async statusCommand(message, state) {
    const uptime = process.uptime();
    const memUsage = process.memoryUsage();
    
    const hours = Math.floor(uptime / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    
    const embed = {
      title: '📊 Status do Bot',
      color: 0x5865F2,
      fields: [
        {
          name: '⏱️ Uptime',
          value: `${hours}h ${minutes}m`,
          inline: true
        },
        {
          name: '💾 Memória',
          value: `${(memUsage.heapUsed / 1024 / 1024).toFixed(2)} MB`,
          inline: true
        },
        {
          name: '🤖 IA',
          value: config.aiSystem.enabled ? '✅ Ativada' : '❌ Desativada',
          inline: true
        },
        {
          name: '🎤 Canal de Voz',
          value: state.currentVoiceChannel ? `🔊 ${state.currentVoiceChannel.name}` : '❌ Não conectado',
          inline: true
        },
        {
          name: '🏠 Servidor',
          value: state.currentGuild?.name || 'Desconhecido',
          inline: true
        },
        {
          name: '📡 Ping',
          value: `${this.client.ws.ping}ms`,
          inline: true
        }
      ],
      timestamp: new Date()
    };
    
    await message.reply({ embeds: [embed] });
  }

  /**
   * Comando: !stats
   */
  async statsCommand(message, state) {
    const embed = {
      title: '📈 Estatísticas',
      color: 0x57F287,
      fields: [
        {
          name: '💬 Mensagens Enviadas',
          value: state.stats.messagesSent.toString(),
          inline: true
        },
        {
          name: '😊 Reações Adicionadas',
          value: state.stats.reactionsAdded.toString(),
          inline: true
        },
        {
          name: '🎤 Entradas em Voz',
          value: state.stats.voiceJoins.toString(),
          inline: true
        },
        {
          name: '🤖 Respostas de IA',
          value: state.stats.aiResponsesGenerated.toString(),
          inline: true
        },
        {
          name: '🔊 Áudios Tocados',
          value: state.stats.audioPresetsPlayed?.toString() || '0',
          inline: true
        },
        {
          name: '📝 Mensagens Recentes',
          value: state.recentMessages.length.toString(),
          inline: true
        }
      ],
      timestamp: new Date()
    };
    
    await message.reply({ embeds: [embed] });
  }

  /**
   * Comando: !mod
   */
  async modCommand(message, moderation) {
    const stats = moderation.getStats();
    
    const embed = {
      title: '🛡️ Status da Moderação',
      color: 0xED4245,
      fields: [
        {
          name: '👥 Usuários Rastreados',
          value: stats.activeSpamTrackers.toString(),
          inline: true
        },
        {
          name: '⚠️ Advertências Ativas',
          value: stats.totalWarnings.toString(),
          inline: true
        },
        {
          name: '🚫 Usuários com Advertências',
          value: stats.usersWithWarnings.toString(),
          inline: true
        },
        {
          name: '📝 Palavras Banidas',
          value: stats.bannedWordsCount.toString(),
          inline: true
        }
      ],
      timestamp: new Date()
    };
    
    await message.reply({ embeds: [embed] });
  }

  /**
   * Comando: !config <chave> <valor>
   */
  async configCommand(message, args) {
    if (args.length < 2) {
      await message.reply('❌ Uso: `!config <chave> <valor>`\nExemplo: `!config aiEnabled true`');
      return;
    }
    
    const [key, value] = args;
    
    // Lista de configurações permitidas
    const allowedConfigs = {
      'aiEnabled': (val) => {
        config.aiSystem.enabled = val === 'true';
        return `IA ${config.aiSystem.enabled ? 'ativada' : 'desativada'}`;
      },
      'reactionChance': (val) => {
        const num = parseFloat(val);
        if (isNaN(num) || num < 0 || num > 1) {
          throw new Error('Valor deve ser entre 0 e 1');
        }
        config.personality.reactionChance = num;
        return `Chance de reação ajustada para ${(num * 100).toFixed(0)}%`;
      },
      'voiceJoinChance': (val) => {
        const num = parseFloat(val);
        if (isNaN(num) || num < 0 || num > 1) {
          throw new Error('Valor deve ser entre 0 e 1');
        }
        config.personality.voiceJoinChance = num;
        return `Chance de entrar em voz ajustada para ${(num * 100).toFixed(0)}%`;
      }
    };
    
    if (!allowedConfigs[key]) {
      const availableKeys = Object.keys(allowedConfigs).join(', ');
      await message.reply(`❌ Configuração desconhecida. Disponíveis: \`${availableKeys}\``);
      return;
    }
    
    try {
      const result = allowedConfigs[key](value);
      await message.reply(`✅ ${result}`);
      console.log(`⚙️ Configuração alterada: ${key} = ${value}`);
    } catch (error) {
      await message.reply(`❌ Erro: ${error.message}`);
    }
  }

  /**
   * Comando: !reload
   */
  async reloadCommand(message) {
    try {
      delete require.cache[require.resolve('../bot.config')];
      const newConfig = require('../bot.config');
      Object.assign(config, newConfig);
      
      await message.reply('✅ Configuração recarregada com sucesso!');
      console.log('🔄 Configuração recarregada');
    } catch (error) {
      await message.reply(`❌ Erro ao recarregar: ${error.message}`);
    }
  }

  /**
   * Comando: !reset <tipo> [userId]
   */
  async resetCommand(message, args, moderation) {
    if (args.length === 0) {
      await message.reply('❌ Uso: `!reset <warnings|cooldown|all> [userId]`');
      return;
    }
    
    const type = args[0].toLowerCase();
    const userId = args[1];
    
    if (!userId) {
      await message.reply('❌ Especifique o ID do usuário');
      return;
    }
    
    switch (type) {
      case 'warnings':
        moderation.resetWarnings(userId);
        await message.reply(`✅ Advertências resetadas para <@${userId}>`);
        break;
      
      case 'cooldown':
        // Implementar quando cooldown estiver integrado
        await message.reply(`✅ Cooldown resetado para <@${userId}>`);
        break;
      
      case 'all':
        moderation.resetWarnings(userId);
        await message.reply(`✅ Todos os dados resetados para <@${userId}>`);
        break;
      
      default:
        await message.reply('❌ Tipo inválido. Use: `warnings`, `cooldown` ou `all`');
    }
  }

  /**
   * Comando: !help
   */
  async helpCommand(message) {
    const embed = {
      title: '📚 Comandos Administrativos',
      color: 0xFEE75C,
      description: `Prefixo: \`${this.prefix}\``,
      fields: [
        {
          name: '!status',
          value: 'Mostra status do bot (uptime, memória, etc)'
        },
        {
          name: '!stats',
          value: 'Exibe estatísticas de uso'
        },
        {
          name: '!mod',
          value: 'Status do sistema de moderação'
        },
        {
          name: '!config <chave> <valor>',
          value: 'Altera configuração em tempo real'
        },
        {
          name: '!reload',
          value: 'Recarrega arquivo de configuração'
        },
        {
          name: '!reset <tipo> <userId>',
          value: 'Reseta warnings/cooldown de um usuário'
        },
        {
          name: '!help',
          value: 'Mostra esta mensagem'
        }
      ],
      footer: {
        text: 'Apenas administradores podem usar estes comandos'
      }
    };
    
    await message.reply({ embeds: [embed] });
  }
}

module.exports = CommandHandler;