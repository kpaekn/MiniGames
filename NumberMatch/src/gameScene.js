import { createGrid, canMatch, applyMatch, collapseAndRefill, hasAnyMoves } from './gridLogic.js';

const THEME = {
  bg: '#e8eaed',
  hudPrimary: '#1a1a2e',
  hudSecondary: '#4a4a6a',
  tileFilled: 0xffffff,
  tileEmpty: 0xe8eaed,
  tileStroke: 0xb0b4bc,
  tileSelectedStroke: 0xfbbf24,
  overlayBg: 0xd0d4dc,
  overlayStroke: 0x9098a8,
  buttonBg: 0xc0c4cc,
  buttonStroke: 0x9098a8,
  text: '#1a1a2e',
  ghostText: '#9098a8',
  matchLine: 0xf59e0b,
};

/**
 * Main Phaser scene for Number Match.
 */
export class GameScene extends Phaser.Scene {
  /**
   * @param {{ gridSize: number }} config
   */
  constructor(config = { gridSize: 9 }) {
    super('GameScene');
    this.gridSize = config.gridSize || 9;
    this.theme = THEME;

    /** @type {(number|null)[][]} */
    this.grid = [];

    /** @type {{ row: number, col: number } | null} */
    this.selectedCell = null;

    /** @type {Phaser.GameObjects.Container[][]} */
    this.tileContainers = [];

    this.tileSize = 0;
    this.gridOriginX = 0;
    this.gridOriginY = 0;

    this.score = 0;
    this.highScore = parseInt(localStorage.getItem('numberMatchHighScore') || '0', 10);
    /** @type {Phaser.GameObjects.Text | null} */
    this.scoreText = null;
    /** @type {Phaser.GameObjects.Text | null} */
    this.highScoreText = null;

    /** @type {Map<string, number>} */
    this.ghostNumbers = new Map();

    /** @type {Phaser.GameObjects.Container | null} */
    this.gameOverOverlay = null;
  }

  create() {
    this.cameras.main.setBackgroundColor(this.theme.bg);
    const width = /** @type {number} */ (this.game.config.width);
    const height = /** @type {number} */ (this.game.config.height);

    const verticalPadding = 60;
    const availableHeight = height - verticalPadding - 40;
    const availableWidth = width - 40;
    this.tileSize = Math.floor(
      Math.min(availableWidth, availableHeight) / this.gridSize
    );

    this.gridOriginX = (width - this.tileSize * this.gridSize) / 2;
    this.gridOriginY = verticalPadding;

    this.addHud();

    const gridWidth = this.tileSize * this.gridSize;
    const gridHeight = this.tileSize * this.gridSize;
    this.add
      .rectangle(
        this.gridOriginX + gridWidth / 2,
        this.gridOriginY + gridHeight / 2,
        gridWidth,
        gridHeight
      )
      .setFillStyle()
      .setStrokeStyle(3, 0xf59e0b)
      .setDepth(1);

    this.grid = createGrid(this.gridSize);
    this.buildGridDisplay();
  }

  addHud() {
    const style = {
      fontFamily: '"DynaPuff", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      fontSize: '20px',
      color: this.theme.hudPrimary,
    };

    const width = /** @type {number} */ (this.game.config.width);

    this.highScoreText = this.add
      .text(20, 20, `Best: ${this.highScore}`, { ...style, color: this.theme.hudSecondary })
      .setOrigin(0, 0)
      .setDepth(10);

    this.scoreText = this.add
      .text(width - 20, 20, 'Score: 0', style)
      .setOrigin(1, 0)
      .setDepth(10);
  }

  updateScore(delta) {
    this.score += delta;
    if (this.score > this.highScore) {
      this.highScore = this.score;
      localStorage.setItem('numberMatchHighScore', String(this.highScore));
      if (this.highScoreText) {
        this.highScoreText.setText(`Best: ${this.highScore}`);
      }
    }
    if (this.scoreText) {
      this.scoreText.setText(`Score: ${this.score}`);
      this.tweens.add({
        targets: this.scoreText,
        scale: 1.1,
        duration: 80,
        yoyo: true,
        ease: 'Sine.easeOut',
      });
    }
  }

