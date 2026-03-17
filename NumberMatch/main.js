import { createGame } from './src/game.js';

const root = document.getElementById('phaser-root');
const gridSizeSelect = document.getElementById('grid-size-select');
const themeSelect = document.getElementById('theme-select');
const restartBtn = document.getElementById('restart-btn');
const hintBtn = document.getElementById('hint-btn');

let currentGame = null;
let currentSize = parseInt(gridSizeSelect.value, 10) || 9;
let currentTheme = themeSelect?.value || 'midnight';

const PAGE_BACKGROUNDS = {
  midnight: 'radial-gradient(circle at top, #1f2933, #020617)',
  ocean: 'radial-gradient(circle at top, #0b3a4a, #061826)',
  sunset: 'radial-gradient(circle at top, #5b1f3b, #1b1020)',
  mint: 'radial-gradient(circle at top, #0f3d2f, #061a14)',
  cottonCandy: 'radial-gradient(circle at top, #ffd1f3, #7dd3fc)',
  bubbleGum: 'radial-gradient(circle at top, #ff5ac8, #7c3aed)',
};

function applyPageTheme(themeKey) {
  const bg = PAGE_BACKGROUNDS[themeKey] || PAGE_BACKGROUNDS.midnight;
  document.documentElement.style.setProperty('--page-bg', bg);
}

function startGame(size) {
  currentSize = size;
  if (currentGame) {
    currentGame.destroy(true);
    currentGame = null;
  }
  applyPageTheme(currentTheme);
  currentGame = createGame(root, { gridSize: currentSize, themeKey: currentTheme });
}

gridSizeSelect.addEventListener('change', () => {
  const size = parseInt(gridSizeSelect.value, 10) || currentSize;
  startGame(size);
});

restartBtn.addEventListener('click', () => {
  startGame(currentSize);
});

hintBtn?.addEventListener('click', () => {
  if (!currentGame) return;
  const scene = currentGame.scene.getScene('GameScene');
  if (scene && typeof scene.flashHint === 'function') {
    scene.flashHint();
  }
});

themeSelect?.addEventListener('change', () => {
  currentTheme = themeSelect.value || currentTheme;
  applyPageTheme(currentTheme);
  if (!currentGame) return;
  const scene = currentGame.scene.getScene('GameScene');
  if (scene && typeof scene.applyTheme === 'function') {
    scene.applyTheme(currentTheme);
  } else {
    // Fallback: restart if scene isn't ready for some reason
    startGame(currentSize);
  }
});

// Boot initial game
startGame(currentSize);

