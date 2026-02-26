const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const ui = {
  health: document.getElementById('health'),
  ammo: document.getElementById('ammo'),
  enemies: document.getElementById('enemies'),
  zone: document.getElementById('zone'),
};

const state = {
  running: false,
  over: false,
  win: false,
  time: 0,
  keys: new Set(),
  bullets: [],
  enemies: [],
  particles: [],
  mouse: { x: canvas.width / 2, y: canvas.height / 2 },
  zone: { x: canvas.width / 2, y: canvas.height / 2, radius: 280, minRadius: 85, shrinkRate: 0.04 },
  player: null,
};

function spawnPlayer() {
  state.player = {
    x: canvas.width / 2,
    y: canvas.height / 2,
    speed: 3,
    hp: 100,
    angle: 0,
    clip: 24,
    reserve: 96,
    fireCooldown: 0,
    reloadTime: 0,
  };
}

function spawnEnemies(total = 8) {
  state.enemies = [];
  for (let i = 0; i < total; i++) {
    const angle = Math.random() * Math.PI * 2;
    const distance = 170 + Math.random() * 220;
    state.enemies.push({
      x: state.zone.x + Math.cos(angle) * distance,
      y: state.zone.y + Math.sin(angle) * distance,
      hp: 55,
      speed: 1.1 + Math.random() * 0.6,
      shootAt: Math.random() * 120,
    });
  }
}

function resetGame() {
  state.running = true;
  state.over = false;
  state.win = false;
  state.time = 0;
  state.bullets = [];
  state.particles = [];
  state.zone.radius = 280;
  spawnPlayer();
  spawnEnemies();
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function shoot(from, angle, speed, damage, color, friendly) {
  state.bullets.push({
    x: from.x,
    y: from.y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    life: 80,
    damage,
    color,
    friendly,
  });
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function hitEffect(x, y, color = '#ffd166') {
  for (let i = 0; i < 8; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = Math.random() * 2 + 0.6;
    state.particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 20 + Math.random() * 12,
      color,
    });
  }
}

function update() {
  if (!state.running) return;

  const p = state.player;
  state.time += 1;

  if (state.zone.radius > state.zone.minRadius) {
    state.zone.radius -= state.zone.shrinkRate;
  }

  let dx = 0;
  let dy = 0;
  if (state.keys.has('w')) dy -= 1;
  if (state.keys.has('s')) dy += 1;
  if (state.keys.has('a')) dx -= 1;
  if (state.keys.has('d')) dx += 1;

  if (dx || dy) {
    const len = Math.hypot(dx, dy);
    p.x += (dx / len) * p.speed;
    p.y += (dy / len) * p.speed;
  }

  p.x = clamp(p.x, 15, canvas.width - 15);
  p.y = clamp(p.y, 15, canvas.height - 15);
  p.angle = Math.atan2(state.mouse.y - p.y, state.mouse.x - p.x);

  const centerDistance = distance(p, state.zone);
  if (centerDistance > state.zone.radius) {
    p.hp -= 0.12;
  }

  if (p.fireCooldown > 0) p.fireCooldown -= 1;
  if (p.reloadTime > 0) {
    p.reloadTime -= 1;
    if (p.reloadTime <= 0) {
      const need = 24 - p.clip;
      const gained = Math.min(need, p.reserve);
      p.clip += gained;
      p.reserve -= gained;
    }
  }

  state.bullets = state.bullets.filter((b) => {
    b.x += b.vx;
    b.y += b.vy;
    b.life -= 1;
    return b.life > 0 && b.x >= 0 && b.x <= canvas.width && b.y >= 0 && b.y <= canvas.height;
  });

  state.enemies.forEach((enemy) => {
    if (enemy.hp <= 0) return;
    const ang = Math.atan2(p.y - enemy.y, p.x - enemy.x);
    enemy.x += Math.cos(ang) * enemy.speed;
    enemy.y += Math.sin(ang) * enemy.speed;

    enemy.shootAt -= 1;
    if (enemy.shootAt <= 0 && distance(enemy, p) < 420) {
      shoot(enemy, ang + (Math.random() - 0.5) * 0.18, 5.8, 8, '#ff7b89', false);
      enemy.shootAt = 60 + Math.random() * 60;
    }

    if (distance(enemy, state.zone) > state.zone.radius) {
      enemy.hp -= 0.08;
    }
  });

  state.bullets.forEach((b) => {
    if (b.friendly) {
      state.enemies.forEach((enemy) => {
        if (enemy.hp > 0 && distance(b, enemy) < 13) {
          enemy.hp -= b.damage;
          b.life = 0;
          hitEffect(enemy.x, enemy.y);
        }
      });
    } else if (distance(b, p) < 14) {
      p.hp -= b.damage;
      b.life = 0;
      hitEffect(p.x, p.y, '#ff6b6b');
    }
  });

  state.enemies = state.enemies.filter((e) => e.hp > 0);

  state.particles = state.particles.filter((particle) => {
    particle.x += particle.vx;
    particle.y += particle.vy;
    particle.vx *= 0.96;
    particle.vy *= 0.96;
    particle.life -= 1;
    return particle.life > 0;
  });

  if (p.hp <= 0) {
    state.over = true;
    state.running = false;
    state.win = false;
  }

  if (!state.enemies.length && !state.over) {
    state.over = true;
    state.running = false;
    state.win = true;
  }

  ui.health.textContent = `HP: ${Math.max(0, Math.round(p.hp))}`;
  ui.ammo.textContent = `Munição: ${p.clip} / ${p.reserve}`;
  ui.enemies.textContent = `Inimigos: ${state.enemies.length}`;
  ui.zone.textContent = `Zona: ${Math.round((state.zone.radius / 280) * 100)}%`;
}

