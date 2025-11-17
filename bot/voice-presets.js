// bot/voice-presets.js - Sistema de Áudios Pré-gravados
const { createAudioPlayer, createAudioResource, AudioPlayerStatus, NoSubscriberBehavior } = require('@discordjs/voice');
const fs = require('fs');
const path = require('path');

class VoicePresetsManager {
  constructor() {
    this.audioPlayer = createAudioPlayer({
      behaviors: {
        noSubscriber: NoSubscriberBehavior.Pause,
      },
    });
    
    this.isPlaying = false;
    this.queue = [];
    
    // Pasta para áudios pré-gravados
    this.audiosDir = path.join(__dirname, '../audios');
    if (!fs.existsSync(this.audiosDir)) {
      fs.mkdirSync(this.audiosDir, { recursive: true });
      console.log('📁 Pasta "audios" criada. Adicione seus arquivos .mp3 lá!');
    }
    
    // Carregar lista de áudios
    this.loadAudioPresets();
  }

  loadAudioPresets() {
    try {
      const files = fs.readdirSync(this.audiosDir)
        .filter(file => file.endsWith('.mp3') || file.endsWith('.wav') || file.endsWith('.ogg'));
      
      this.presets = files.map(file => {
        const name = path.parse(file).name;
        return {
          id: name.toLowerCase().replace(/\s+/g, '_'),
          name: this.formatPresetName(name),
          filename: file,
          filepath: path.join(this.audiosDir, file)
        };
      });
      
      console.log(`🎵 ${this.presets.length} áudios carregados`);
      
      // Se não houver áudios, criar exemplos
      if (this.presets.length === 0) {
        console.log('⚠️ Nenhum áudio encontrado. Adicione arquivos .mp3 na pasta "audios/"');
        this.createExampleReadme();
      }
      
    } catch (error) {
      console.error('❌ Erro ao carregar presets:', error);
      this.presets = [];
    }
  }

  formatPresetName(name) {
    // Converte nome do arquivo em nome bonito
    return name
      .replace(/_/g, ' ')
      .replace(/-/g, ' ')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }

  createExampleReadme() {
    const readmePath = path.join(this.audiosDir, 'README.txt');
    const content = `📁 PASTA DE ÁUDIOS PRÉ-GRAVADOS

Adicione seus arquivos de áudio aqui!

Formatos suportados: .mp3, .wav, .ogg

EXEMPLOS DE NOMES:
- fala_galera.mp3
- oi_pessoal.mp3
- bora_jogar.mp3
- to_com_fome.mp3
- kkkkk.mp3
- que_isso_mano.mp3

O nome do arquivo será usado como nome do botão no dashboard.

ONDE ENCONTRAR ÁUDIOS:
1. Grave você mesmo ou peça para alguém gravar
2. Use sites de TTS online (ex: ttsmp3.com, voicemaker.in)
3. Use ElevenLabs (AI de voz realista)
4. Corte áudios de vídeos/lives

IMPORTANTE:
- Use voz feminina jovem para combinar com a persona "Luisa"
- Mantenha áudios curtos (1-10 segundos)
- Qualidade mínima de 128kbps
`;
    
    fs.writeFileSync(readmePath, content, 'utf8');
    console.log('📝 README.txt criado na pasta audios/');
  }

  getPresets() {
    return this.presets;
  }

  async playPreset(presetId, connection) {
    try {
      const preset = this.presets.find(p => p.id === presetId);
      
      if (!preset) {
        return { success: false, error: 'Áudio não encontrado' };
      }
      
      if (!fs.existsSync(preset.filepath)) {
        return { success: false, error: 'Arquivo não existe' };
      }
      
      console.log(`🔊 Tocando: ${preset.name}`);
      
      await this.playAudio(preset.filepath, connection);
      
      return { success: true, presetName: preset.name };
      
    } catch (error) {
      console.error('❌ Erro ao tocar preset:', error);
      return { success: false, error: error.message };
    }
  }

  async playAudio(filepath, connection) {
    return new Promise((resolve, reject) => {
      try {
        console.log('🎵 Criando recurso de áudio:', filepath);
        
        const resource = createAudioResource(filepath, {
          inlineVolume: true
        });
        
        if (resource.volume) {
          resource.volume.setVolume(0.5);
        }
        
        const subscription = connection.subscribe(this.audioPlayer);
        
        if (!subscription) {
          throw new Error('Falha ao inscrever player na conexão');
        }
        
        console.log('▶️ Tocando áudio...');
        this.audioPlayer.play(resource);
        this.isPlaying = true;
        
        this.audioPlayer.once(AudioPlayerStatus.Idle, () => {
          this.isPlaying = false;
          console.log('✅ Áudio finalizado');
          subscription.unsubscribe();
          resolve();
        });
        
        this.audioPlayer.once('error', (error) => {
          this.isPlaying = false;
          console.error('❌ Erro ao tocar áudio:', error);
          subscription.unsubscribe();
          reject(error);
        });
        
        setTimeout(() => {
          if (this.isPlaying) {
            console.log('⏱️ Timeout: forçando fim do áudio');
            this.isPlaying = false;
            subscription.unsubscribe();
            resolve();
          }
        }, 30000);
        
      } catch (error) {
        this.isPlaying = false;
        console.error('❌ Erro ao criar recurso:', error);
        reject(error);
      }
    });
  }

  stop() {
    this.audioPlayer.stop();
    this.isPlaying = false;
  }
}

module.exports = new VoicePresetsManager();