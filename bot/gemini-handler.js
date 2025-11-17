// bot/gemini-handler.js - Sistema com Google Gemini (100% GRÁTIS)
const config = require('../bot.config');

class GeminiHandler {
  constructor() {
    this.conversationHistory = [];
    this.maxHistory = 10;
    this.apiKey = process.env.GEMINI_API_KEY;
    this.apiUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent';
  }

  async generateResponse(message, context = {}) {
    try {
      // 1. Respostas rápidas
      const quickResponse = this.checkQuickResponses(message.content);
      if (quickResponse) {
        console.log('⚡ Usando resposta rápida');
        return quickResponse;
      }

      // 2. Verifica API key
      if (!this.apiKey) {
        console.warn('⚠️ GEMINI_API_KEY não configurada');
        return this.getSmartFallback(message);
      }

      // 3. Prepara contexto
      const conversationContext = this.buildConversationContext(message);
      const messageType = this.detectMessageType(message.content);
      const prompt = this.buildImprovedPrompt(message, conversationContext, messageType);

      console.log('🤖 Gerando resposta com Gemini...');
      console.log('📝 Tipo:', messageType);

      // 4. Chama API
      const response = await fetch(`${this.apiUrl}?key=${this.apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 1.2,  // Mais variado (era 1.0)
            maxOutputTokens: 100,  // Mais curto (era 150)
            topP: 0.95,
            topK: 64
          },
          safetySettings: [
            { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
          ]
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('❌ Erro na API:', errorData);
        return this.getSmartFallback(message);
      }

      const data = await response.json();
      
      // 5. Extrai resposta
      if (!data.candidates || data.candidates.length === 0) {
        console.warn('⚠️ API bloqueou, usando fallback');
        return this.getSmartFallback(message);
      }

      const geminiResponse = data.candidates[0]?.content?.parts?.[0]?.text || '';
      
      if (!geminiResponse || geminiResponse.trim().length < 2) {
        console.warn('⚠️ Resposta vazia, usando fallback');
        return this.getSmartFallback(message);
      }

      console.log('✅ Resposta do Gemini:', geminiResponse);

      const finalResponse = this.postProcessResponse(geminiResponse);
      this.addToHistory(message, finalResponse);

      return finalResponse;

    } catch (error) {
      console.error('❌ Erro no Gemini:', error.message);
      return this.getSmartFallback(message);
    }
  }

  checkQuickResponses(text) {
    const content = text.toLowerCase();

    if (/eu\s+te\s+amo|te\s+amo|amo\s+(vc|voce|você)/i.test(content)) {
      return this.randomChoice([
        'sai fora esquisito',
        'ja pensou o pq de ninguem te amar?',
        'para de ser estranho',
        'cringe',
        'que isso mano'
      ]);
    }

    const insults = ['vsf', 'fdp', 'vai se foder', 'vtmc', 'burra', 'idiota', 'imbecil'];
    if (insults.some(insult => content.includes(insult))) {
      return this.randomChoice([
        'ok amigao',
        'entendi, passa bem',
        'chora mais',
        'e eu com isso?',
        'tanto faz',
        'nossa que medo'
      ]);
    }

    return null;
  }

  detectMessageType(text) {
    const content = text.toLowerCase();

    if (/\b(oi|ola|olá|e ai|eai|bom dia|boa tarde|boa noite)\b/i.test(content)) {
      return 'greeting';
    }
    if (/\b(comida|pizza|fome|comer|hamburguer|lanche)\b/i.test(content)) {
      return 'food';
    }
    if (/\b(jogo|jogar|game|valorant|lol|cs|minecraft)\b/i.test(content)) {
      return 'gaming';
    }
    if (/\b(filme|serie|anime|netflix|assistir)\b/i.test(content)) {
      return 'entertainment';
    }
    if (content.includes('?')) {
      return 'question';
    }

    return 'general';
  }

  buildImprovedPrompt(message, conversationContext, messageType) {
    let prompt = `Você é Luisa, brasileira de 20 anos no Discord.

REGRAS:
1. Máximo 1-2 frases curtas
2. Muito casual (nao, pq, vc, ta, mano, vei)
3. SEM emojis
4. SEM formalidade
5. Gírias brasileiras

`;

    const examples = {
      greeting: 'Exemplo:\nPessoa: oi\nVocê: e ai mano',
      food: 'Exemplo:\nPessoa: to com fome\nVocê: eu tambem, bora pedir pizza',
      gaming: 'Exemplo:\nPessoa: vc gosta de valorant?\nVocê: curto demais, jogo sempre',
      entertainment: 'Exemplo:\nPessoa: viu o filme?\nVocê: nao vi ainda, e bom?',
      question: 'Exemplo:\nPessoa: como vc ta?\nVocê: suave, e tu?',
      general: 'Exemplo:\nPessoa: que legal\nVocê: pois e'
    };

    prompt += examples[messageType] || examples.general;
    prompt += '\n\n';

    if (conversationContext.length > 0) {
      prompt += 'CONTEXTO:\n';
      conversationContext.slice(-3).forEach(msg => {
        // Remove HTML do contexto antes de adicionar
        const cleanContent = msg.content.replace(/<[^>]*>/g, '');
        prompt += `${msg.author}: ${cleanContent}\n`;
      });
    }

    prompt += `\n${message.author.username}: ${message.content}\nLuisa:`;

    return prompt;
  }

  buildConversationContext(currentMessage) {
    return this.conversationHistory
      .filter(msg => msg.channelId === currentMessage.channelId)
      .slice(-5)
      .map(msg => ({
        author: msg.author,
        content: msg.content
      }));
  }

  postProcessResponse(response) {
    let processed = response;

    // Remove prefixos
    processed = processed.replace(/^(Luisa:|Você:|Bot:|Eu:)\s*/gi, '');
    
    // Remove aspas
    processed = processed.replace(/^["']|["']$/g, '');
    
    // Remove HTML/XML tags (CRÍTICO!)
    processed = processed.replace(/<\/?[^>]+(>|$)/g, '');
    processed = processed.replace(/&lt;|&gt;|&quot;|&amp;/g, '');
    
    // Remove quebras de linha
    processed = processed.replace(/\n+/g, ' ').trim();
    
    // Remove espaços múltiplos
    processed = processed.replace(/\s+/g, ' ');
    
    // Limita tamanho
    if (processed.length > 200) {
      processed = processed.substring(0, 200).trim();
      const lastSpace = processed.lastIndexOf(' ');
      if (lastSpace > 150) {
        processed = processed.substring(0, lastSpace);
      }
    }
    
    // Remove emojis
    processed = processed.replace(/[\u{1F300}-\u{1FAFF}]/gu, '').trim();
    processed = processed.replace(/[\u{2600}-\u{27BF}]/gu, '').trim();

    // Remove pontuação excessiva
    processed = processed.replace(/[!]{2,}/g, '!');
    processed = processed.replace(/[?]{2,}/g, '?');

    return processed.trim();
  }

  getSmartFallback(message) {
    const content = message.content.toLowerCase();
    const type = this.detectMessageType(content);

    // Respostas mais específicas baseadas em palavras-chave
    
    // "Qual a boa" / "O que fazer"
    if (/qual.*(boa|role|fazer)|o que.*(fazer|rola)|bora.*(fazer|sair)/i.test(content)) {
      return this.randomChoice([
        'sei la, vc que sabe',
        'nao sei, tu que decide',
        'qualquer coisa serve',
        'tanto faz mano',
        'voce escolhe'
      ]);
    }

    // "Como você está" / "Tudo bem"
    if (/como.*(ta|esta|vai)|tudo bem|beleza/i.test(content)) {
      return this.randomChoice([
        'to bem, e tu?',
        'suave, e vc?',
        'de boa, e ai?',
        'tranquilo',
        'normal'
      ]);
    }

    // "O que está fazendo"
    if (/o que.*(fazendo|faz)|ta fazendo|que ce ta/i.test(content)) {
      return this.randomChoice([
        'nada demais',
        'relaxando',
        'vendo uns video',
        'jogando',
        'conversando aqui'
      ]);
    }

    // Respostas por tipo
    const smartResponses = {
      greeting: ['fala', 'e ai', 'opa', 'salve', 'beleza'],
      food: ['to com fome tambem', 'quero pizza', 'bora pedir algo', 'que fome'],
      gaming: ['bora jogar', 'que jogo?', 'to dentro', 'chama', 'vamo'],
      entertainment: ['ja vi', 'e bom?', 'nao assisti', 'quero ver'],
      question: ['sei la', 'nao sei', 'acho que sim', 'depende', 'pode ser'],
      general: ['pois e', 'real', 'entendi', 'hmm', 'interessante', 'verdade']
    };

    const responses = smartResponses[type] || smartResponses.general;
    return this.randomChoice(responses);
  }

  randomChoice(array) {
    return array[Math.floor(Math.random() * array.length)];
  }

  addToHistory(message, response) {
    this.conversationHistory.push({
      author: message.author.username,
      content: message.content,
      channelId: message.channelId,
      timestamp: Date.now()
    });

    this.conversationHistory.push({
      author: 'Luisa',
      content: response,
      channelId: message.channelId,
      timestamp: Date.now()
    });

    if (this.conversationHistory.length > this.maxHistory * 2) {
      this.conversationHistory = this.conversationHistory.slice(-this.maxHistory * 2);
    }
  }

  clearOldHistory() {
    const fiveMinutesAgo = Date.now() - 300000;
    this.conversationHistory = this.conversationHistory.filter(
      msg => msg.timestamp > fiveMinutesAgo
    );
  }
}

module.exports = new GeminiHandler();