  /**
   * Find any available match on the current grid.
   * @returns {{ a: {row:number,col:number}, b: {row:number,col:number} } | null}
   */
  findAllMatches() {
    const size = this.gridSize;
    const matches = [];
    for (let r1 = 0; r1 < size; r1++) {
      for (let c1 = 0; c1 < size; c1++) {
        if (this.grid[r1][c1] == null) continue;
        const a = { row: r1, col: c1 };
        for (let r2 = 0; r2 < size; r2++) {
          for (let c2 = 0; c2 < size; c2++) {
            if (r1 === r2 && c1 === c2) continue;
            if (this.grid[r2][c2] == null) continue;
            const b = { row: r2, col: c2 };
            if (canMatch(this.grid, a, b)) {
              matches.push({ a, b });
            }
          }
        }
      }
    }
    return matches;
  }

  findAnyMatch() {
    const matches = this.findAllMatches();
    if (matches.length === 0) return null;
    return matches[Math.floor(matches.length / 2)];
  }

  flashHint() {
    if (this.gameOverOverlay) return;
    if (!this.input || !this.input.enabled) return;

    const match = this.findAnyMatch();
    if (!match) return;

    const { a, b } = match;
    const containerA = this.tileContainers[a.row]?.[a.col];
    const containerB = this.tileContainers[b.row]?.[b.col];
    if (!containerA || !containerB) return;

    const hintColor = this.theme.tileSelectedStroke;

    const flash = (container) => {
      const overlay = this.add
        .rectangle(0, 0, this.tileSize, this.tileSize, hintColor)
        .setAlpha(0.85);
      container.addAt(overlay, container.list.length - 1);

      this.tweens.add({
        targets: overlay,
        alpha: 0,
        duration: 800,
        ease: 'Linear',
        onComplete: () => overlay.destroy(),
      });
    };

    flash(containerA);
    flash(containerB);
  }

