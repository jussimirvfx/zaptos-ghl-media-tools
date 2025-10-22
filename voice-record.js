/*!
 * Zaptos GHL Media Tools - Updated Version
 * Copyright (c) 2025 Zaptos Company
 * Licensed under the Apache License, Version 2.0
 */

(function () {
    if (window.__ZAPTOS_GHL_MEDIA_MP3__) return;
    window.__ZAPTOS_GHL_MEDIA_MP3__ = 'v4-mp3-updated';
  
    const log = (...a) => console.log('[Zaptos v4]', ...a);
    const preferFormat = 'mp3';
  
    // --- Loader do lamejs com múltiplos CDNs
    const loadLame = () => new Promise((resolve) => {
      if (window.lamejs) return resolve(true);
      const urls = [
        'https://cdn.jsdelivr.net/npm/lamejs@1.2.1/lame.min.js',
        'https://unpkg.com/lamejs@1.2.1/lame.min.js',
        'https://cdnjs.cloudflare.com/ajax/libs/lamejs/1.2.0/lame.min.js'
      ];
      let i = 0;
      const tryNext = () => {
        if (i >= urls.length) return resolve(false);
        const s = document.createElement('script');
        s.src = urls[i++];
        s.async = true;
        s.onload = () => resolve(!!window.lamejs);
        s.onerror = tryNext;
        document.head.appendChild(s);
      };
      tryNext();
    });
  
    // --- Estratégias múltiplas para encontrar elementos
    const findClearBtn = () => {
      // Estratégia 1: Texto "clear"
      let btn = Array.from(document.querySelectorAll('button'))
        .find(b => (b.textContent || '').trim().toLowerCase() === 'clear');
      if (btn) return btn;
  
      // Estratégia 2: Ícones de limpar/trash
      btn = document.querySelector('button[aria-label*="clear" i]') ||
            document.querySelector('button[title*="clear" i]') ||
            document.querySelector('button svg[data-icon*="trash"]')?.closest('button');
      if (btn) return btn;
  
      // Estratégia 3: Botões na área do composer
      const composer = findComposer();
      if (composer) {
        const buttons = composer.querySelectorAll('button');
        return buttons[buttons.length - 1] || null;
      }
  
      return null;
    };
  
    const findComposer = () => {
      // Múltiplas estratégias para encontrar o composer
      return document.querySelector("div[data-testid*='composer']") ||
             document.querySelector("div[data-rbd-droppable-id]") ||
             document.querySelector("div[class*='composer']") ||
             document.querySelector("div[class*='message-input']") ||
             document.querySelector("textarea[placeholder*='message' i]")?.closest('div') ||
             document.querySelector("div[role='textbox']")?.closest('div[class*='container']");
    };
  
    const findFileInput = () => {
      // Estratégias para encontrar input de arquivo
      return document.querySelector("input[type='file'][accept*='audio']") ||
             document.querySelector("input[type='file'][accept*='media']") ||
             document.querySelector("input[type='file'][name*='file']") ||
             document.querySelector("input[type='file'][name*='attachment']") ||
             Array.from(document.querySelectorAll("input[type='file']")).pop();
    };
  
    const findAttachmentButton = () => {
      // Procura botão de anexar
      return document.querySelector("button[aria-label*='attach' i]") ||
             document.querySelector("button[title*='attach' i]") ||
             document.querySelector("button svg[data-icon*='paperclip']")?.closest('button') ||
             document.querySelector("button svg[data-icon*='attach']")?.closest('button');
    };
  
    const simulateUpload = (file) => {
      let input = findFileInput();
      
      // Se não encontrou input, tenta clicar no botão de anexar primeiro
      if (!input) {
        const attachBtn = findAttachmentButton();
        if (attachBtn) {
          attachBtn.click();
          setTimeout(() => {
            input = findFileInput();
            if (input) performUpload(input, file);
            else alert('⚠️ Campo de upload não encontrado após clicar em anexar.');
          }, 300);
          return true;
        } else {
          alert('❌ Campo de upload não encontrado.');
          return false;
        }
      }
      
      return performUpload(input, file);
    };
  
    const performUpload = (input, file) => {
      try {
        const dt = new DataTransfer();
        dt.items.add(file);
        input.files = dt.files;
        
        // Dispara múltiplos eventos para garantir compatibilidade
        ['change', 'input'].forEach(eventType => {
          input.dispatchEvent(new Event(eventType, { bubbles: true }));
        });
        
        // Trigger React se existir
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
          window.HTMLInputElement.prototype,
          'value'
        )?.set;
        if (nativeInputValueSetter) {
          nativeInputValueSetter.call(input, input.value);
          input.dispatchEvent(new Event('input', { bubbles: true }));
        }
        
        return true;
      } catch (e) {
        log('Erro no upload:', e);
        return false;
      }
    };
  
    // --- Encoders (sem alterações)
    const floatTo16 = (f32) => {
      const i16 = new Int16Array(f32.length);
      for (let i = 0; i < f32.length; i++) {
        let s = Math.max(-1, Math.min(1, f32[i]));
        i16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
      }
      return i16;
    };
  
    const encodeWAV = (samples, sampleRate) => {
      const numChannels = 1;
      const bytesPerSample = 2;
      const blockAlign = numChannels * bytesPerSample;
      const byteRate = sampleRate * blockAlign;
      const buffer = new ArrayBuffer(44 + samples.length * bytesPerSample);
      const view = new DataView(buffer);
  
      const writeStr = (off, str) => {
        for (let i = 0; i < str.length; i++) view.setUint8(off + i, str.charCodeAt(i));
      };
      
      let offset = 0;
      writeStr(offset, 'RIFF'); offset += 4;
      view.setUint32(offset, 36 + samples.length * bytesPerSample, true); offset += 4;
      writeStr(offset, 'WAVE'); offset += 4;
      writeStr(offset, 'fmt '); offset += 4;
      view.setUint32(offset, 16, true); offset += 4;
      view.setUint16(offset, 1, true); offset += 2;
      view.setUint16(offset, numChannels, true); offset += 2;
      view.setUint32(offset, sampleRate, true); offset += 4;
      view.setUint32(offset, byteRate, true); offset += 4;
      view.setUint16(offset, blockAlign, true); offset += 2;
      view.setUint16(offset, 8 * bytesPerSample, true); offset += 2;
      writeStr(offset, 'data'); offset += 4;
      view.setUint32(offset, samples.length * bytesPerSample, true); offset += 4;
  
      const i16 = floatTo16(samples);
      for (let i = 0; i < i16.length; i++, offset += 2) {
        view.setInt16(offset, i16[i], true);
      }
  
      return new Blob([view], { type: 'audio/wav' });
    };
  
    const encodeMP3 = (samples, sampleRate, kbps = 128) => {
      const lame = window.lamejs;
      const mp3encoder = new lame.Mp3Encoder(1, sampleRate, kbps);
      const i16 = floatTo16(samples);
      const chunkSize = 1152;
      const chunks = [];
      
      for (let i = 0; i < i16.length; i += chunkSize) {
        const part = i16.subarray(i, i + chunkSize);
        const mp3buf = mp3encoder.encodeBuffer(part);
        if (mp3buf.length) chunks.push(mp3buf);
      }
      
      const end = mp3encoder.flush();
      if (end.length) chunks.push(end);
      
      return new Blob(chunks, { type: 'audio/mpeg' });
    };
  
    // --- UI do Gravador (Melhorada)
    function createRecorderUI() {
      if (document.getElementById('zaptos-rec-btn')) return;
  
      const clearBtn = findClearBtn();
      const composer = findComposer();
      
      // Tenta múltiplos pontos de inserção
      let insertPoint = clearBtn?.parentNode;
      if (!insertPoint && composer) {
        insertPoint = composer.querySelector('[class*="button"]')?.parentNode || composer;
      }
      if (!insertPoint) {
        log('Ponto de inserção não encontrado');
        return;
      }
  
      const wrapper = document.createElement('div');
      wrapper.id = 'zaptos-rec-wrapper';
      Object.assign(wrapper.style, {
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        marginRight: '8px',
        position: 'relative',
        zIndex: '1000'
      });
  
      const btn = document.createElement('button');
      btn.id = 'zaptos-rec-btn';
      btn.textContent = '🎙️';
      btn.title = 'Gravar áudio (MP3/WAV)';
      Object.assign(btn.style, {
        padding: '8px 14px',
        borderRadius: '6px',
        backgroundColor: '#007bff',
        color: '#fff',
        border: 'none',
        cursor: 'pointer',
        fontWeight: 'bold',
        fontSize: '16px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        transition: 'all 0.2s'
      });
  
      const timer = document.createElement('span');
      timer.id = 'zaptos-timer';
      timer.textContent = '00:00';
      Object.assign(timer.style, {
        fontSize: '14px',
        color: '#333',
        padding: '4px',
        fontWeight: '500'
      });
  
      wrapper.append(btn, timer);
      
      if (clearBtn && clearBtn.parentNode) {
        clearBtn.parentNode.insertBefore(wrapper, clearBtn);
      } else {
        insertPoint.appendChild(wrapper);
      }
  
      // Estado da gravação
      let ac = null, source = null, proc = null, stream = null;
      let buffers = [];
      let seconds = 0, tHandle = null, sampleRate = 44100;
  
      const tick = () => {
        seconds++;
        const m = String(Math.floor(seconds / 60)).padStart(2, '0');
        const s = String(seconds % 60).padStart(2, '0');
        timer.textContent = `${m}:${s}`;
      };
  
      const resetTimer = () => {
        clearInterval(tHandle);
        seconds = 0;
        timer.textContent = '00:00';
      };
  
      const start = async () => {
        if (!navigator.mediaDevices?.getUserMedia) {
          alert('❌ Navegador sem suporte a gravação de áudio.');
          return;
        }
        
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true
            }
          });
          
          ac = new (window.AudioContext || window.webkitAudioContext)();
          sampleRate = ac.sampleRate;
          source = ac.createMediaStreamSource(stream);
          
          const bufSize = 4096;
          proc = ac.createScriptProcessor(bufSize, 1, 1);
          proc.onaudioprocess = (e) => {
            const ch = e.inputBuffer.getChannelData(0);
            buffers.push(new Float32Array(ch));
          };
          
          source.connect(proc);
          proc.connect(ac.destination);
  
          tHandle = setInterval(tick, 1000);
          btn.textContent = '⏹️';
          btn.style.backgroundColor = '#dc3545';
          log('Gravação iniciada');
        } catch (e) {
          log('Erro ao acessar microfone:', e);
          alert('⚠️ Permita o acesso ao microfone para gravar áudio.');
        }
      };
  
      const stop = async () => {
        try { source?.disconnect(); } catch {}
        try { proc?.disconnect(); } catch {}
        try { stream?.getTracks().forEach(t => t.stop()); } catch {}
        try { ac?.close(); } catch {}
  
        resetTimer();
        btn.textContent = '🎙️';
        btn.style.backgroundColor = '#007bff';
  
        let total = 0;
        buffers.forEach(b => total += b.length);
        const merged = new Float32Array(total);
        let off = 0;
        for (const b of buffers) {
          merged.set(b, off);
          off += b.length;
        }
        buffers = [];
  
        let blob, fileName;
        try {
          if (preferFormat === 'mp3' && window.lamejs) {
            blob = encodeMP3(merged, sampleRate, 128);
            fileName = 'gravacao.mp3';
            log('Áudio codificado em MP3');
          } else {
            throw new Error('lamejs indisponível');
          }
        } catch {
          blob = encodeWAV(merged, sampleRate);
          fileName = 'gravacao.wav';
          log('Áudio codificado em WAV (fallback)');
        }
  
        const file = new File([blob], fileName, { type: blob.type });
        showPreview(file);
      };
  
      const showPreview = (file) => {
        const old = document.getElementById('zaptos-preview');
        if (old) old.remove();
  
        const preview = document.createElement('div');
        preview.id = 'zaptos-preview';
        Object.assign(preview.style, {
          position: 'fixed',
          bottom: '80px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: '10000',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          background: '#fff',
          padding: '16px',
          borderRadius: '8px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
          minWidth: '320px'
        });
  
        const audio = document.createElement('audio');
        audio.controls = true;
        audio.src = URL.createObjectURL(file);
        audio.style.width = '100%';
  
        const btnContainer = document.createElement('div');
        btnContainer.style.display = 'flex';
        btnContainer.style.gap = '8px';
  
        const sendBtn = document.createElement('button');
        sendBtn.textContent = '✅ Enviar';
        Object.assign(sendBtn.style, {
          flex: '1',
          padding: '10px',
          background: '#28a745',
          color: '#fff',
          border: 'none',
          borderRadius: '6px',
          cursor: 'pointer',
          fontWeight: 'bold'
        });
        sendBtn.onclick = () => {
          if (simulateUpload(file)) {
            log('Arquivo enviado');
          }
          preview.remove();
        };
  
        const redoBtn = document.createElement('button');
        redoBtn.textContent = '🔄 Regravar';
        Object.assign(redoBtn.style, {
          flex: '1',
          padding: '10px',
          background: '#dc3545',
          color: '#fff',
          border: 'none',
          borderRadius: '6px',
          cursor: 'pointer',
          fontWeight: 'bold'
        });
        redoBtn.onclick = () => preview.remove();
  
        btnContainer.append(sendBtn, redoBtn);
        preview.append(audio, btnContainer);
        document.body.appendChild(preview);
      };
  
      btn.onclick = () => {
        if (btn.textContent === '⏹️') stop();
        else start();
      };
    }
  
    // --- Players embutidos (Melhorado)
    function enhanceAttachmentPlayers(root = document) {
      const selectors = [
        'a.sms-file-attachment',
        'a[href*=".mp3"]',
        'a[href*=".wav"]',
        'a[href*=".mp4"]',
        'a[class*="attachment"]',
        'a[class*="file-link"]'
      ];
  
      const links = Array.from(root.querySelectorAll(selectors.join(', ')));
      
      for (const link of links) {
        if (!link || link.dataset.zaptosEnhanced) continue;
        
        const href = link.getAttribute('href') || link.textContent || '';
        if (!href) continue;
        
        link.dataset.zaptosEnhanced = 'true';
  
        let url = href;
        try {
          url = new URL(href, location.href).href;
        } catch {}
  
        const ext = url.split('?')[0].split('#')[0].split('.').pop()?.toLowerCase();
        if (!ext) continue;
  
        if (['mp3', 'wav', 'webm', 'ogg', 'm4a'].includes(ext)) {
          const audio = document.createElement('audio');
          audio.controls = true;
          audio.src = url;
          audio.style.maxWidth = '300px';
          audio.style.marginTop = '8px';
          link.replaceWith(audio);
        } else if (['mp4', 'mov', 'webm', 'avi'].includes(ext)) {
          const video = document.createElement('video');
          video.controls = true;
          video.width = 300;
          video.src = url;
          video.style.marginTop = '8px';
          link.replaceWith(video);
        }
      }
    }
  
    // --- Inicialização
    (async () => {
      const lameOK = await loadLame();
      log(lameOK ? '✅ MP3 encoder carregado' : '⚠️ WAV fallback ativo');
  
      const tryInject = () => {
        try {
          createRecorderUI();
        } catch (e) {
          log('Erro ao injetar UI:', e);
        }
      };
  
      const tryPlayers = (node) => {
        try {
          enhanceAttachmentPlayers(node || document);
        } catch (e) {
          log('Erro ao processar players:', e);
        }
      };
  
      // Tentativas iniciais
      tryInject();
      tryPlayers();
  
      // Retry com delay (para páginas que carregam lentamente)
      setTimeout(tryInject, 1000);
      setTimeout(tryInject, 3000);
  
      // Observer para mudanças no DOM
      const mo = new MutationObserver((mutations) => {
        let needsUI = false;
        let needsPlayers = false;
  
        for (const m of mutations) {
          if (m.type === 'childList' && m.addedNodes?.length) {
            needsUI = true;
            needsPlayers = true;
            m.addedNodes.forEach(n => {
              if (n.querySelectorAll) tryPlayers(n);
            });
          }
        }
  
        if (needsUI && !document.getElementById('zaptos-rec-btn')) {
          setTimeout(tryInject, 100);
        }
        if (needsPlayers) {
          tryPlayers();
        }
      });
  
      mo.observe(document.documentElement, {
        childList: true,
        subtree: true
      });
  
      log('🎯 Zaptos GHL Media Tools v4 - Ativo e monitorando');
    })();
  })();