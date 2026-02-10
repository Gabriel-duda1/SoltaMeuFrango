document.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('jogoCanva');
  const ctx = canvas.getContext('2d');

  // Resolução interna do canvas responsiva
  function resizeCanvas() {
    const wrapper = document.getElementById('canvas-wrapper');
    const width = wrapper.clientWidth;
    const height = wrapper.clientHeight;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); // escala para desenhar em CSS pixels
    // Atualiza posições dependentes do canvas
    recalcularLanes();
  }
  window.addEventListener('resize', resizeCanvas);

  // Imagens
  const jogadorImg = new Image(); jogadorImg.src = 'rebeka.png';
  const placaImg = new Image(); placaImg.src = 'placa.png';
  const coneImg = new Image(); coneImg.src = 'cone.png';
  const frangoImg = new Image(); frangoImg.src = 'frango.png';

  // Estado do jogo
  let pausado = false;
  let gameOver = false;
  let score = 0;
  let best = Number(localStorage.getItem('bestScore') || 0);

  const scoreEl = document.getElementById('score');
  const bestEl = document.getElementById('best');
  const stateEl = document.getElementById('state');

  const botaoPausar = document.getElementById('botao-pausar');
  const botaoReiniciar = document.getElementById('botao-reiniciar');

  // Dimensões e faixas
  let lanePadding = 64; // ajustado para visual melhor
  let lanes = [0, 0];   // será recalculado no resize

  function recalcularLanes() {
    // Faixas mais “no centro” da estrada para não ficar colada na linha
    const estradaTop = lanePadding - 16;
    const estradaBottom = canvas.height / (window.devicePixelRatio || 1) - (lanePadding - 16);
    const alturaEstrada = estradaBottom - estradaTop;

    const faixaSuperiorY = estradaTop + alturaEstrada * 0.23; // ajustado para estética
    const faixaInferiorY = estradaTop + alturaEstrada * 0.63; // ajustado para estética

    lanes[0] = Math.round(faixaSuperiorY);
    lanes[1] = Math.round(faixaInferiorY);
    // Se jogador já existe, atualiza posição Y
    if (jogador) {
      jogador.y = lanes[jogador.faixaIndex];
    }
  }

  // Jogador
  const jogador = {
    x: 120,
    y: 0, // definido após resize
    largura: 64,
    altura: 64,
    velocidadeX: 2.6,
    faixaIndex: 0
  };

  // Obstáculos e itens
  const obstaculos = [];
  const itens = []; // frango

  const spawnIntervalBase = 1200;  // ms
  let ultimoSpawn = 0;
  let velocidadeObstaculo = 3.2;
  let dificuldadeTimer = 0;

  // Animações “+1”
  const popups = []; // {x, y, texto, t, dur}

  function addPopup(x, y, texto = '+1') {
    popups.push({ x, y, texto, t: 0, dur: 900 }); // 900ms
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
  }

  // Spawner de obstáculos
  function spawnObstaculo() {
    const tipo = Math.random() < 0.5 ? 'placa' : 'cone';
    const faixaIndex = Math.random() < 0.5 ? 0 : 1;

    const largura = 60;
    const altura = 60;

    obstaculos.push({
      tipo,
      x: canvas.width / (window.devicePixelRatio || 1) + 30,
      y: lanes[faixaIndex],
      largura,
      altura,
      velocidadeX: velocidadeObstaculo
    });
  }

  // Spawner de frango (às vezes com obstáculo, às vezes sozinho)
  // Regra: a cada spawn de obstáculo, 50% chance de também spawnar frango.
  // E adicionalmente, spawns independentes a cada ~2s.
  let ultimoSpawnFrangoLivre = 0;
  function spawnFrango(faixaIdxOptional) {
    const faixaIndex = typeof faixaIdxOptional === 'number'
      ? faixaIdxOptional
      : (Math.random() < 0.5 ? 0 : 1);

    const largura = 48;
    const altura = 48;

    itens.push({
      tipo: 'frango',
      x: canvas.width / (window.devicePixelRatio || 1) + 30,
      y: lanes[faixaIndex] + 6, // levemente centralizado
      largura,
      altura,
      velocidadeX: velocidadeObstaculo * 0.95 // vem um pouco mais devagar
    });
  }

  // Colisão AABB com padding
  function colide(a, b) {
    const padding = 12;
    return (
      a.x < b.x + b.largura - padding &&
      a.x + a.largura > b.x + padding &&
      a.y < b.y + b.altura - padding &&
      a.y + a.altura > b.y + padding
    );
  }

  // Atualização
  let ultimoFrame = performance.now();
  function atualizar(timestamp) {
    const dt = Math.min(33, timestamp - ultimoFrame);
    ultimoFrame = timestamp;

    if (pausado || gameOver) return;

    // Avanço do jogador
    jogador.x += jogador.velocidadeX;

    // Travar janela do jogador e mover mundo
    const pivotX = 220;
    if (jogador.x > pivotX) {
      const deslocamento = jogador.x - pivotX;
      jogador.x = pivotX;

      obstaculos.forEach(o => (o.x -= deslocamento));
      itens.forEach(it => (it.x -= deslocamento));

      score += Math.floor(deslocamento * 0.2);
      scoreEl.textContent = score.toString();
    }

    // Dificuldade progressiva
    dificuldadeTimer += dt;
    if (dificuldadeTimer > 4000) {
      dificuldadeTimer = 0;
      velocidadeObstaculo += 0.2;
    }

    // Spawn por tempo (obstáculos)
    if (timestamp - ultimoSpawn > spawnIntervalBase - Math.min(600, score)) {
      ultimoSpawn = timestamp;
      spawnObstaculo();
      // 50% de chance de frango junto
      if (Math.random() < 0.5) {
        spawnFrango(); // mesmo timing, faixa aleatória
      }
    }

    // Spawn de frango sozinho (a cada ~2s)
    if (timestamp - ultimoSpawnFrangoLivre > 2000) {
      ultimoSpawnFrangoLivre = timestamp;
      if (Math.random() < 0.6) { // nem sempre
        spawnFrango();
      }
    }

    // Atualiza obstáculos
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

    // Atualiza frangos
    for (let i = itens.length - 1; i >= 0; i--) {
      const it = itens[i];
      it.x -= it.velocidadeX;

      if (it.x + it.largura < -50) {
        itens.splice(i, 1);
        continue;
      }

      if (colide(jogador, it)) {
        // Coleta
        score += 1;
        scoreEl.textContent = score.toString();

        // Animação +1 na posição do frango
        addPopup(it.x, it.y - 10, '+1');

        // Remove item coletado
        itens.splice(i, 1);
      }
    }

    // Atualiza popups +1
    for (let i = popups.length - 1; i >= 0; i--) {
      const p = popups[i];
      p.t += dt;
      // Sobe levemente
      p.y -= 0.06 * dt;
      // Remove ao terminar
      if (p.t >= p.dur) popups.splice(i, 1);
    }
  }

  // Desenho do cenário com duas “ruas”
  function desenharCenario() {
    const cssW = canvas.width / (window.devicePixelRatio || 1);
    const cssH = canvas.height / (window.devicePixelRatio || 1);

    // Fundo
    ctx.fillStyle = '#86c98b';
    ctx.fillRect(0, 0, cssW, cssH);

    // Estrada
    const estradaY = lanePadding - 16;
    const estradaAltura = cssH - (lanePadding - 16) * 2;

    ctx.fillStyle = '#444';
    ctx.fillRect(0, estradaY, cssW, estradaAltura);

    // Faixa divisória central (tracejada)
    ctx.strokeStyle = '#eee';
    ctx.lineWidth = 4;
    ctx.setLineDash([18, 12]);
    ctx.beginPath();
    const linhaCentralY = (lanes[0] + lanes[1]) / 2 + 22;
    ctx.moveTo(0, linhaCentralY);
    ctx.lineTo(cssW, linhaCentralY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Bordas da estrada
    ctx.fillStyle = '#2e2e2e';
    ctx.fillRect(0, estradaY, cssW, 8);
    ctx.fillRect(0, estradaY + estradaAltura - 8, cssW, 8);
  }

  function desenhar() {
    const cssW = canvas.width / (window.devicePixelRatio || 1);
    const cssH = canvas.height / (window.devicePixelRatio || 1);

    ctx.clearRect(0, 0, cssW, cssH);

    // cenário
    desenharCenario();

    // jogador
    ctx.drawImage(jogadorImg, jogador.x, jogador.y, jogador.largura, jogador.altura);

    // obstáculos
    obstaculos.forEach(o => {
      if (o.tipo === 'placa') {
        ctx.drawImage(placaImg, o.x, o.y, o.largura, o.altura);
      } else {
        ctx.drawImage(coneImg, o.x, o.y, o.largura, o.altura);
      }
    });

    // frangos
    itens.forEach(it => {
      ctx.drawImage(frangoImg, it.x, it.y, it.largura, it.altura);
    });

    // popups +1
    popups.forEach(p => {
      const alpha = 1 - p.t / p.dur;
      ctx.globalAlpha = Math.max(0, alpha);
      ctx.fillStyle = '#fffbe7';
      ctx.textAlign = 'center';
      ctx.font = '16px "Press Start 2P"';
      ctx.fillText(p.texto, p.x + 20, p.y);
      ctx.globalAlpha = 1;
    });

    // overlays
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

  // Loop
  function loop(timestamp) {
    atualizar(timestamp);
    desenhar();
    requestAnimationFrame(loop);
  }

  // Controles: alternar faixas
  document.addEventListener('keydown', (e) => {
    if (gameOver) {
      // Se estiver na tela de fim de jogo, permitir “Enter” para reiniciar
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

  // Botões
  botaoPausar.addEventListener('click', () => {
    if (gameOver) return;
    pausado = !pausado;
    stateEl.textContent = pausado ? 'Pausado' : 'Jogando';
    botaoPausar.textContent = pausado ? 'Continuar' : 'Pausar';
  });

  botaoReiniciar.addEventListener('click', () => {
    resetar();
  });

  // Carregamento de imagens
  let imagensCarregadas = 0;
  function carregar() {
    imagensCarregadas++;
    if (imagensCarregadas === 4) {
      resizeCanvas(); // define resolução e lanes
      resetar();
      requestAnimationFrame(loop);
    }
  }


  jogadorImg.onload = carregar;
  placaImg.onload = carregar;
  coneImg.onload = carregar;
  frangoImg.onload = carregar;
});