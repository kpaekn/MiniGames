import { GameScene } from './gameScene.js';

export function createGame(parentElement, options = {}) {
  const gridSize = options.gridSize || 9;
  const themeKey = options.themeKey || 'midnight';

  const width = 600;
  const height = 700;

  const config = {
    type: Phaser.AUTO,
    width,
    height,
    backgroundColor: '#020617',
    parent: parentElement,
    scene: [new GameScene({ gridSize, themeKey })],
    physics: {
      default: 'arcade',
      arcade: {
        debug: false,
      },
    },
  };

  return new Phaser.Game(config);
}

