# 🎭 Bot Discord Impostor v2.0

Bot avançado que imita um usuário real no Discord com IA, sistema de voz, moderação e dashboard web.

## ✨ Recursos

### 🤖 Inteligência Artificial
- **Google Gemini 2.5 Flash** para respostas naturais
- Sistema de contexto conversacional
- Detecção automática de tipo de mensagem
- Fallbacks inteligentes

### 🎤 Sistema de Voz
- Entrada automática em canais
- Presets de áudio customizáveis
- Suporte a múltiplos formatos (MP3, WAV, OGG)

### 🛡️ Segurança e Moderação
- Sistema anti-spam
- Filtro de palavras banidas
- Detecção de flood
- Cooldown por usuário/canal
- Sistema de advertências

### 🎮 Comandos Administrativos
- `!status` - Status do bot
- `!stats` - Estatísticas de uso
- `!mod` - Status da moderação
- `!config` - Alterar configurações
- `!reload` - Recarregar config
- `!reset` - Resetar advertências
- `!help` - Lista de comandos

### 🌐 Dashboard Web
- Interface moderna e responsiva
- Controle em tempo real
- Autenticação com senha
- Feed ao vivo de mensagens
- Controle de presets de áudio

---

## 🚀 Instalação

### 1. Requisitos
- **Node.js** 18+ ([Download](https://nodejs.org/))
- **FFmpeg** ([Download](https://ffmpeg.org/download.html))
- Token do Discord Bot
- API Key do Google Gemini (opcional)

### 2. Clonar Repositório
```bash
git clone https://github.com/seu-usuario/discord-bot.git
cd discord-bot
```

### 3. Instalar Dependências
```bash
npm install
```

### 4. Configurar Variáveis de Ambiente
```bash
cp .env.example .env
nano .env
```

Preencha:
```env
DISCORD_TOKEN=seu_token_aqui
DASHBOARD_PASSWORD=senha_super_segura
GEMINI_API_KEY=sua_api_key_aqui
ADMIN_USER_IDS=123456789012345678
```

### 5. Iniciar Bot
```bash
npm start
```

**Desenvolvimento (com auto-reload):**
```bash
npm run dev
```

---

## ⚙️ Configuração

### `bot.config.js`
Edite este arquivo para personalizar:

```javascript
bot: {
  name: 'Luisa',           // Nome do bot
  bio: 'Só mais um dia',   // Biografia
  status: {
    type: 'PLAYING',
    name: 'VALORANT'       // Atividade exibida
  }
}
```

### Personalidade
```javascript
personality: {
  responseDelay: { min: 1000, max: 3000 },  // Delay entre mensagens
  reactionChance: 0.3,                      // 30% de chance de reagir
  voiceJoinChance: 0.2,                     // 20% de chance de entrar em voz
  responseProbability: {
    directMention: 1.0,   // 100% quando mencionado
    question: 0.9,        // 90% em perguntas
    conversation: 0.6,    // 60% em conversas
    random: 0.15          // 15% aleatório
  }
}
```

### Sistema de IA
```javascript
aiSystem: {
  enabled: true,
  systemPrompt: `Você é Luisa, uma pessoa brasileira...`,
  apiConfig: {
    model: 'claude-sonnet-4-20250514',
    maxTokens: 150,
    temperature: 0.8
  }
}
```

---

## 🎵 Adicionar Áudios

1. Coloque arquivos `.mp3`, `.wav` ou `.ogg` na pasta `audios/`
2. O nome do arquivo será o nome do botão:
   - `fala_galera.mp3` → "Fala Galera"
   - `oi_pessoal.mp3` → "Oi Pessoal"
3. Os áudios aparecem automaticamente no dashboard

**Fontes de Áudio:**
- Grave você mesmo
- Use TTS online (ttsmp3.com, voicemaker.in)
- ElevenLabs (IA de voz realista)
- Corte áudios de vídeos/lives

---

## 🔐 Segurança

### Autenticação do Dashboard
O dashboard é protegido por senha Bearer token:

```javascript
// Exemplo de requisição
fetch('http://localhost:3001/api/send', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer sua_senha_aqui',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    channelId: '123456789',
    text: 'Olá!'
  })
})
```

### Moderação
Configure palavras banidas no `.env`:
```env
BANNED_WORDS=palavra1,palavra2,palavra3
```

### Administradores
Configure IDs de admins no `.env`:
```env
ADMIN_USER_IDS=123456789012345678,987654321098765432
```

---

## 📊 Monitoramento

### Logs
Logs são salvos automaticamente em `logs/`:
- `error.log` - Apenas erros
- `combined.log` - Todos os logs

### Estatísticas
Use `!stats` no Discord para ver:
- Mensagens enviadas
- Reações adicionadas
- Entradas em voz
- Respostas de IA geradas

### Status do Sistema
Use `!status` para ver:
- Uptime
- Uso de memória
- Status da IA
- Canal de voz atual
- Ping

---

## 🐛 Troubleshooting

### Bot não responde
1. Verifique se `DISCORD_TOKEN` está correto
2. Certifique-se que as intents estão habilitadas no Discord Developer Portal
3. Veja logs em `logs/error.log`

### Dashboard não abre
1. Verifique se a porta 3001 está livre
2. Tente acessar `http://localhost:3001`
3. Verifique se `DASHBOARD_PASSWORD` está configurado

### IA não funciona
1. Verifique se `GEMINI_API_KEY` está correto
2. Veja console para erros da API
3. Configure `aiSystem.enabled = false` no `bot.config.js` para desativar

### Áudio não toca
1. Verifique se FFmpeg está instalado: `ffmpeg -version`
2. Certifique-se que arquivos estão em `audios/`
3. Formatos suportados: MP3, WAV, OGG

---

## 🔧 Comandos Úteis

```bash
# Iniciar bot
npm start

# Desenvolvimento (auto-reload)
npm run dev

# Ver logs ao vivo
tail -f logs/combined.log

# Limpar node_modules e reinstalar
rm -rf node_modules package-lock.json
npm install

# Verificar versão do Node
node --version
```

---

## 📝 Changelog

### v2.0.0 (2025-12-05)
- ✅ Sistema de moderação anti-spam
- ✅ Cooldown por usuário/canal
- ✅ Comandos administrativos
- ✅ Autenticação no dashboard
- ✅ Validação de entrada
- ✅ Sistema de logging estruturado
- ✅ Melhorias de performance
- ✅ Correção de vazamento de memória

### v1.0.0 (2025-11-17)
- 🎉 Lançamento inicial
- 🤖 Integração com Google Gemini
- 🎤 Sistema de voz
- 🌐 Dashboard web

---

## 📄 Licença

MIT License - Veja [LICENSE](LICENSE) para detalhes

---

## 🤝 Contribuindo

Contribuições são bem-vindas! Abra uma issue ou pull request.

---

## ⚠️ Aviso Legal

Este bot é apenas para fins educacionais e de entretenimento. Use com responsabilidade e respeite os Termos de Serviço do Discord.

---

## 📞 Suporte

- 🐛 Issues: [GitHub Issues](https://github.com/seu-usuario/discord-bot/issues)
- 💬 Discord: [Servidor de Suporte](#)
- 📧 Email: seu@email.com

---

**Feito com ❤️ por [Seu Nome]**
