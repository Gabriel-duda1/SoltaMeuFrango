document.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('jogoCanva');
  const ctx = canvas.getContext('2d');

  function resizeCanvas() {
    const wrapper = document.getElementById('canvas-wrapper');
    const width = wrapper.clientWidth;
    const height = wrapper.clientHeight;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    recalcularLanes();
  }
  window.addEventListener('resize', resizeCanvas);

  const jogadorImg = new Image(); jogadorImg.src = 'rebeka.png';
  const placaImg = new Image(); placaImg.src = 'placa.png';
  const coneImg = new Image(); coneImg.src = 'cone.png';
  const frangoImg = new Image(); frangoImg.src = 'frango.png';

  let pausado = false;
  let gameOver = false;
  let score = 0;
  let best = Number(localStorage.getItem('bestScore') || 0);

  const scoreEl = document.getElementById('score');
  const bestEl = document.getElementById('best');
  const stateEl = document.getElementById('state');

  const botaoPausar = document.getElementById('botao-pausar');
  const botaoReiniciar = document.getElementById('botao-reiniciar');
  const botaoIniciar = document.getElementById('botao-iniciar');
  const telaInicio = document.getElementById('telaInicio');
  const historiaBtn = document.getElementById('historia-btn');
  const historiaBox = document.getElementById('historia-box');

  let lanePadding = 64;
  let lanes = [0, 0];

  function recalcularLanes() {
    const estradaTop = lanePadding - 16;
    const estradaBottom = canvas.height / (window.devicePixelRatio || 1) - (lanePadding - 16);
    const alturaEstrada = estradaBottom - estradaTop;
    const faixaSuperiorY = estradaTop + alturaEstrada * 0.23;
    const faixaInferiorY = estradaTop + alturaEstrada * 0.63;
    lanes[0] = Math.round(faixaSuperiorY);
    lanes[1] = Math.round(faixaInferiorY);
    if (jogador) {
      jogador.y = lanes[jogador.faixaIndex];
    }
  }

  const jogador = {
    x: 120,
    y: 0,
    largura: 64,
    altura: 64,
    velocidadeX: 2.6,
    faixaIndex: 0
  };

  const obstaculos = [];
  const itens = [];

  const spawnIntervalBase = 1200;
  let ultimoSpawn = 0;
  let velocidadeObstaculo = 3.2;
  let dificuldadeTimer = 0;
  let tempoInicio = null;
  let avisoMostrado = false;

  const popups = [];
  function addPopup(x, y, texto = '+1') {
    popups.push({ x, y, texto, t: 0, dur: 900 });
  }

  function resetar() {
    pausado = false;
    gameOver = false;
    score = 0;
    jogador.x = 120;
    jogador.faixaIndex = 0;
    jogador.y = lanes[jogador.faixaIndex];
    velocidadeObstaculo = 3.2;
    dificuldadeTimer = 0;
    obstaculos.length = 0;
    itens.length = 0;
    popups.length = 0;
    stateEl.textContent = 'Jogando';
    botaoPausar.textContent = 'Pausar';
    scoreEl.textContent = score.toString();
    bestEl.textContent = best.toString();
    tempoInicio = Date.now();
    avisoMostrado = false;
  }

  function spawnObstaculo() {
    const tipo = Math.random() < 0.5 ? 'placa' : 'cone';
    const faixaIndex = Math.random() < 0.5 ? 0 : 1;
    obstaculos.push({
      tipo,
      x: canvas.width / (window.devicePixelRatio || 1) + 30,
      y: lanes[faixaIndex],
      largura: 60,
      altura: 60,
      velocidadeX: velocidadeObstaculo
    });
  }

  let ultimoSpawnFrangoLivre = 0;
  function spawnFrango(faixaIdxOptional) {
    let faixaIndex = typeof faixaIdxOptional === 'number'
      ? faixaIdxOptional
      : (Math.random() < 0.5 ? 0 : 1);

    if (obstaculos.length > 0) {
      const ultimo = obstaculos[obstaculos.length - 1];
      if (ultimo.y === lanes[faixaIndex]) {
        faixaIndex = faixaIndex === 0 ? 1 : 0;
      }
    }

    itens.push({
      tipo: 'frango',
      x: canvas.width / (window.devicePixelRatio || 1) + 30,
      y: lanes[faixaIndex] + 6,
      largura: 48,
      altura: 48,
      velocidadeX: velocidadeObstaculo * 0.95
    });
  }

  function colide(a, b) {
    const padding = 18;
    return (
      a.x < b.x + b.largura - padding &&
      a.x + a.largura > b.x + padding &&
      a.y < b.y + b.altura - padding &&
      a.y + a.altura > b.y + padding
    );
  }

  let ultimoFrame = performance.now();
  function atualizar(timestamp) {
    const dt = Math.min(33, timestamp - ultimoFrame);
    ultimoFrame = timestamp;
    if (pausado || gameOver) return;

    jogador.x += jogador.velocidadeX;
    const pivotX = 220;
    if (jogador.x > pivotX) {
      const deslocamento = jogador.x - pivotX;
      jogador.x = pivotX;
      obstaculos.forEach(o => (o.x -= deslocamento));
      itens.forEach(it => (it.x -= deslocamento));
      score += Math.floor(deslocamento * 0.2);
      scoreEl.textContent = score.toString();
    }

    dificuldadeTimer += dt;
    if (dificuldadeTimer > 1500) {
      dificuldadeTimer = 0;
      velocidadeObstaculo += 0.2;
    }

    if (tempoInicio && !avisoMostrado) {
      const elapsed = (Date.now() - tempoInicio) / 1000;
      if (elapsed >= 90) {
        addPopup(canvas.width / 2, canvas.height / 2, 'Vai ficar mais difícil!');
        avisoMostrado = true;
      }
    }

    if (timestamp - ultimoSpawn > spawnIntervalBase - Math.min(600, score)) {
      ultimoSpawn = timestamp;
      spawnObstaculo();
      if (Math.random() < 0.5) {
        spawnFrango();
      }
    }

    if (timestamp - ultimoSpawnFrangoLivre > 2000) {
      ultimoSpawnFrangoLivre = timestamp;
      if (Math.random() < 0.6) {
        spawnFrango();
      }
    }

    for (let i = obstaculos.length - 1; i >= 0; i--) {
      const o = obstaculos[i];
      o.x -= o.velocidadeX;
      if (o.x + o.largura < -50) {
        obstaculos.splice(i, 1);
        continue;
      }
      if (colide(jogador, o)) {
        gameOver = true;
        stateEl.textContent = 'Derrota';
        best = Math.max(best, score);
        localStorage.setItem('bestScore', String(best));
        bestEl.textContent = best.toString();
      }
    }

    for (let i = itens.length - 1; i >= 0; i--) {
      const it = itens[i];
      it.x -= it.velocidadeX;
      if (it.x + it.largura < -50) {
        itens.splice(i, 1);
        continue;
      }
      if (colide(jogador, it)) {
        score += 1;
        scoreEl.textContent = score.toString();
        addPopup(it.x, it.y - 10, '+1');
        itens.splice(i, 1);
      }
    }

    for (let i = popups.length - 1; i >= 0; i--) {
      const p = popups[i];
      p.t += dt;
      p.y -= 0.06 * dt;
      if (p.t >= p.dur) popups.splice(i, 1);
    }
  }
  function desenharCenario() {
    const cssW = canvas.width / (window.devicePixelRatio || 1);
    const cssH = canvas.height / (window.devicePixelRatio || 1);

    ctx.fillStyle = '#86c98b';
    ctx.fillRect(0, 0, cssW, cssH);

    const estradaY = lanePadding - 16;
    const estradaAltura = cssH - (lanePadding - 16) * 2;

    ctx.fillStyle = '#444';
    ctx.fillRect(0, estradaY, cssW, estradaAltura);

    ctx.strokeStyle = '#eee';
    ctx.lineWidth = 4;
    ctx.setLineDash([18, 12]);
    ctx.beginPath();
    const linhaCentralY = (lanes[0] + lanes[1]) / 2 + 22;
    ctx.moveTo(0, linhaCentralY);
    ctx.lineTo(cssW, linhaCentralY);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = '#2e2e2e';
    ctx.fillRect(0, estradaY, cssW, 8);
    ctx.fillRect(0, estradaY + estradaAltura - 8, cssW, 8);
  }

  function desenhar() {
    const cssW = canvas.width / (window.devicePixelRatio || 1);
    const cssH = canvas.height / (window.devicePixelRatio || 1);

    ctx.clearRect(0, 0, cssW, cssH);
    desenharCenario();

    ctx.drawImage(jogadorImg, jogador.x, jogador.y, jogador.largura, jogador.altura);

    obstaculos.forEach(o => {
      if (o.tipo === 'placa') {
        ctx.drawImage(placaImg, o.x, o.y, o.largura, o.altura);
      } else {
        ctx.drawImage(coneImg, o.x, o.y, o.largura, o.altura);
      }
    });

    itens.forEach(it => {
      ctx.drawImage(frangoImg, it.x, it.y, it.largura, it.altura);
    });

    popups.forEach(p => {
      const alpha = 1 - p.t / p.dur;
      ctx.globalAlpha = Math.max(0, alpha);
      ctx.fillStyle = '#fffbe7';
      ctx.textAlign = 'center';
      ctx.font = '16px "Press Start 2P"';
      ctx.fillText(p.texto, p.x + 20, p.y);
      ctx.globalAlpha = 1;
    });

    if (pausado || gameOver) {
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(0, 0, cssW, cssH);
      ctx.fillStyle = '#fffbe7';
      ctx.textAlign = 'center';
      ctx.font = '20px "Press Start 2P"';

      if (gameOver) {
        ctx.fillText('FIM DE JOGO', cssW / 2, cssH / 2 - 30);
        ctx.font = '12px "Press Start 2P"';
        ctx.fillText(`Pontuação: ${score}`, cssW / 2, cssH / 2);
        ctx.fillText('Pressione Jogar Novamente', cssW / 2, cssH / 2 + 24);
      } else {
        ctx.fillText('PAUSADO', cssW / 2, cssH / 2 - 10);
        ctx.font = '12px "Press Start 2P"';
        ctx.fillText('Pressione Reiniciar', cssW / 2, cssH / 2 + 20);
      }
    }
  }

  function loop(timestamp) {
    atualizar(timestamp);
    desenhar();
    requestAnimationFrame(loop);
  }

  document.addEventListener('keydown', (e) => {
    if (gameOver) {
      if (e.key === 'Enter') resetar();
      return;
    }
    if (e.key === 'ArrowUp') {
      jogador.faixaIndex = 0;
      jogador.y = lanes[jogador.faixaIndex];
    } else if (e.key === 'ArrowDown') {
      jogador.faixaIndex = 1;
      jogador.y = lanes[jogador.faixaIndex];
    }
  });

  botaoPausar.addEventListener('click', () => {
    if (gameOver) return;
    pausado = !pausado;
    stateEl.textContent = pausado ? 'Pausado' : 'Jogando';
    botaoPausar.textContent = pausado ? 'Continuar' : 'Pausar';
  });

  botaoReiniciar.addEventListener('click', () => {
    resetar();
  });

  botaoIniciar.addEventListener('click', () => {
    telaInicio.style.display = 'none';
    resizeCanvas();
    resetar();
    requestAnimationFrame(loop);
  });

  historiaBtn.addEventListener('click', () => {
    historiaBox.style.display = historiaBox.style.display === 'block' ? 'none' : 'block';
  });

  let imagensCarregadas = 0;
  function carregar() {
    imagensCarregadas++;
    if (imagensCarregadas === 4) {
      telaInicio.style.display = 'flex';
    }
  }

  jogadorImg.onload = carregar;
  placaImg.onload = carregar;
  coneImg.onload = carregar;
  frangoImg.onload = carregar;
});
  