  /**
   * Lightweight tone feedback using Web Audio.
   * @param {number} frequency
   * @param {number} durationMs
   */
  playTone(frequency, durationMs) {
    const audioContext = this.sound && this.sound.context;
    if (!audioContext) return;

    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.type = 'sine';
    oscillator.frequency.value = frequency;

    gainNode.gain.setValueAtTime(0.18, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(
      0.0001,
      audioContext.currentTime + durationMs / 1000
    );

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.start();
    oscillator.stop(audioContext.currentTime + durationMs / 1000);
  }

  spawnMatchEffect(cx, cy) {
    const sq = this.add
      .rectangle(cx, cy, this.tileSize, this.tileSize, 0xf59e0b)
      .setDepth(15);

    let exploded = false;
    this.tweens.add({
      targets: sq,
      scaleX: 0,
      scaleY: 0,
      alpha: 0,
      rotation: Math.PI / 2,
      duration: 500,
      ease: 'Sine.easeOut',
      onUpdate: () => {
        if (!exploded && sq.scaleX <= 0.3) {
          exploded = true;
          this.spawnExplosion(cx, cy);
        }
      },
      onComplete: () => sq.destroy(),
    });
  }

  spawnExplosion(cx, cy) {
    const count = 4;
    const size = this.tileSize * 0.3;
    const spread = this.tileSize * 0.45;

    for (let i = 0; i < count; i++) {
      const baseAngle = (Math.PI * 2 / count) * i;
      const angle = baseAngle + (Math.random() - 0.5) * 0.8;
      const startRotation = Math.random() * Math.PI;
      const particle = this.add
        .rectangle(cx, cy, size, size, 0xf59e0b)
        .setRotation(startRotation)
        .setDepth(15);

      const spinDir = Math.random() > 0.5 ? 1 : -1;
      this.tweens.add({
        targets: particle,
        x: cx + Math.cos(angle) * spread,
        y: cy + Math.sin(angle) * spread,
        alpha: 0,
        scaleX: 0,
        scaleY: 0,
        rotation: startRotation + spinDir * (Math.PI + Math.random() * Math.PI * 2),
        duration: 1500,
        ease: 'Quint.easeOut',
        onComplete: () => particle.destroy(),
      });
    }
  }

  /**
   * @param {number} row
   * @param {number} col
   */
  getCellCenter(row, col) {
    return {
      x: this.gridOriginX + col * this.tileSize + this.tileSize / 2,
      y: this.gridOriginY + row * this.tileSize + this.tileSize / 2,
    };
  }

  /**
   * Create a tile container at the given row/col.
   * Optionally override the initial y for slide-in animations.
   * @param {number} row
   * @param {number} col
   * @param {{ y?: number }} [opts]
   */
  createTileContainer(row, col, opts = {}) {
    const { x, y } = this.getCellCenter(row, col);
    const container = this.add.container(x, opts.y ?? y);

    const rect = this.add
      .rectangle(
        0,
        0,
        this.tileSize,
        this.tileSize,
        this.theme.tileFilled
      )
      .setStrokeStyle(1, this.theme.tileStroke);

    const value = this.grid[row][col];
    const text = this.add
      .text(0, 0, value != null ? String(value) : '', {
        fontFamily:
          '"DynaPuff", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        fontSize: `${Math.floor(this.tileSize * 0.6)}px`,
        color: this.theme.text,
      })
      .setOrigin(0.5);

    container.add(rect);
    container.add(text);

    container.setSize(this.tileSize, this.tileSize);

    rect.setInteractive();

    container.setData({ row, col, rect, text });

    rect.on('pointerdown', () => {
      const { row: rr, col: cc } = container.data.values;
      this.handleTileClick(rr, cc);
    });

    return container;
  }

  buildGridDisplay() {
    this.tileContainers.forEach((row) =>
      row.forEach((container) => container.destroy())
    );
    this.tileContainers = [];

    for (let r = 0; r < this.gridSize; r++) {
      const rowContainers = [];
      for (let c = 0; c < this.gridSize; c++) {
        const container = this.createTileContainer(r, c);

        this.tileContainers[r] = this.tileContainers[r] || [];
        this.tileContainers[r][c] = container;
      }
    }

    this.refreshGridDisplay();
  }

  refreshGridDisplay() {
    for (let r = 0; r < this.gridSize; r++) {
      for (let c = 0; c < this.gridSize; c++) {
        const container =
          this.tileContainers[r] && this.tileContainers[r][c];
        if (!container) continue;

        const value = this.grid[r][c];
        const data = container.data.values;
        const rect = data.rect;
        const text = data.text;
        const key = `${r},${c}`;

        if (value == null) {
          rect.disableInteractive();
          rect.setFillStyle(this.theme.tileEmpty);
          rect.setAlpha(0.5);

          if (this.ghostNumbers.has(key)) {
            text.setText(String(this.ghostNumbers.get(key)));
            text.setColor(this.theme.ghostText);
            text.setAlpha(0.55);
          } else {
            text.setText('');
            text.setAlpha(1);
          }
        } else {
          rect.setInteractive();
          rect.setFillStyle(this.theme.tileFilled);
          text.setText(String(value));
          text.setColor(this.theme.text);
          text.setAlpha(1);
          rect.setAlpha(1);
          this.ghostNumbers.delete(key);
        }

        const isSelected =
          this.selectedCell &&
          this.selectedCell.row === r &&
          this.selectedCell.col === c;
        if (value != null) {
          rect.setFillStyle(isSelected ? this.theme.tileSelectedStroke : this.theme.tileFilled);
        }
      }
    }
  }

  clearSelection() {
    this.selectedCell = null;
    this.refreshGridDisplay();
  }

  resetGame() {
    if (this.gameOverOverlay) {
      this.gameOverOverlay.destroy(true);
      this.gameOverOverlay = null;
    }

    this.score = 0;
    if (this.scoreText) {
      this.scoreText.setText('Score: 0');
    }

    this.selectedCell = null;
    this.ghostNumbers.clear();
    this.grid = createGrid(this.gridSize);
    this.buildGridDisplay();
  }

  handleTileClick(row, col) {
    if (this.gameOverOverlay) {
      return;
    }

    const value = this.grid[row][col];
    if (value == null) {
      return;
    }

    if (
      this.selectedCell &&
      this.selectedCell.row === row &&
      this.selectedCell.col === col
    ) {
      this.clearSelection();
      return;
    }

    if (!this.selectedCell) {
      this.selectedCell = { row, col };
      this.refreshGridDisplay();
      return;
    }

    const a = this.selectedCell;
    const b = { row, col };

    if (!canMatch(this.grid, a, b)) {
      this.tweens.add({
        targets: this.tileContainers[row][col],
        scale: 0.95,
        duration: 80,
        yoyo: true,
        ease: 'Sine.easeOut',
      });
      this.playTone(220, 120);
      this.clearSelection();
      return;
    }

    const containerA = this.tileContainers[a.row][a.col];
    const containerB = this.tileContainers[b.row][b.col];

    this.selectedCell = null;

    this.spawnMatchEffect(containerA.x, containerA.y);
    this.spawnMatchEffect(containerB.x, containerB.y);

    // Draw the connecting line immediately so it feels responsive.
    const lineGraphics = this.add.graphics().setDepth(5);
    lineGraphics.lineStyle(Math.floor(this.tileSize * 0.25), this.theme.matchLine, 0.9);
    lineGraphics.beginPath();
    lineGraphics.moveTo(containerA.x, containerA.y);
    lineGraphics.lineTo(containerB.x, containerB.y);
    lineGraphics.strokePath();

    this.tweens.add({
      targets: lineGraphics,
      alpha: 0,
      duration: 500,
      ease: 'Sine.easeOut',
      onComplete: () => {
        lineGraphics.destroy();
      },
    });

    containerA.setVisible(false);
    containerB.setVisible(false);

    const valueA = this.grid[a.row][a.col];
    const valueB = this.grid[b.row][b.col];
    const { didClear } = applyMatch(this.grid, a, b);
    if (didClear) {
      containerA.setVisible(true);
      containerB.setVisible(true);

      if (valueA != null) this.ghostNumbers.set(`${a.row},${a.col}`, valueA);
      if (valueB != null) this.ghostNumbers.set(`${b.row},${b.col}`, valueB);

      this.playTone(660, 120);
      this.updateScore(10);
      this.animateCollapseIfNeeded();
    }
  }

  rebuildAfterChange() {
    this.buildGridDisplay();

    if (!hasAnyMoves(this.grid)) {
      this.showGameOver();
    }
  }

  animateCollapseIfNeeded() {
    const size = this.gridSize;

    // Identify rows that are fully empty after clearing.
    const emptyRows = [];
    for (let r = 0; r < size; r++) {
      if (this.grid[r].every((cell) => cell === null)) {
        emptyRows.push(r);
      }
    }

    if (emptyRows.length > 0) {
      this.updateScore(emptyRows.length * size * 10);
    }

    // No row collapse: just refill and redraw.
    if (emptyRows.length === 0) {
      collapseAndRefill(this.grid);
      this.rebuildAfterChange();
      return;
    }

    const oldContainers = this.tileContainers;
    const oldRows = this.grid.map((row) => row.slice());
    const oldGhostNumbers = new Map(this.ghostNumbers);

    // Apply the logical collapse/refill first so `this.grid` becomes the new grid.
    collapseAndRefill(this.grid);

    // Disable input during the slide animation.
    if (this.input) this.input.enabled = false;

    // Remap ghost numbers to their new row positions after the slide-up.
    // (Ghosts are keyed by row,col, so they must shift along with their tiles.)
    const nextGhostNumbers = new Map();
    for (const [key, value] of oldGhostNumbers.entries()) {
      const [rStr, cStr] = key.split(',');
      const r = Number(rStr);
      const c = Number(cStr);
      if (!Number.isFinite(r) || !Number.isFinite(c)) continue;

      // Rows that were fully empty are removed.
      if (emptyRows.includes(r)) continue;

      const shiftUp = emptyRows.filter((er) => er < r).length;
      const newR = r - shiftUp;
      nextGhostNumbers.set(`${newR},${c}`, value);
    }
    this.ghostNumbers = nextGhostNumbers;

    // Destroy containers that belonged to fully empty rows.
    for (const r of emptyRows) {
      if (!oldContainers[r]) continue;
      for (let c = 0; c < size; c++) {
        oldContainers[r][c]?.destroy(true);
      }
    }

    /** @type {Phaser.GameObjects.Container[][]} */
    const nextContainers = [];

    const tweens = [];

    // Move kept rows up to their new positions.
    for (let r = 0; r < size; r++) {
      const wasEmpty = oldRows[r].every((cell) => cell === null);
      if (wasEmpty) continue;

      const shiftUp = emptyRows.filter((er) => er < r).length;
      const newR = r - shiftUp;

      nextContainers[newR] = nextContainers[newR] || [];

      for (let c = 0; c < size; c++) {
        const container = oldContainers[r]?.[c];
        if (!container) continue;

        const { x, y } = this.getCellCenter(newR, c);
        container.setData({ ...container.data.values, row: newR, col: c });
        nextContainers[newR][c] = container;

        tweens.push(
          this.tweens.add({
            targets: container,
            x,
            y,
            duration: 220,
            ease: 'Sine.easeOut',
          })
        );
      }
    }

    // Create the new bottom rows and slide them in from below.
    const clearedCount = emptyRows.length;
    const firstNewRow = size - clearedCount;
    for (let r = firstNewRow; r < size; r++) {
      nextContainers[r] = nextContainers[r] || [];

      // Start these rows below the grid.
      const rowOffset = r - firstNewRow + 1;
      const startY =
        this.gridOriginY +
        (size - 1 + rowOffset) * this.tileSize +
        this.tileSize / 2;

      for (let c = 0; c < size; c++) {
        const container = this.createTileContainer(r, c, { y: startY });
        nextContainers[r][c] = container;

        const { x, y } = this.getCellCenter(r, c);
        tweens.push(
          this.tweens.add({
            targets: container,
            x,
            y,
            duration: 260,
            ease: 'Sine.easeOut',
          })
        );
      }
    }

    this.tileContainers = nextContainers;

    // Ensure visuals reflect the new grid during/after animation.
    this.refreshGridDisplay();

    // Wait for the longest tween to finish, then finalize state.
    this.time.delayedCall(280, () => {
      if (this.input) this.input.enabled = true;
      this.refreshGridDisplay();

      if (!hasAnyMoves(this.grid)) {
        this.showGameOver();
      }
    });
  }

  showGameOver() {
    const width = /** @type {number} */ (this.game.config.width);
    const height = /** @type {number} */ (this.game.config.height);

    const overlay = this.add.container(width / 2, height / 2).setDepth(20);

    const boxW = width * 0.75;
    const boxH = 220;

    const bg = this.add
      .rectangle(0, 0, boxW, boxH, 0xffffff)
      .setAlpha(0.97);

    const topBar = this.add
      .rectangle(0, -boxH / 2 + 3, boxW, 6, 0xf59e0b);
    const bottomBar = this.add
      .rectangle(0, boxH / 2 - 3, boxW, 6, 0xf59e0b);
    const leftBorder = this.add
      .rectangle(-boxW / 2 + 1, 0, 2, boxH, 0xf59e0b);
    const rightBorder = this.add
      .rectangle(boxW / 2 - 1, 0, 2, boxH, 0xf59e0b);

    const title = this.add
      .text(0, -55, 'Game Over', {
        fontFamily:
          '"DynaPuff", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        fontSize: '28px',
        color: '#1a1a2e',
      })
      .setOrigin(0.5);

    const summary = this.add
      .text(0, -10, `Final score: ${this.score}`, {
        fontFamily:
          '"DynaPuff", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        fontSize: '20px',
        color: '#4a4a6a',
      })
      .setOrigin(0.5);

    const buttonContainer = this.add.container(0, 55);
    const buttonWidth = 170;
    const buttonHeight = 44;

    const buttonBg = this.add
      .rectangle(0, 0, buttonWidth, buttonHeight, 0xf59e0b)
      .setAlpha(0.95);

    const buttonText = this.add
      .text(0, 0, 'Play Again', {
        fontFamily:
          '"DynaPuff", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        fontSize: '17px',
        color: '#ffffff',
      })
      .setOrigin(0.5);

    buttonBg.setInteractive({ useHandCursor: true });
    buttonBg.on('pointerdown', () => {
      this.resetGame();
    });

    buttonContainer.add([buttonBg, buttonText]);

    overlay.add([bg, topBar, bottomBar, leftBorder, rightBorder, title, summary, buttonContainer]);

    overlay.setScale(0.8);
    overlay.setAlpha(0);

    this.tweens.add({
      targets: overlay,
      scale: 1,
      alpha: 1,
      duration: 220,
      ease: 'Back.Out',
    });

    this.gameOverOverlay = overlay;
  }
}

