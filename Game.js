import React from "react";
import { StyleSheet, View } from "react-native";
import Files from "./Files";
// import * as THREE from "three";
import { THREE } from "expo-three";
import Expo from "expo";
import { Group, Node, Sprite, SpriteView } from "./GameKit";

const SPEED = 1.6;
const GRAVITY = 1100;
const FLAP = 320;
const SPAWN_RATE = 2600;
const OPENING = 120;
const GROUND_HEIGHT = 64;

export default class Game extends React.Component {
  componentWillMount() {
    THREE.suppressExpoWarnings(true);
  }

  pipes = new Group();
  deadPipeTops = [];
  deadPipeBottoms = [];
  gameStarted = false;
  gameOver = false;
  velocity = 0;

  setupPipe = async ({ key, y }) => {
    const size = {
      width: 52,
      height: 320
    };

    // 1
    const tbs = {
      top: Files.sprites.pipe_top,
      bottom: Files.sprites.pipe_bottom
    };

    const pipe = await this.setupStaticNode({
      image: tbs[key],
      size,
      name: key
    });

    // 2
    // NOT In SNACK
    pipe.size = size;

    pipe.y = y;

    return pipe;
  };

  spawnPipe = async (openPos, flipped) => {
    // 1
    let pipeY;
    if (flipped) {
      pipeY = Math.floor(openPos - OPENING / 2 - 320);
    } else {
      pipeY = Math.floor(openPos + OPENING / 2);
    }

    // 2
    let pipeKey = flipped ? "bottom" : "top";
    let pipe;

    // 3
    const end = this.scene.bounds.right + 26;

    // 4
    if (this.deadPipeTops.length > 0 && pipeKey === "top") {
      pipe = this.deadPipeTops.pop().revive();
      pipe.reset(end, pipeY);
    } else if (this.deadPipeBottoms.length > 0 && pipeKey === "bottom") {
      pipe = this.deadPipeBottoms.pop().revive();
      pipe.reset(end, pipeY);
    } else {
      // 5
      pipe = await this.setupPipe({
        // From SNACK
        // scene: this.scene,
        y: pipeY,
        key: pipeKey
      });
      pipe.x = end;
      this.pipes.add(pipe);
    }
    // Set the pipes velocity so it knows how fast to go
    pipe.velocity = -SPEED;
    return pipe;
  };

  spawnPipes = () => {
    this.pipes.forEachAlive(pipe => {
      // 1
      if (pipe.size && pipe.x + pipe.size.width < this.scene.bounds.left) {
        if (pipe.name === "top") {
          this.deadPipeTops.push(pipe.kill());
        }
        if (pipe.name === "bottom") {
          this.deadPipeBottoms.push(pipe.kill());
        }
      }

      // 2
      const pipeY =
        this.scene.size.height / 2 +
        (Math.random() - 0.5) * this.scene.size.height * 0.2;

      // 3
      this.spawnPipe(pipeY);
      this.spawnPipe(pipeY, true);
    });
  };

  onSetup = async ({ scene }) => {
    // Give us global reference to the scene
    this.scene = scene;
    this.scene.add(this.pipes);
    await this.setupBackground();
    // 1
    await this.setupGround();
    await this.setupPlayer();
  };

  setupGround = async () => {
    const { scene } = this;
    const size = {
      width: scene.size.width,
      height: scene.size.width * 0.333333333
    };

    this.groundNode = new Group();

    // 2
    const node = await this.setupStaticNode({
      image: Files.sprites.ground,
      size,
      name: "ground"
    });

    const nodeB = await this.setupStaticNode({
      image: Files.sprites.ground,
      size,
      name: "ground"
    });
    nodeB.x = size.width;

    this.groundNode.add(node);
    this.groundNode.add(nodeB);

    // 3
    this.groundNode.position.y =
      (scene.size.height + (size.height - GROUND_HEIGHT)) * -0.5;

    // 4
    this.groundNode.top = this.groundNode.position.y + size.height / 2;

    this.groundNode.position.z = 0.01;
    scene.add(this.groundNode);
  };

  setupBackground = async () => {
    // 1
    const { scene } = this;
    const { size } = scene;
    // 2
    const bg = await this.setupStaticNode({
      image: Files.sprites.bg,
      size,
      name: "bg"
    });
    // 3
    scene.add(bg);
  };

  setupPlayer = async () => {
    // 1
    const size = {
      width: 36,
      height: 26
    };

    // 2
    const sprite = new Sprite();
    await sprite.setup({
      image: Files.sprites.bird,
      tilesHoriz: 3,
      tilesVert: 1,
      numTiles: 3,
      tileDispDuration: 75,
      size
    });

    // 3
    this.player = new Node({
      sprite
    });
    this.scene.add(this.player);
  };

  setupStaticNode = async ({ image, size, name }) => {
    // 1
    const sprite = new Sprite();

    await sprite.setup({
      image,
      size
    });

    // 2
    const node = new Node({
      sprite
    });
    node.name = name;

    return node;
  };

  addScore = () => {};

  updateGame = delta => {
    if (this.gameStarted) {
      // 1
      this.velocity -= GRAVITY * delta;
      if (!this.gameOver) {
        // 1
        this.pipes.forEachAlive(pipe => {
          pipe.x += pipe.velocity;

          // 2
          if (
            pipe.name === "bottom" &&
            !pipe.passed &&
            pipe.x < this.player.x
          ) {
            pipe.passed = true;
            this.addScore();
          }
        });
      }
      // 2
      this.player.angle = Math.min(
        Math.PI / 4,
        Math.max(-Math.PI / 2, (FLAP + this.velocity) / FLAP)
      );
      // 3
      this.player.update(delta);
      // 4
      this.player.y += this.velocity * delta;
    } else {
      this.player.update(delta);
      this.player.y = 8 * Math.cos(Date.now() / 200);
      this.player.angle = 0;
    }
  };

  reset = () => {};

  tap = () => {
    // 1
    if (!this.gameStarted) {
      this.gameStarted = true;
      // 2
      this.pillarInterval = setInterval(this.spawnPipes, SPAWN_RATE);
    }

    if (!this.gameOver) {
      // 1
      this.velocity = FLAP;
    } else {
      // 2
      this.reset();
    }
  };

  render() {
    //@(Evan Bacon) This is a dope SpriteView based on SpriteKit that surfaces touches, render, and setup!
    return (
      <View style={StyleSheet.absoluteFill}>
        <SpriteView
          touchDown={() => this.tap()}
          touchMoved={() => {}}
          touchUp={() => {}}
          update={this.updateGame}
          onSetup={this.onSetup}
        />
      </View>
    );
  }
}