function drawCircle(x, y, r, color) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = '#235f34';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = 'rgba(77, 206, 120, 0.9)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(state.zone.x, state.zone.y, state.zone.radius, 0, Math.PI * 2);
  ctx.stroke();

  const p = state.player;
  if (p) {
    drawCircle(p.x, p.y, 14, '#4dabf7');
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x + Math.cos(p.angle) * 20, p.y + Math.sin(p.angle) * 20);
    ctx.stroke();
  }

  state.enemies.forEach((enemy) => {
    drawCircle(enemy.x, enemy.y, 12, '#ff6b81');
    ctx.fillStyle = '#111';
    ctx.fillRect(enemy.x - 14, enemy.y - 20, 28, 4);
    ctx.fillStyle = '#ff8fa3';
    ctx.fillRect(enemy.x - 14, enemy.y - 20, Math.max(0, (enemy.hp / 55) * 28), 4);
  });

  state.bullets.forEach((b) => drawCircle(b.x, b.y, 3.5, b.color));
  state.particles.forEach((particle) => drawCircle(particle.x, particle.y, 2.2, particle.color));

  if (!state.running) {
    ctx.fillStyle = 'rgba(3, 8, 16, 0.62)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 42px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(state.over ? (state.win ? 'Booyah!' : 'Eliminado') : 'Mini FF Arena', canvas.width / 2, canvas.height / 2 - 18);
    ctx.font = '20px Inter, sans-serif';
    ctx.fillText('Pressione ESPAÇO para jogar', canvas.width / 2, canvas.height / 2 + 24);
  }
}

window.addEventListener('keydown', (e) => {
  const key = e.key.toLowerCase();
  state.keys.add(key);
  if (key === ' ' && !state.running) resetGame();
  if (key === 'r' && state.running) {
    const p = state.player;
    if (p.clip < 24 && p.reserve > 0 && p.reloadTime <= 0) {
      p.reloadTime = 70;
    }
  }
});

window.addEventListener('keyup', (e) => {
  state.keys.delete(e.key.toLowerCase());
});

canvas.addEventListener('mousemove', (e) => {
  const rect = canvas.getBoundingClientRect();
  state.mouse.x = ((e.clientX - rect.left) / rect.width) * canvas.width;
  state.mouse.y = ((e.clientY - rect.top) / rect.height) * canvas.height;
});

canvas.addEventListener('mousedown', () => {
  const p = state.player;
  if (!state.running || !p || p.fireCooldown > 0 || p.reloadTime > 0 || p.clip <= 0) return;
  shoot(p, p.angle + (Math.random() - 0.5) * 0.06, 8.8, 26, '#ffdd57', true);
  p.clip -= 1;
  p.fireCooldown = 9;
});

function loop() {
  update();
  draw();
  requestAnimationFrame(loop);
}

spawnPlayer();
loop();
