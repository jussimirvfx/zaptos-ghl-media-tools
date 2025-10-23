/*!
 * Zaptos GHL Media Tools - Versão 4.5 (SVG mic + posição ao lado do ícone alvo + CSS extra)
 * Copyright (c) 2025 Zaptos Company
 * Licensed under the Apache License, Version 2.0
 */
(function () {
  if (window.__ZAPTOS_GHL_MEDIA_MP3__) return;
  window.__ZAPTOS_GHL_MEDIA_MP3__ = 'v4.5-icon-wrapper-fix';

  const log = (...a) => console.log('[Zaptos v4.5]', ...a);
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

  // --- CSS extra solicitado
  const injectCustomCSS = () => {
    const css = `
/* Botão de gravação - posicionado na mesma posição do SVG do microfone */
#zaptos-rec-btn{
  position:relative;
  top:0px;
  left:255px;
}

/* Justify between */
#composer-textarea div .justify-between{
  transform: translatey(1px) !important;
  position:static;
  top:-3px;
  padding-left:0px;
}

/* Zaptos rec */
#zaptos-rec-btn{
  transform: translatex(-256px);
}

/* Justify center */
#composer-textarea .max-w-full > .items-center > .justify-center{
  transform:translatex(0px) translatey(0px);
}

/* Zaptos preview */
#zaptos-preview{
  position: fixed !important;
  top: 50% !important;
  left: 50% !important;
  transform: translate(-50%, -50%) !important;
  width: 350px !important;
  height: auto !important;
  min-width: 350px !important;
  max-width: 350px !important;
  z-index: 10000 !important;
  background: #fff !important;
  padding: 20px !important;
  border-radius: 12px !important;
  box-shadow: 0 10px 40px rgba(0,0,0,0.15) !important;
  display: flex !important;
  flex-direction: column !important;
  gap: 12px !important;
}`;
    const style = document.createElement('style');
    style.id = 'zaptos-custom-style';
    style.textContent = css;
    document.head.appendChild(style);
  };

  // --- Utils UI/GHL
  const findIconToolbar = () => {
    // container flex com os ícones
    const toolbar =
      document.querySelector('#composer-textarea .flex.flex-row.gap-2.items-center.pl-2.rounded-md.flex-1.min-w-0') ||
      document.querySelector('#composer-textarea .max-w-full > .items-center > .items-center') ||
      document.querySelector('#composer-textarea .items-center .items-center');
    return toolbar || null;
  };

  const findComposer = () => document.getElementById('composer-textarea');

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

  // botão de anexo
  const findAttachmentButton = () => {
    const svgClip = document.querySelector('svg[data-v-4094da08][stroke-linecap="round"][class*="cursor-pointer"]');
    if (svgClip) {
      const clickableParent = svgClip.closest('.icon-wrapper');
      if (clickableParent) return clickableParent;
    }
    // fallback
    let btn = document.querySelector("button[aria-label*='attach' i]") ||
              document.querySelector("button[title*='attach' i]");
    return btn || null;
  };

  const performUpload = (input, file) => {
    try {
      const dt = new DataTransfer();
      dt.items.add(file);
      input.files = dt.files;
      input.dispatchEvent(new Event('change', { bubbles: true }));
      input.dispatchEvent(new Event('input', { bubbles: true }));
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype, 'value'
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
      if (attachBtn && attachBtn.click) {
        attachBtn.click();
        setTimeout(() => {
          input = findFileInput();
          if (input) {
            log('✅ Input apareceu após clicar no botão!');
            performUpload(input, file);
          } else {
            log('❌ Input ainda não encontrado após o clique no botão de anexo.');
            alert('❌ Campo de upload não encontrado após clique no anexo.\n\nPor favor, clique manualmente no ícone de anexo (📎) e tente novamente.');
          }
        }, 600);
        return true;
      } else {
        log('❌ Botão de anexar não encontrado.');
        alert('❌ Campo de upload não encontrado.\n\nPor favor, clique manualmente no ícone de anexo (📎) e tente novamente.');
        return false;
      }
    }

    log('✅ Input encontrado diretamente, fazendo upload...');
    return performUpload(input, file);
  };

  // --- Encoders
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
    view.setUint16(offset, 1, true); offset += 2;          // PCM
    view.setUint16(offset, 1, true); offset += 2;          // mono
    view.setUint32(offset, sampleRate, true); offset += 4;
    view.setUint32(offset, byteRate, true); offset += 4;
    view.setUint16(offset, blockAlign, true); offset += 2;
    view.setUint16(offset, 16, true); offset += 2;         // 16-bit
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

  // --- Botão + Gravação (SVG embutido e posicionado ao lado do ícone alvo)
  function createRecorderUI() {
    if (document.getElementById('zaptos-rec-btn')) return;

    // Verifica se o container específico está ativo/visível
    const targetContainer = document.querySelector('div[data-v-4094da08].flex.flex-row.gap-2.items-center.pl-2.rounded-md.flex-1.min-w-0');
    if (!targetContainer || targetContainer.style.display === 'none' || targetContainer.offsetParent === null) {
      return; // Não cria o botão se o container não estiver ativo
    }

    // SVG do microfone (usa currentColor, viewBox 24)
    const MIC_SVG = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M8 6a4 4 0 1 1 8 0v6a4 4 0 1 1-8 0V6Z" fill="currentColor"/>
        <path d="M5.5 12a6.5 6.5 0 0 0 13 0" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        <path d="M12 18v4M8 22h8" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      </svg>
    `;
    const STOP_SVG = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true">
        <rect x="7" y="7" width="10" height="10" rx="2" ry="2" fill="currentColor"/>
      </svg>
    `;

    // Normaliza tamanho/cor do SVG
    const normalizeIcon = (root) => {
      const svg = root.querySelector('svg');
      if (!svg) return;
      svg.setAttribute('width', '20');
      svg.setAttribute('height', '20');
      svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
      svg.querySelectorAll('[fill]').forEach(n => {
        const v = n.getAttribute('fill');
        if (v && v !== 'none' && v !== 'currentColor') n.setAttribute('fill', 'currentColor');
      });
      svg.querySelectorAll('[stroke]').forEach(n => {
        const v = n.getAttribute('stroke');
        if (v && v !== 'none' && v !== 'currentColor') n.setAttribute('stroke', 'currentColor');
      });
      svg.style.display = 'block';
      svg.style.flexShrink = '0';
    };

    const toolbar = findIconToolbar();
    if (!toolbar) return;

    // 🎯 ENCAIXE EXATO: após o ícone com classes "w-4 h-4 cursor-pointer text-gray-500 hover:text-red-500"
    const targetSvg = toolbar.querySelector('.icon-wrapper svg.w-4.h-4.cursor-pointer.text-gray-500.hover\\:text-red-500');
    const targetWrapper = targetSvg ? targetSvg.closest('.icon-wrapper') : null;

    // Wrapper igual aos demais
    const micWrapper = document.createElement('div');
    micWrapper.className = 'icon-wrapper';
    micWrapper.setAttribute('data-v-4094da08', '');

    const btn = document.createElement('button');
    btn.id = 'zaptos-rec-btn';
    btn.type = 'button';
    btn.title = 'Gravar áudio (MP3/WAV)';
    btn.innerHTML = MIC_SVG;
    Object.assign(btn.style, {
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      width: '28px', height: '28px', padding: '0', margin: '0',
      backgroundColor: 'transparent', color: '#64748b',
      border: 'none', cursor: 'pointer',
      transition: 'background-color 0.2s, color 0.2s', position: 'relative', flexShrink: '0',
      outline: 'none'
    });
    normalizeIcon(btn);

    // Timer
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

    micWrapper.appendChild(btn);

    // Inserção: exatamente à direita do targetWrapper
    if (targetWrapper && targetWrapper.parentNode) {
      targetWrapper.parentNode.insertBefore(micWrapper, targetWrapper.nextSibling);
      log('✅ Microfone inserido após o ícone alvo (hover:text-red-500).');
    } else {
      // fallback: adiciona ao fim da toolbar
      toolbar.appendChild(micWrapper);
      log('⚠️ Ícone alvo não encontrado — microfone adicionado ao final da toolbar.');
    }

    // --- Estado e gravação
    let ac = null, source = null, proc = null, stream = null;
    let buffers = [];
    let seconds = 0, tHandle = null, sampleRate = 44100;
    let isRecording = false;

    const setMicIcon = () => { btn.innerHTML = MIC_SVG; btn.appendChild(timer); normalizeIcon(btn); };
    const setStopIcon = () => { btn.innerHTML = STOP_SVG; btn.appendChild(timer); normalizeIcon(btn); };

    const tick = () => {
      seconds++;
      const m = String(Math.floor(seconds / 60)).padStart(2, '0');
      const s = String(seconds % 60).padStart(2, '0');
      timer.textContent = `${m}:${s}`;
    };
    const resetTimer = () => { clearInterval(tHandle); seconds = 0; timer.textContent = '00:00'; timer.style.display = 'none'; };

    btn.onmouseenter = () => { if (!isRecording) btn.style.backgroundColor = '#f1f5f9'; };
    btn.onmouseleave = () => { if (!isRecording) btn.style.backgroundColor = 'transparent'; };

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

        isRecording = true;
        setStopIcon();
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

      isRecording = false;
      setMicIcon();
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

    btn.onclick = () => { if (isRecording) { stop(); } else { start(); } };
  }

  // --- Players embutidos
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

  // --- Inicialização
  (async () => {
    injectCustomCSS(); // aplica o CSS adicional
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
      
      // Verifica se o container ainda está ativo
      const targetContainer = document.querySelector('div[data-v-4094da08].flex.flex-row.gap-2.items-center.pl-2.rounded-md.flex-1.min-w-0');
      const recBtn = document.getElementById('zaptos-rec-btn');
      
      if (recBtn && (!targetContainer || targetContainer.style.display === 'none' || targetContainer.offsetParent === null)) {
        // Remove o botão se o container não estiver ativo
        recBtn.closest('.icon-wrapper')?.remove();
        log('🗑️ Botão removido - container não ativo');
      }
      
      if (uiCheckNeeded && !recBtn) {
        setTimeout(tryInject, 100);
      }
    });

    mo.observe(document.documentElement, { childList: true, subtree: true });

    log('🎯 Zaptos v4.5 ativo!');
  })();
})();
