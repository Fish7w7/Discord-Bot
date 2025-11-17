// bot/tts.js - Sistema de Text-to-Speech MELHORADO
const { createAudioPlayer, createAudioResource, AudioPlayerStatus, NoSubscriberBehavior } = require('@discordjs/voice');
const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs');
const path = require('path');

// CONFIGURAR FFMPEG
try {
  const ffmpeg = require('ffmpeg-static');
  process.env.FFMPEG_PATH = ffmpeg;
  console.log('✅ FFmpeg configurado:', ffmpeg);
} catch (err) {
  console.warn('⚠️ ffmpeg-static não instalado. Execute: npm install ffmpeg-static');
}

const execAsync = promisify(exec);

class TTSManager {
  constructor() {
    this.audioPlayer = createAudioPlayer({
      behaviors: {
        noSubscriber: NoSubscriberBehavior.Pause,
      },
    });
    
    this.isSpeaking = false;
    this.queue = [];
    
    // Criar pasta para áudios temporários
    this.tempDir = path.join(__dirname, '../temp');
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
  }

  // NOVA FUNÇÃO: Quebrar texto em pedaços de 200 caracteres
  splitText(text, maxLength = 190) {
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
    const chunks = [];
    let currentChunk = '';
    
    for (const sentence of sentences) {
      if ((currentChunk + sentence).length <= maxLength) {
        currentChunk += sentence;
      } else {
        if (currentChunk) chunks.push(currentChunk.trim());
        currentChunk = sentence;
      }
    }
    
    if (currentChunk) chunks.push(currentChunk.trim());
    
    // Se ainda houver pedaços grandes, quebrar por palavras
    const finalChunks = [];
    for (const chunk of chunks) {
      if (chunk.length <= maxLength) {
        finalChunks.push(chunk);
      } else {
        const words = chunk.split(' ');
        let wordChunk = '';
        for (const word of words) {
          if ((wordChunk + ' ' + word).length <= maxLength) {
            wordChunk += (wordChunk ? ' ' : '') + word;
          } else {
            if (wordChunk) finalChunks.push(wordChunk.trim());
            wordChunk = word;
          }
        }
        if (wordChunk) finalChunks.push(wordChunk.trim());
      }
    }
    
    return finalChunks;
  }

  // Método 1: Google TTS API (MELHORADO COM SPLIT)
  async speakWithGoogleTTS(text, connection) {
    try {
      console.log('🔊 Falando com Google TTS:', text);
      
      const gtts = require('google-tts-api');
      const https = require('https');
      
      // Se texto for maior que 190 caracteres, quebrar em pedaços
      const chunks = this.splitText(text, 190);
      
      if (chunks.length > 1) {
        console.log(`📝 Texto longo detectado! Quebrando em ${chunks.length} partes`);
      }
      
      // Falar cada pedaço
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        console.log(`🗣️ Parte ${i + 1}/${chunks.length}: "${chunk.substring(0, 50)}..."`);
        
        const filename = `tts_${Date.now()}_${i}.mp3`;
        const filepath = path.join(this.tempDir, filename);
        
        // Gerar URL do Google TTS
        const url = gtts.getAudioUrl(chunk, {
          lang: 'pt-BR',
          slow: false,
          host: 'https://translate.google.com'
        });
        
        // Baixar áudio
        await new Promise((resolve, reject) => {
          const file = fs.createWriteStream(filepath);
          https.get(url, (response) => {
            response.pipe(file);
            file.on('finish', () => {
              file.close();
              resolve();
            });
          }).on('error', (err) => {
            fs.unlink(filepath, () => {});
            reject(err);
          });
        });
        
        await this.playAudio(filepath, connection);
        
        // Pequena pausa entre pedaços (300ms)
        if (i < chunks.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 300));
        }
        
