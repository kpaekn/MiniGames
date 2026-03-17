import { createGrid, canMatch, applyMatch, collapseAndRefill, hasAnyMoves } from './gridLogic.js';

const THEMES = {
  midnight: {
    label: 'Midnight',
    bg: '#020617',
    hudPrimary: '#e5e7eb',
    hudSecondary: '#9ca3af',
    tileFilled: 0x111827,
    tileEmpty: 0x020617,
    tileStroke: 0x374151,
    tileSelectedStroke: 0x60a5fa,
    overlayBg: 0x020617,
    overlayStroke: 0x4b5563,
    buttonBg: 0x111827,
    buttonStroke: 0x4b5563,
    text: '#e5e7eb',
    ghostText: '#6b7280',
    matchLine: 0x60a5fa,
  },
  ocean: {
    label: 'Ocean',
    bg: '#061826',
    hudPrimary: '#e6f6ff',
    hudSecondary: '#9bd0e3',
    tileFilled: 0x0b2a3a,
    tileEmpty: 0x061826,
    tileStroke: 0x1b4f63,
    tileSelectedStroke: 0x22d3ee,
    overlayBg: 0x061826,
    overlayStroke: 0x1b4f63,
    buttonBg: 0x0b2a3a,
    buttonStroke: 0x1b4f63,
    text: '#e6f6ff',
    ghostText: '#5ea6bf',
    matchLine: 0x22d3ee,
  },
  sunset: {
    label: 'Sunset',
    bg: '#1b1020',
    hudPrimary: '#ffe7f5',
    hudSecondary: '#f3a6c8',
    tileFilled: 0x2a1530,
    tileEmpty: 0x1b1020,
    tileStroke: 0x6b2a4f,
    tileSelectedStroke: 0xfb7185,
    overlayBg: 0x1b1020,
    overlayStroke: 0x6b2a4f,
    buttonBg: 0x2a1530,
    buttonStroke: 0x6b2a4f,
    text: '#ffe7f5',
    ghostText: '#b57497',
    matchLine: 0xfb7185,
  },
  mint: {
    label: 'Mint',
    bg: '#061a14',
    hudPrimary: '#eafff7',
    hudSecondary: '#86efac',
    tileFilled: 0x0a2a21,
    tileEmpty: 0x061a14,
    tileStroke: 0x145a45,
    tileSelectedStroke: 0x34d399,
    overlayBg: 0x061a14,
    overlayStroke: 0x145a45,
    buttonBg: 0x0a2a21,
    buttonStroke: 0x145a45,
    text: '#eafff7',
    ghostText: '#5aa38a',
    matchLine: 0x34d399,
  },
  cottonCandy: {
    label: 'Cotton Candy',
    bg: '#170a24',
    hudPrimary: '#fff1fb',
    hudSecondary: '#f9a8d4',
    tileFilled: 0x3b1456,
    tileEmpty: 0x170a24,
    tileStroke: 0xd946ef,
    tileSelectedStroke: 0x7dd3fc,
    overlayBg: 0x170a24,
    overlayStroke: 0xd946ef,
    buttonBg: 0x3b1456,
    buttonStroke: 0xd946ef,
    text: '#fff1fb',
    ghostText: '#fbcfe8',
    matchLine: 0xf472b6,
  },
  bubbleGum: {
    label: 'Bubble Gum',
    bg: '#13061a',
    hudPrimary: '#ffe4f2',
    hudSecondary: '#fda4af',
    tileFilled: 0x2a0a3a,
    tileEmpty: 0x13061a,
    tileStroke: 0xff5ac8,
    tileSelectedStroke: 0xa78bfa,
    overlayBg: 0x13061a,
    overlayStroke: 0xff5ac8,
    buttonBg: 0x2a0a3a,
    buttonStroke: 0xff5ac8,
    text: '#ffe4f2',
    ghostText: '#f9a8d4',
    matchLine: 0xff5ac8,
  },
};

/**
 * Main Phaser scene for Number Match.
 */
export class GameScene extends Phaser.Scene {
  /**
   * @param {{ gridSize: number, themeKey?: string }} config
   */
  constructor(config = { gridSize: 9 }) {
    super('GameScene');
    this.gridSize = config.gridSize || 9;
    this.themeKey = config.themeKey || 'midnight';
    this.theme = THEMES[this.themeKey] || THEMES.midnight;

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
    /** @type {Phaser.GameObjects.Text | null} */
    this.scoreText = null;

    /** @type {Phaser.GameObjects.Text | null} */
    this.instructionsText = null;

    /** @type {Map<string, number>} */
    this.ghostNumbers = new Map();

    /** @type {Phaser.GameObjects.Container | null} */
    this.gameOverOverlay = null;
  }

  create() {
    this.applyTheme(this.themeKey);
    const width = /** @type {number} */ (this.game.config.width);
    const height = /** @type {number} */ (this.game.config.height);

    const verticalPadding = 120;
    const availableHeight = height - verticalPadding - 40;
    const availableWidth = width - 40;
    this.tileSize = Math.floor(
      Math.min(availableWidth, availableHeight) / this.gridSize
    );

    this.gridOriginX = (width - this.tileSize * this.gridSize) / 2;
    this.gridOriginY = verticalPadding;

    this.addHud();

    this.grid = createGrid(this.gridSize);
    this.buildGridDisplay();
  }

  applyTheme(themeKey) {
    this.themeKey = themeKey;
    this.theme = THEMES[this.themeKey] || THEMES.midnight;

    this.cameras.main.setBackgroundColor(this.theme.bg);

    if (this.scoreText) this.scoreText.setColor(this.theme.hudPrimary);
    if (this.instructionsText) this.instructionsText.setColor(this.theme.hudSecondary);

    // Repaint existing tiles/ghost text with the new palette
    if (this.tileContainers && this.tileContainers.length > 0) {
      this.refreshGridDisplay();
    }
  }

