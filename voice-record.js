/*!
 * Zaptos GHL Media Tools - Versão 4.5 (Foco no icon-wrapper)
 * Copyright (c) 2025 Zaptos Company
 * Licensed under the Apache License, Version 2.0
 */
(function () {
  if (window.__ZAPTOS_GHL_MEDIA_MP3__) return;
  window.__ZAPTOS_GHL_MEDIA_MP3__ = 'v4.5-icon-wrapper-fix';

  const log = (...a) => console.log('[Zaptos v4.5]', ...a);
  const preferFormat = 'mp3';

  // --- Loader do lamejs (Mantido)
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
  
  // Encontra a toolbar principal (Container para o botão do microfone)
  const findIconToolbar = () => {
    const specificToolbar = document.querySelector('#composer-textarea .max-w-full > .items-center > .items-center');
    if (specificToolbar) return specificToolbar;
    const fallback1 = document.querySelector('#composer-textarea .items-center .items-center');
    if (fallback1) return fallback1;
    return null;
  };
  
  // Encontra o elemento de referência para posicionar o botão do microfone
  const findReferenceElement = () => {
    // Este seletor (o container clicável do anexo) é usado para posicionar o microfone ao lado.
    return document.querySelector('#composer-textarea .icon-wrapper .cursor-pointer');
  }

  const findComposer = () => document.getElementById('composer-textarea'); 

  // Lógica de busca do input de upload
  const findFileInput = () => {
    const composer = findComposer();
    let input = document.querySelector("input[type='file'][accept*='audio']");
    if (input) return input;
    input = document.querySelector("input[type='file']");
    if (input) return input;
    if (composer) {
        input = composer.querySelector("input[type='file']");
        if (input) return input;
    }
    return null;
  };
  
  // FUNÇÃO CORRIGIDA PARA ENCONTRAR O BOTÃO DE ANEXO
  const findAttachmentButton = () => {
    // ESTRATÉGIA 1: Busca o SVG do clipe
    const svgClip = document.querySelector('svg[data-v-4094da08][stroke-linecap="round"][class*="cursor-pointer"]');
    
    if (svgClip) {
      log('✅ Ícone SVG do anexo encontrado.');
      
      // Procura o PARENT mais próximo com a classe 'icon-wrapper' (o contêiner clicável real)
      const clickableParent = svgClip.closest('.icon-wrapper');
      
      if (clickableParent) {
          log('✅ Elemento pai clicável (.icon-wrapper) encontrado.');
          return clickableParent;
      }
    }
    
    // Fallback: Tenta encontrar o container do anexo (o elemento de referência do microfone é o mesmo!)
    const ref = findReferenceElement();
    if (ref && ref.closest('.icon-wrapper')) {
        log('✅ Botão anexo encontrado via referência (icon-wrapper)');
        return ref.closest('.icon-wrapper');
    }

    // Fallback final
    let btn = document.querySelector("button[aria-label*='attach' i]") ||
              document.querySelector("button[title*='attach' i]");
    if (btn) return btn;

    log('❌ Botão de anexar não encontrado');
    return null;
  };

  const performUpload = (input, file) => {
    try {
        const dt = new DataTransfer();
        dt.items.add(file);
        input.files = dt.files;
        
        input.dispatchEvent(new Event('change', { bubbles: true }));
        input.dispatchEvent(new Event('input', { bubbles: true }));
        
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
          window.HTMLInputElement.prototype,
          'value'
        );
        if (nativeInputValueSetter && nativeInputValueSetter.set) {
          nativeInputValueSetter.set.call(input, input.value);
          input.dispatchEvent(new Event('input', { bubbles: true }));
        }
        
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
        // Tenta disparar o evento de click
        attachBtn.click();
        
        // Aguarda o input aparecer após clicar
        setTimeout(() => {
          input = findFileInput();
          if (input) {
            log('✅ Input apareceu após clicar no botão!');
            performUpload(input, file);
          } else {
            // Log 2: O botão foi clicado, mas o input não apareceu
            log('❌ Input ainda não encontrado após o clique no botão de anexo. O campo deve ser criado dinamicamente.');
            alert('❌ Campo de upload não encontrado após clique no anexo.\n\nO botão de anexo foi encontrado e clicado, mas o campo de upload não apareceu. Por favor, clique manualmente no ícone de anexo (📎) e tente novamente.');
          }
        }, 600); 
        return true;
      } else {
        // Log 1: O botão de anexo NÃO foi encontrado
        log('❌ Botão de anexar não encontrado.');
        alert('❌ Campo de upload não encontrado.\n\nPor favor, clique manualmente no ícone de anexo (📎) e tente novamente.');
        return false;
      }
    }
    
    log('✅ Input encontrado diretamente, fazendo upload...');
    return performUpload(input, file);
  };
  
  // --- Encoders e UI do Gravador (Mantidos)
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

  function createRecorderUI() {
    if (document.getElementById('zaptos-rec-btn')) return;

    const toolbar = findIconToolbar();
    const referenceElement = findReferenceElement();
    
    if (!toolbar) return;

    const btn = document.createElement('button');
    btn.id = 'zaptos-rec-btn';
    btn.type = 'button';
    btn.title = 'Gravar áudio (MP3/WAV)';
    btn.innerHTML = '🎙️';
    
    Object.assign(btn.style, {
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      width: '36px', height: '36px', padding: '0', margin: '0 4px',
      borderRadius: '6px', backgroundColor: 'transparent', color: '#64748b',
      border: 'none', cursor: 'pointer', fontSize: '20px',
      transition: 'background-color 0.2s', position: 'relative', flexShrink: '0'
    });

    btn.onmouseenter = () => {
      if (btn.innerHTML === '🎙️') { btn.style.backgroundColor = '#f1f5f9'; }
    };
    btn.onmouseleave = () => {
      if (btn.innerHTML === '🎙️') { btn.style.backgroundColor = 'transparent'; }
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

    if (referenceElement && referenceElement.parentNode === toolbar) {
      toolbar.insertBefore(btn, referenceElement.nextSibling);
    } else {
      toolbar.appendChild(btn);
    }

    let ac = null, source = null, proc = null, stream = null;
    let buffers = [];
    let seconds = 0, tHandle = null, sampleRate = 44100;

    const tick = () => {
      seconds++;
      const m = String(Math.floor(seconds / 60)).padStart(2, '0');
      const s = String(seconds % 60).padStart(2, '0');
      timer.textContent = m + ':' + s;
    };
    const resetTimer = () => { clearInterval(tHandle); seconds = 0; timer.textContent = '00:00'; timer.style.display = 'none'; };

    const start = async () => {
      if (!navigator.mediaDevices?.getUserMedia) { alert('❌ Navegador sem suporte.'); return; }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
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
        source.connect(proc); proc.connect(ac.destination);

        tHandle = setInterval(tick, 1000);
        timer.style.display = 'block';
        btn.innerHTML = '⏹️';
        btn.style.backgroundColor = '#fee2e2';
        btn.style.color = '#ef4444';
      } catch (e) {
        log('❌ Erro microfone:', e);
        alert('⚠️ Permita acesso ao microfone.');
      }
    };

    const stop = async () => {
      try { if (source) source.disconnect(); } catch {}
      try { if (proc) proc.disconnect(); } catch {}
      try { if (stream) stream.getTracks().forEach(t => t.stop()); } catch {}
      try { if (ac) ac.close(); } catch {}

      resetTimer();
      btn.innerHTML = '🎙️';
      btn.style.backgroundColor = 'transparent';
      btn.style.color = '#64748b';

      let total = 0; buffers.forEach(b => total += b.length);
      const merged = new Float32Array(total);
      let off = 0; for (const b of buffers) { merged.set(b, off); off += b.length; }
      buffers = [];

      let blob, fileName;
      try {
        if (preferFormat === 'mp3' && window.lamejs) {
          blob = encodeMP3(merged, sampleRate, 128);
          fileName = 'gravacao.mp3';
        } else { throw new Error('lamejs indisponível'); }
      } catch (err) {
        blob = encodeWAV(merged, sampleRate);
        fileName = 'gravacao.wav';
      }

      const file = new File([blob], fileName, { type: blob.type });
      showPreview(file);
    };

    const showPreview = (file) => {
      const old = document.getElementById('zaptos-preview'); if (old) old.remove();

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
      Object.assign(title.style, { fontSize: '16px', fontWeight: '600', color: '#1e293b', marginBottom: '4px' });

      const audio = document.createElement('audio');
      audio.controls = true; audio.src = URL.createObjectURL(file); audio.style.width = '100%';

      const btnContainer = document.createElement('div'); btnContainer.style.display = 'flex'; btnContainer.style.gap = '10px';

      const sendBtn = document.createElement('button');
      sendBtn.textContent = '✅ Enviar';
      Object.assign(sendBtn.style, {
        flex: '1', padding: '12px', background: '#22c55e', color: '#fff',
        border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', fontSize: '14px'
      });
      sendBtn.onclick = () => {
        if (simulateUpload(file)) { log('✅ Enviado!'); }
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
      if (btn.innerHTML === '⏹️') { stop(); } else { start(); }
    };
  }

  // --- Players embutidos (Mantidos)
  function enhanceAttachmentPlayers(root = document) {
    const selectors = [ 'a[href*=".mp3"]', 'a[href*=".wav"]', 'a[href*=".mp4"]', 'a[class*="attachment"]' ];
    const links = Array.from(root.querySelectorAll(selectors.join(', ')));
    
    for (const link of links) {
      if (!link || link.dataset.zaptosEnhanced) continue;
      const href = link.getAttribute('href') || link.textContent || '';
      if (!href) continue;
      link.dataset.zaptosEnhanced = 'true';

      let url = href; try { url = new URL(href, location.href).href; } catch (e) { continue; }
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

    setTimeout(tryInject, 500);
    setTimeout(tryInject, 3000);

    const mo = new MutationObserver((muts) => {
      let uiCheckNeeded = false;
      for (const m of muts) {
        if (m.type === 'childList' && m.addedNodes?.length) {
          uiCheckNeeded = true;
          m.addedNodes.forEach(n => { if (n.querySelectorAll) tryPlayers(n); });
        }
      }
      if (uiCheckNeeded && !document.getElementById('zaptos-rec-btn')) {
         setTimeout(tryInject, 100);
      }
    });

    mo.observe(document.documentElement, { childList: true, subtree: true });

    log('🎯 Zaptos v4.5 ativo!');
  })();
})();