        // Deletar arquivo depois
        setTimeout(() => {
          if (fs.existsSync(filepath)) {
            fs.unlinkSync(filepath);
          }
        }, 10000);
      }
      
      return { success: true };
      
    } catch (error) {
      console.error('❌ Erro no Google TTS:', error);
      throw error;
    }
  }

  // Método 2: eSpeak (offline, gratuito)
  async speakWithEspeak(text, connection) {
    try {
      console.log('🔊 Falando com eSpeak:', text);
      
      const filename = `tts_${Date.now()}.wav`;
      const filepath = path.join(this.tempDir, filename);
      
      const command = `espeak -v pt-br -s 150 -w "${filepath}" "${text}"`;
      await execAsync(command);
      await this.playAudio(filepath, connection);
      
      setTimeout(() => {
        if (fs.existsSync(filepath)) {
          fs.unlinkSync(filepath);
        }
      }, 10000);
      
      return { success: true };
      
    } catch (error) {
      console.error('❌ Erro no eSpeak:', error);
      return { success: false, error: error.message };
    }
  }

  // Método 3: say.js (Windows TTS)
  async speakWithSayJS(text, connection) {
    try {
      console.log('🔊 Falando com say.js:', text);
      
      const say = require('say');
      const filename = `tts_${Date.now()}.wav`;
      const filepath = path.join(this.tempDir, filename);
      
      const voicesToTry = [
        null,
        'Microsoft Maria Desktop',
        'Microsoft Daniel Desktop', 
        'Microsoft Heloisa Desktop',
        'Microsoft David Desktop'
      ];
      
      let success = false;
      let lastError = null;
      
      for (const voice of voicesToTry) {
        try {
          await new Promise((resolve, reject) => {
            say.export(text, voice, 1.0, filepath, (err) => {
              if (err) reject(err);
              else resolve();
            });
          });
          
          success = true;
          console.log(`✅ Voz usada: ${voice || 'padrão'}`);
          break;
        } catch (err) {
          lastError = err;
          continue;
        }
      }
      
      if (!success) {
        throw lastError || new Error('Nenhuma voz disponível');
      }
      
      await this.playAudio(filepath, connection);
      
      setTimeout(() => {
        if (fs.existsSync(filepath)) {
          fs.unlinkSync(filepath);
        }
      }, 10000);
      
      return { success: true };
      
    } catch (error) {
      console.error('❌ Erro no say.js:', error);
      throw error;
    }
  }

  // Tocar áudio na call
  async playAudio(filepath, connection) {
    return new Promise((resolve, reject) => {
      try {
        console.log('🎵 Criando recurso de áudio:', filepath);
        
        if (!fs.existsSync(filepath)) {
          throw new Error('Arquivo de áudio não encontrado: ' + filepath);
        }
        
        const resource = createAudioResource(filepath, {
          inlineVolume: true
        });
        
        if (resource.volume) {
          resource.volume.setVolume(0.5);
        }
        
        console.log('🔗 Inscrevendo player na conexão...');
        const subscription = connection.subscribe(this.audioPlayer);
        
        if (!subscription) {
          throw new Error('Falha ao inscrever player na conexão');
        }
        
        console.log('▶️ Tocando áudio...');
        this.audioPlayer.play(resource);
        this.isSpeaking = true;
        
        this.audioPlayer.once(AudioPlayerStatus.Idle, () => {
          this.isSpeaking = false;
          console.log('✅ Áudio finalizado');
          subscription.unsubscribe();
          resolve();
        });
        
        this.audioPlayer.once('error', (error) => {
          this.isSpeaking = false;
          console.error('❌ Erro ao tocar áudio:', error);
          subscription.unsubscribe();
          reject(error);
        });
        
        setTimeout(() => {
          if (this.isSpeaking) {
            console.log('⏱️ Timeout: forçando fim do áudio');
            this.isSpeaking = false;
            subscription.unsubscribe();
            resolve();
          }
        }, 30000);
        
      } catch (error) {
        this.isSpeaking = false;
        console.error('❌ Erro ao criar recurso:', error);
        reject(error);
      }
    });
  }

  // Adicionar fala à fila
  async addToQueue(text, connection) {
    this.queue.push({ text, connection });
    
    if (!this.isSpeaking) {
      await this.processQueue();
    }
  }

  // Processar fila de falas
  async processQueue() {
    while (this.queue.length > 0) {
      const { text, connection } = this.queue.shift();
      
      // Tenta os métodos na ordem: Google TTS > say.js > eSpeak
      try {
        await this.speakWithGoogleTTS(text, connection);
      } catch (error) {
        console.log('⚠️ Google TTS falhou, tentando say.js...');
        try {
          await this.speakWithSayJS(text, connection);
        } catch (error2) {
          console.log('⚠️ say.js falhou, tentando eSpeak...');
          try {
            await this.speakWithEspeak(text, connection);
          } catch (error3) {
            console.error('❌ Todos os métodos de TTS falharam');
          }
        }
      }
      
      // Aguardar um pouco entre falas
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  // Parar de falar
  stop() {
    this.audioPlayer.stop();
    this.queue = [];
    this.isSpeaking = false;
  }
}

module.exports = new TTSManager();