  addHud() {
    const style = {
      fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      fontSize: '20px',
      color: this.theme.hudPrimary,
    };

    this.scoreText = this.add
      .text(20, 20, 'Score: 0', style)
      .setDepth(10);

    const instructionsStyle = {
      fontFamily:
        'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      fontSize: '14px',
      color: this.theme.hudSecondary,
      wordWrap: { width: /** @type {number} */ (this.game.config.width) - 40 },
    };

    this.instructionsText = this.add
      .text(
        20,
        72,
        'Select two numbers in a line: same value or sum to 10. Empty cells between are allowed.',
        instructionsStyle
      )
      .setDepth(10);
  }

  updateScore(delta) {
    this.score += delta;
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
  findAnyMatch() {
    const size = this.gridSize;
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
              return { a, b };
            }
          }
        }
      }
    }
    return null;
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

    const rectA = containerA.data.values.rect;
    const rectB = containerB.data.values.rect;

    const baseStroke = this.theme.tileStroke;
    const hintStroke = this.theme.tileSelectedStroke;

    const pulse = (rect) => {
      rect.setStrokeStyle(4, hintStroke);
      this.tweens.add({
        targets: rect,
        alpha: 0.55,
        duration: 200,
        yoyo: true,
        repeat: 1,
        ease: 'Sine.easeInOut',
        onComplete: () => {
          rect.setAlpha(1);
          rect.setStrokeStyle(2, baseStroke);
          this.refreshGridDisplay();
        },
      });
    };

    pulse(rectA);
    pulse(rectB);
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
        this.tileSize - 4,
        this.tileSize - 4,
        this.theme.tileFilled
      )
      .setStrokeStyle(1, this.theme.tileStroke);

    const value = this.grid[row][col];
    const text = this.add
      .text(0, 0, value != null ? String(value) : '', {
        fontFamily:
          'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        fontSize: `${Math.floor(this.tileSize * 0.45)}px`,
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
        rect.setStrokeStyle(2, isSelected ? this.theme.tileSelectedStroke : this.theme.tileStroke);
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
        ease: 'Sine.easeInOut',
      });
      this.playTone(220, 120);
      this.clearSelection();
      return;
    }

    const containerA = this.tileContainers[a.row][a.col];
    const containerB = this.tileContainers[b.row][b.col];

    // Draw the connecting line immediately so it feels responsive.
    const lineGraphics = this.add.graphics().setDepth(5);
    lineGraphics.lineStyle(3, this.theme.matchLine, 0.9);
    lineGraphics.beginPath();
    lineGraphics.moveTo(containerA.x, containerA.y);
    lineGraphics.lineTo(containerB.x, containerB.y);
    lineGraphics.strokePath();

    this.tweens.add({
      targets: lineGraphics,
      alpha: 0,
      duration: 320,
      delay: 40,
      ease: 'Sine.easeOut',
      onComplete: () => {
        lineGraphics.destroy();
      },
    });

    this.tweens.add({
      targets: [containerA, containerB],
      scale: 0.7,
      alpha: 0.2,
      duration: 160,
      ease: 'Sine.easeIn',
      onComplete: () => {
        const valueA = this.grid[a.row][a.col];
        const valueB = this.grid[b.row][b.col];
        const { didClear } = applyMatch(this.grid, a, b);
        if (didClear) {
          // These containers are reused for slide animations; reset visual state
          // so the "ghost" number doesn't inherit the match fade-out alpha.
          containerA.setAlpha(1);
          containerB.setAlpha(1);
          containerA.setScale(1);
          containerB.setScale(1);

          if (valueA != null) this.ghostNumbers.set(`${a.row},${a.col}`, valueA);
          if (valueB != null) this.ghostNumbers.set(`${b.row},${b.col}`, valueB);

          this.playTone(660, 120);
          this.updateScore(10);
          this.animateCollapseIfNeeded();
        }
      },
    });

    this.selectedCell = null;
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
            ease: 'Sine.easeInOut',
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
            ease: 'Sine.easeInOut',
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

    const bg = this.add
      .rectangle(0, 0, width * 0.7, 160, this.theme.overlayBg)
      .setStrokeStyle(2, this.theme.overlayStroke)
      .setAlpha(0.96);

    const title = this.add
      .text(0, -40, 'Game Over', {
        fontFamily:
          'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        fontSize: '26px',
        color: this.theme.text,
      })
      .setOrigin(0.5);

    const summary = this.add
      .text(0, 0, `Final score: ${this.score}`, {
        fontFamily:
          'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        fontSize: '18px',
        color: this.theme.text,
      })
      .setOrigin(0.5);

    const buttonContainer = this.add.container(0, 52);
    const buttonWidth = 160;
    const buttonHeight = 40;

    const buttonBg = this.add
      .rectangle(0, 0, buttonWidth, buttonHeight, this.theme.buttonBg)
      .setStrokeStyle(1, this.theme.buttonStroke);

    const buttonText = this.add
      .text(0, 0, 'Restart', {
        fontFamily:
          'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        fontSize: '16px',
        color: this.theme.text,
      })
      .setOrigin(0.5);

    buttonContainer.add([buttonBg, buttonText]);
    buttonContainer.setSize(buttonWidth, buttonHeight);
    buttonContainer.setInteractive(
      new Phaser.Geom.Rectangle(
        -buttonWidth / 2,
        -buttonHeight / 2,
        buttonWidth,
        buttonHeight
      ),
      Phaser.Geom.Rectangle.Contains
    );

    buttonContainer.on('pointerdown', () => {
      this.resetGame();
    });

    overlay.add([bg, title, summary, buttonContainer]);

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

