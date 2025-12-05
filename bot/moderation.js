// bot/moderation.js - Sistema de Moderação
class ModerationSystem {
  constructor() {
    this.spamTracker = new Map();
    this.bannedWords = process.env.BANNED_WORDS?.split(',').map(w => w.trim().toLowerCase()) || [];
    this.warningTracker = new Map();
    
    console.log(`🛡️ Sistema de moderação ativo com ${this.bannedWords.length} palavras banidas`);
    
    // Limpar trackers antigos a cada 10 minutos
    setInterval(() => {
      this.cleanOldTrackers();
    }, 600000);
  }

  /**
   * Verifica se usuário está fazendo spam
   * @param {string} userId - ID do usuário
   * @returns {boolean}
   */
  isSpam(userId) {
    const now = Date.now();
    const userHistory = this.spamTracker.get(userId) || [];
    
    // Remove mensagens antigas (mais de 10 segundos)
    const recentMessages = userHistory.filter(t => now - t < 10000);
    
    // Se mais de 5 mensagens em 10 segundos, é spam
    if (recentMessages.length >= 5) {
      this.addWarning(userId, 'spam');
      return true;
    }
    
    recentMessages.push(now);
    this.spamTracker.set(userId, recentMessages);
    return false;
  }

  /**
   * Verifica se mensagem contém palavras banidas
   * @param {string} content - Conteúdo da mensagem
   * @returns {boolean}
   */
  containsBannedWords(content) {
    if (this.bannedWords.length === 0) return false;
    
    const lowerContent = content.toLowerCase();
    return this.bannedWords.some(word => {
      // Verifica palavra exata ou parte de palavra
      const regex = new RegExp(`\\b${word}\\b|${word}`, 'i');
      return regex.test(lowerContent);
    });
  }

  /**
   * Verifica se mensagem contém URLs suspeitas
   * @param {string} content - Conteúdo da mensagem
   * @returns {boolean}
   */
  containsSuspiciousLinks(content) {
    // Padrões de URLs suspeitas
    const suspiciousPatterns = [
      /discord\.gg\/(?!official)/i, // Links de Discord (exceto oficial)
      /bit\.ly|tinyurl\.com|goo\.gl/i, // Encurtadores
      /free.*nitro/i, // Scams de Nitro
      /give.*away/i, // Giveaways falsos
    ];
    
    return suspiciousPatterns.some(pattern => pattern.test(content));
  }

  /**
   * Verifica se mensagem é flood (muitos caracteres repetidos)
   * @param {string} content - Conteúdo da mensagem
   * @returns {boolean}
   */
  isFlood(content) {
    // Se mais de 30% da mensagem são caracteres repetidos
    const chars = content.split('');
    const charCount = {};
    
    chars.forEach(char => {
      charCount[char] = (charCount[char] || 0) + 1;
    });
    
    const maxRepeat = Math.max(...Object.values(charCount));
    const floodPercentage = maxRepeat / content.length;
    
    return floodPercentage > 0.3 && content.length > 20;
  }

  /**
   * Adiciona advertência a um usuário
   * @param {string} userId - ID do usuário
   * @param {string} reason - Motivo da advertência
   */
  addWarning(userId, reason) {
    const warnings = this.warningTracker.get(userId) || [];
    warnings.push({
      reason,
      timestamp: Date.now()
    });
    this.warningTracker.set(userId, warnings);
    
    console.log(`⚠️ Advertência para ${userId}: ${reason} (Total: ${warnings.length})`);
  }

  /**
   * Obtém número de advertências de um usuário
   * @param {string} userId - ID do usuário
   * @returns {number}
   */
  getWarnings(userId) {
    const warnings = this.warningTracker.get(userId) || [];
    // Remove advertências antigas (mais de 1 hora)
    const recent = warnings.filter(w => Date.now() - w.timestamp < 3600000);
    this.warningTracker.set(userId, recent);
    return recent.length;
  }

  /**
   * Verifica se deve ignorar mensagem
   * @param {Object} message - Objeto de mensagem do Discord
   * @returns {Object} { shouldIgnore: boolean, reason: string }
   */
  shouldIgnoreMessage(message) {
    // 1. Verifica spam
    if (this.isSpam(message.author.id)) {
      return { shouldIgnore: true, reason: 'Spam detectado' };
    }

    // 2. Verifica palavras banidas
    if (this.containsBannedWords(message.content)) {
      this.addWarning(message.author.id, 'banned_word');
      return { shouldIgnore: true, reason: 'Palavra banida detectada' };
    }

    // 3. Verifica flood
    if (this.isFlood(message.content)) {
      this.addWarning(message.author.id, 'flood');
      return { shouldIgnore: true, reason: 'Flood detectado' };
    }

    // 4. Verifica links suspeitos
    if (this.containsSuspiciousLinks(message.content)) {
      this.addWarning(message.author.id, 'suspicious_link');
      return { shouldIgnore: true, reason: 'Link suspeito detectado' };
    }

    // 5. Verifica se usuário tem muitas advertências
    if (this.getWarnings(message.author.id) >= 3) {
      return { shouldIgnore: true, reason: 'Muitas advertências recentes' };
    }

    return { shouldIgnore: false, reason: null };
  }

  /**
   * Limpa trackers antigos
   */
  cleanOldTrackers() {
    const oneHourAgo = Date.now() - 3600000;
    
    // Limpar spam tracker
    for (const [userId, messages] of this.spamTracker.entries()) {
      const recent = messages.filter(t => t > oneHourAgo);
      if (recent.length === 0) {
        this.spamTracker.delete(userId);
      } else {
        this.spamTracker.set(userId, recent);
      }
    }
    
    // Limpar warning tracker
    for (const [userId, warnings] of this.warningTracker.entries()) {
      const recent = warnings.filter(w => w.timestamp > oneHourAgo);
      if (recent.length === 0) {
        this.warningTracker.delete(userId);
      } else {
        this.warningTracker.set(userId, recent);
      }
    }
    
    console.log(`🧹 Moderação limpa: ${this.spamTracker.size} spam trackers, ${this.warningTracker.size} warnings`);
  }

  /**
   * Obtém estatísticas de moderação
   * @returns {Object}
   */
  getStats() {
    return {
      activeSpamTrackers: this.spamTracker.size,
      totalWarnings: Array.from(this.warningTracker.values()).reduce((sum, arr) => sum + arr.length, 0),
      usersWithWarnings: this.warningTracker.size,
      bannedWordsCount: this.bannedWords.length
    };
  }

  /**
   * Reseta advertências de um usuário
   * @param {string} userId - ID do usuário
   */
  resetWarnings(userId) {
    this.warningTracker.delete(userId);
    this.spamTracker.delete(userId);
    console.log(`✅ Advertências resetadas para ${userId}`);
  }
}

module.exports = new ModerationSystem();