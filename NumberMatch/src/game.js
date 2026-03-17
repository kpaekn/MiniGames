import { GameScene } from './gameScene.js';

export function createGame(parentElement, options = {}) {
  const gridSize = options.gridSize || 9;

  const width = 600;
  const height = 700;

  const config = {
    type: Phaser.AUTO,
    width,
    height,
    backgroundColor: '#e8eaed',
    parent: parentElement,
    scene: [new GameScene({ gridSize })],
    physics: {
      default: 'arcade',
      arcade: {
        debug: false,
      },
    },
  };

  return new Phaser.Game(config);
}

