import { createGame } from './src/game.js';

const root = document.getElementById('phaser-root');
const gridSizeSelect = document.getElementById('grid-size-select');
const restartBtn = document.getElementById('restart-btn');
const hintBtn = document.getElementById('hint-btn');

let currentGame = null;
const savedSize = localStorage.getItem('numberMatchGridSize');
if (savedSize) gridSizeSelect.value = savedSize;
let currentSize = parseInt(gridSizeSelect.value, 10) || 9;

function startGame(size) {
  currentSize = size;
  if (currentGame) {
    currentGame.destroy(true);
    currentGame = null;
  }
  currentGame = createGame(root, { gridSize: currentSize });
}

gridSizeSelect.addEventListener('change', () => {
  const size = parseInt(gridSizeSelect.value, 10) || currentSize;
  localStorage.setItem('numberMatchGridSize', String(size));
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

document.fonts.ready.then(() => {
  startGame(currentSize);
});
