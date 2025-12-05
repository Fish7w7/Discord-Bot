// bot/cooldown.js - Sistema de Cooldown
class CooldownManager {
  constructor() {
    this.cooldowns = new Map();
    
    // Limpar cooldowns antigos a cada 5 minutos
    setInterval(() => {
      this.clearOldCooldowns();
    }, 300000);
  }

  /**
   * Verifica se usuário está em cooldown
   * @param {string} userId - ID do usuário
   * @param {string} channelId - ID do canal
   * @param {number} duration - Duração do cooldown em ms (padrão: 5 segundos)
   * @returns {boolean}
   */
  isOnCooldown(userId, channelId, duration = 5000) {
    const key = `${userId}-${channelId}`;
    const lastInteraction = this.cooldowns.get(key);
    
    if (lastInteraction && Date.now() - lastInteraction < duration) {
      return true;
    }
    
    this.cooldowns.set(key, Date.now());
    return false;
  }

  /**
   * Verifica se usuário está spamming globalmente
   * @param {string} userId - ID do usuário
   * @param {number} maxMessages - Máximo de mensagens permitidas
   * @param {number} timeWindow - Janela de tempo em ms (padrão: 10 segundos)
   * @returns {boolean}
   */
  isSpamming(userId, maxMessages = 5, timeWindow = 10000) {
    const key = `spam-${userId}`;
    const history = this.cooldowns.get(key) || [];
    const now = Date.now();
    
    // Remove mensagens antigas
    const recentMessages = history.filter(t => now - t < timeWindow);
    
    if (recentMessages.length >= maxMessages) {
      return true;
    }
    
    recentMessages.push(now);
    this.cooldowns.set(key, recentMessages);
    
    return false;
  }

  /**
   * Limpa cooldowns antigos (mais de 1 minuto)
   */
  clearOldCooldowns() {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    
    for (const [key, timestamp] of this.cooldowns.entries()) {
      // Se for timestamp simples
      if (typeof timestamp === 'number' && timestamp < oneMinuteAgo) {
        this.cooldowns.delete(key);
      }
      // Se for array (spam tracking)
      else if (Array.isArray(timestamp)) {
        const recent = timestamp.filter(t => t > oneMinuteAgo);
        if (recent.length === 0) {
          this.cooldowns.delete(key);
        } else {
          this.cooldowns.set(key, recent);
        }
      }
    }
    
    console.log(`🧹 Limpeza: ${this.cooldowns.size} cooldowns ativos`);
  }

  /**
   * Força reset do cooldown de um usuário
   * @param {string} userId - ID do usuário
   * @param {string} channelId - ID do canal (opcional)
   */
  reset(userId, channelId = null) {
    if (channelId) {
      const key = `${userId}-${channelId}`;
      this.cooldowns.delete(key);
    } else {
      // Remove todos os cooldowns do usuário
      for (const key of this.cooldowns.keys()) {
        if (key.startsWith(userId)) {
          this.cooldowns.delete(key);
        }
      }
    }
  }

  /**
   * Obtém estatísticas dos cooldowns
   * @returns {Object}
   */
  getStats() {
    return {
      totalCooldowns: this.cooldowns.size,
      activeCooldowns: Array.from(this.cooldowns.entries())
        .filter(([key, val]) => {
          if (typeof val === 'number') {
            return Date.now() - val < 60000;
          }
          return val.length > 0;
        }).length
    };
  }
}

module.exports = new CooldownManager();