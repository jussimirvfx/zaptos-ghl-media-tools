/*!
 * Zaptos GHL Media Tools - Custom Fixed
 * Copyright (c) 2025 Zaptos Company
 * Licensed under the Apache License, Version 2.0
 */
(function () {
  if (window.__ZAPTOS_GHL_MEDIA_MP3__) return;
  window.__ZAPTOS_GHL_MEDIA_MP3__ = 'v4.1-custom';

  const log = (...a) => console.log('[Zaptos v4.1 Custom]', ...a);
  const preferFormat = 'mp3';

  // --- Loader do lamejs
  const loadLame = () => new Promise((resolve) => {
    if (window.lamejs) return resolve(true);
    const urls = [
      'https://cdn.jsdelivr.net/npm/lamejs@1.2.1/lame.min.js',
      'https://unpkg.com/lamejs@1.2.1/lame.min.js'
    ];
    let i = 0;
    const tryNext = () => {
      if (i >= urls.length) return resolve(false);
      const s = document.createElement('script');
      s.src = urls[i++]; s.async = true;
      s.onload = () => resolve(!!window.lamejs);
      s.onerror = tryNext; document.head.appendChild(s);
    };
    tryNext();
  });

  // --- Utils UI/GHL (Otimizado)
  
  // Encontra a toolbar principal onde o botão deve ser inserido
  const findIconToolbar = () => {
    const specificToolbar = document.querySelector('#composer-textarea .max-w-full > .items-center > .items-center');
    if (specificToolbar) {
      log('✅ Toolbar encontrada via seletor específico!');
      return specificToolbar;
    }
    // Fallback 1: Tenta variações do seletor
    const fallback1 = document.querySelector('#composer-textarea .items-center .items-center');
    if (fallback1) {
      log('✅ Toolbar encontrada via fallback 1');
      return fallback1;
    }
    log('⚠️ Toolbar não encontrada');
    return null;
  };
  
  // Encontra o elemento de referência para posicionar o botão ao lado
  const findReferenceElement = () => {
    const ref = document.querySelector('#composer-textarea .icon-wrapper .cursor-pointer');
    if (ref) {
      log('✅ Elemento de referência para posicionamento encontrado!');
    } else {
      log('⚠️ Elemento de referência não encontrado.');
    }
    return ref;
  }

  // Lógica de busca do input de upload - mantida do v3, mas com fallback melhor
  const findFileInput = () =>
    document.querySelector("input[type='file'][accept*='audio']") ||
    document.querySelector("input[type='file'][name*='file']") ||
    document.querySelector("input[type='file']");
  
  // Função de busca do botão de anexar (para clique manual)
  const findAttachmentButton = () => {
    let btn = document.querySelector("button[aria-label*='attach' i]") ||
              document.querySelector("button[title*='attach' i]");
    if (btn) return btn;
    const svgClip = document.querySelector("svg[class*='paperclip'], svg[data-icon*='paperclip']");
    if (svgClip) return svgClip.closest('button');
    return null;
  };

  const performUpload = (input, file) => {
    try {
        const dt = new DataTransfer();
        dt.items.add(file);
        input.files = dt.files;
        
        // Dispara eventos para a plataforma reconhecer a mudança
        input.dispatchEvent(new Event('change', { bubbles: true }));
        input.dispatchEvent(new Event('input', { bubbles: true }));
        return true;
    } catch (e) {
        log('Erro no upload:', e);
        return false;
    }
  };

  const simulateUpload = (file) => {
    log('🔍 Tentando fazer upload do arquivo:', file.name);
    
    let input = findFileInput();
    
    if (!input) {
      log('⚠️ Input não encontrado, tentando clicar no botão de anexar...');
      const attachBtn = findAttachmentButton();
      
      if (attachBtn) {
        log('✅ Botão de anexar encontrado, clicando...');
        attachBtn.click();
        
        // Aguarda o input aparecer após clicar
        setTimeout(() => {
          input = findFileInput();
          if (input) {
            log('✅ Input apareceu após clicar no botão!');
            performUpload(input, file);
          } else {
            // Este é o erro que levou ao seu pop-up original
            alert('❌ Campo de upload não encontrado após clique no anexo.\n\nPor favor, clique manualmente no ícone de anexo (📎) e tente novamente.');
          }
        }, 500);
        return true;
      } else {
        log('❌ Botão de anexar não encontrado');
        alert('❌ Campo de upload não encontrado.\n\nPor favor, clique manualmente no ícone de anexo (📎) e tente novamente.');
        return false;
      }
    }
    
    log('✅ Input encontrado diretamente, fazendo upload...');
    return performUpload(input, file);
  };
  
  // --- Encoders (mantidos do script original)
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

    const writeStr = (off, str) => { for (let i = 0; i < str.length; i++) view.setUint8(off + i, str.charCodeAt(i)); };
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
    for (let i = 0; i < i16.length; i++, offset += 2) view.setInt16(offset, i16[i], true);

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

  // --- UI do Gravador (Lógica de injeção atualizada)
  function createRecorderUI() {
    if (document.getElementById('zaptos-rec-btn')) return;

    const toolbar = findIconToolbar();
    const referenceElement = findReferenceElement();
    
    if (!toolbar) {
      log('⚠️ Toolbar não encontrada, UI Recorder não injetada.');
      return;
    }

    const btn = document.createElement('button');
    btn.id = 'zaptos-rec-btn';
    btn.type = 'button';
    btn.title = 'Gravar áudio (MP3/WAV)';
    btn.innerHTML = '🎙️';
    
    // Estilos do botão para se parecer com os ícones da toolbar GHL
    Object.assign(btn.style, {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: '36px',
      height: '36px',
      padding: '0',
      margin: '0 4px', // Ajuste a margem para separar dos outros ícones
      borderRadius: '6px',
      backgroundColor: 'transparent',
      color: '#64748b', // Cor de ícone padrão (tailwind gray-500/600)
      border: 'none',
      cursor: 'pointer',
      fontSize: '20px',
      transition: 'background-color 0.2s',
      position: 'relative', // Para o timer
      flexShrink: '0'
    });

    // Efeitos de mouse (simula o hover dos botões nativos)
    btn.onmouseenter = () => {
      if (btn.innerHTML === '🎙️') {
        btn.style.backgroundColor = '#f1f5f9'; // gray-100
      }
    };
    btn.onmouseleave = () => {
      if (btn.innerHTML === '🎙️') {
        btn.style.backgroundColor = 'transparent';
      }
    };

    const timer = document.createElement('span');
    timer.id = 'zaptos-timer';
    timer.textContent = '00:00';
    Object.assign(timer.style, {
      position: 'absolute', top: '-22px', left: '50%', transform: 'translateX(-50%)',
      fontSize: '11px', color: '#ef4444', fontWeight: '600', background: '#fff',
      padding: '2px 6px', borderRadius: '4px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
      display: 'none', whiteSpace: 'nowrap', zIndex: '1'
    });

    btn.appendChild(timer);

    // Lógica de injeção: Tenta inserir DEPOIS do elemento de referência, senão, no final da toolbar.
    if (referenceElement && referenceElement.parentNode === toolbar) {
      toolbar.insertBefore(btn, referenceElement.nextSibling);
      log('✅ Botão inserido ao lado direito do elemento de referência!');
    } else {
      toolbar.appendChild(btn);
      log('✅ Botão inserido no final da toolbar (fallback)');
    }

    // Estado da gravação (mantido do script original)
    let ac = null;
    let source = null;
    let proc = null;
    let stream = null;
    let buffers = [];
    let seconds = 0;
    let tHandle = null;
    let sampleRate = 44100;

    const tick = () => {
      seconds++;
      const m = String(Math.floor(seconds / 60)).padStart(2, '0');
      const s = String(seconds % 60).padStart(2, '0');
      timer.textContent = m + ':' + s;
    };

    const resetTimer = () => {
      clearInterval(tHandle);
      seconds = 0;
      timer.textContent = '00:00';
      timer.style.display = 'none';
    };

    const start = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        alert('❌ Navegador sem suporte.');
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
        timer.style.display = 'block';
        btn.innerHTML = '⏹️';
        btn.style.backgroundColor = '#fee2e2'; // Red-100
        btn.style.color = '#ef4444'; // Red-500
        log('🎙️ Gravando...');
      } catch (e) {
        log('❌ Erro microfone:', e);
        alert('⚠️ Permita acesso ao microfone.');
      }
    };

    const stop = async () => {
      try { if (source) source.disconnect(); } catch (e) { log('Erro ao parar source:', e); }
      try { if (proc) proc.disconnect(); } catch (e) { log('Erro ao parar proc:', e); }
      try { if (stream) stream.getTracks().forEach(t => t.stop()); } catch (e) { log('Erro ao parar stream:', e); }
      try { if (ac) ac.close(); } catch (e) { log('Erro ao parar ac:', e); }

      resetTimer();
      btn.innerHTML = '🎙️';
      btn.style.backgroundColor = 'transparent';
      btn.style.color = '#64748b';

      let total = 0;
      buffers.forEach(b => total += b.length);
      const merged = new Float32Array(total);
      let off = 0;
      for (const b of buffers) {
        merged.set(b, off);
        off += b.length;
      }
      buffers = [];

      let blob;
      let fileName;
      
      try {
        if (preferFormat === 'mp3' && window.lamejs) {
          blob = encodeMP3(merged, sampleRate, 128);
          fileName = 'gravacao.mp3';
          log('✅ MP3 codificado');
        } else {
          throw new Error('lamejs indisponível');
        }
      } catch (err) {
        blob = encodeWAV(merged, sampleRate);
        fileName = 'gravacao.wav';
        log('⚠️ WAV fallback');
      }

      const file = new File([blob], fileName, { type: blob.type });
      showPreview(file);
    };

    // Preview UI (Otimizada e com melhor posicionamento)
    const showPreview = (file) => {
      const old = document.getElementById('zaptos-preview');
      if (old) old.remove();

      const preview = document.createElement('div');
      preview.id = 'zaptos-preview';
      Object.assign(preview.style, {
        position: 'fixed', bottom: '100px', left: '50%', transform: 'translateX(-50%)',
        zIndex: '10000', display: 'flex', flexDirection: 'column', gap: '12px',
        background: '#fff', padding: '20px', borderRadius: '12px',
        boxShadow: '0 10px 40px rgba(0,0,0,0.15)', minWidth: '350px', maxWidth: '90vw'
      });

      const title = document.createElement('div');
      title.textContent = '🎙️ Gravação Concluída';
      Object.assign(title.style, {
        fontSize: '16px', fontWeight: '600', color: '#1e293b', marginBottom: '4px'
      });

      const audio = document.createElement('audio');
      audio.controls = true;
      audio.src = URL.createObjectURL(file);
      audio.style.width = '100%';

      const btnContainer = document.createElement('div');
      btnContainer.style.display = 'flex';
      btnContainer.style.gap = '10px';

      const sendBtn = document.createElement('button');
      sendBtn.textContent = '✅ Enviar';
      Object.assign(sendBtn.style, {
        flex: '1', padding: '12px', background: '#22c55e', color: '#fff',
        border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', fontSize: '14px'
      });
      sendBtn.onclick = () => {
        if (simulateUpload(file)) {
          log('✅ Enviado!');
        }
        URL.revokeObjectURL(audio.src);
        preview.remove();
      };

      const redoBtn = document.createElement('button');
      redoBtn.textContent = '🔄 Regravar';
      Object.assign(redoBtn.style, {
        flex: '1', padding: '12px', background: '#ef4444', color: '#fff',
        border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', fontSize: '14px'
      });
      redoBtn.onclick = () => {
        URL.revokeObjectURL(audio.src);
        preview.remove();
      };

      btnContainer.append(sendBtn, redoBtn);
      preview.append(title, audio, btnContainer);
      document.body.appendChild(preview);
    };

    btn.onclick = () => {
      if (btn.innerHTML === '⏹️') {
        stop();
      } else {
        start();
      }
    };
  }

  // --- Players embutidos (mantidos do script original)
  function enhanceAttachmentPlayers(root = document) {
    // Usando seletores mais robustos, baseados na lógica do v4.1, se necessário
    const selectors = [
      'a[href*=".mp3"]',
      'a[href*=".wav"]',
      'a[href*=".mp4"]',
      'a[class*="attachment"]' // Mantendo o seletor genérico para GHL
    ];

    const links = Array.from(root.querySelectorAll(selectors.join(', ')));
    
    for (const link of links) {
      if (!link || link.dataset.zaptosEnhanced) continue;
      
      const href = link.getAttribute('href') || link.textContent || '';
      if (!href) continue;
      
      link.dataset.zaptosEnhanced = 'true';

      let url = href;
      try { url = new URL(href, location.href).href; } catch (e) { continue; }

      const ext = url.split('?')[0].split('#')[0].split('.').pop()?.toLowerCase();
      if (!ext) continue;

      if (['mp3', 'wav', 'webm', 'ogg', 'm4a'].includes(ext)) {
        const audio = document.createElement('audio');
        audio.controls = true; audio.src = url; audio.style.maxWidth = '300px'; audio.style.marginTop = '8px';
        link.replaceWith(audio);
      } else if (['mp4', 'mov', 'webm', 'avi'].includes(ext)) {
        const video = document.createElement('video');
        video.controls = true; video.width = 300; video.src = url; video.style.marginTop = '8px';
        link.replaceWith(video);
      }
    }
  }

  // --- Inicialização (boot)
  (async () => {
    const lameOK = await loadLame();
    log(lameOK ? '✅ MP3 encoder carregado' : '⚠️ Encoder MP3 indisponível — fallback para WAV');

    const tryInject = () => { try { createRecorderUI(); } catch (e) { log('❌ Erro UI:', e); } };
    const tryPlayers = (node) => { try { enhanceAttachmentPlayers(node || document); } catch (e) { log('❌ Erro players:', e); } };

    tryInject();
    tryPlayers();

    // Tenta injetar novamente (necessário em aplicações SPA como GHL)
    setTimeout(tryInject, 500);
    setTimeout(tryInject, 3000);

    const mo = new MutationObserver((muts) => {
      let uiCheckNeeded = false;
      for (const m of muts) {
        if (m.type === 'childList' && m.addedNodes?.length) {
          uiCheckNeeded = true;
          // Verifica players nos novos nós
          m.addedNodes.forEach(n => { if (n.querySelectorAll) tryPlayers(n); });
        }
      }
      // Re-injeta se o container do composer tiver sido recriado
      if (uiCheckNeeded && !document.getElementById('zaptos-rec-btn')) {
         setTimeout(tryInject, 100);
      }
    });

    mo.observe(document.documentElement, { childList: true, subtree: true });

    log('🎯 Zaptos v4.1 Custom ativo!');
  })();
})();