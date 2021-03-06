import React from "react";
import { StyleSheet, Text, View } from "react-native";
import Files from "./Files";
import Expo from "expo";
import { Group, Node, Sprite, SpriteView } from "./GameKit";
import { THREE } from "expo-three";
import "expo-asset-utils";
import "three";
import "react-native-console-time-polyfill";
import "text-encoding";
import "xmldom-qsa";

const SPEED = 1.6;
const GRAVITY = 1100;
const FLAP = 320;
const SPAWN_RATE = 2600;
const OPENING = 120;
const GROUND_HEIGHT = 64;

export default class Game extends React.Component {
  state = {
    score: 0
  };

  pipes = new Group();
  deadPipeTops = [];
  deadPipeBottoms = [];

  gameStarted = false;
  gameOver = false;
  velocity = 0;

  componentWillMount() {
    console.log(this.state.score);
    THREE.suppressExpoWarnings(true);
  }

  setupPlayer = async () => {
    const size = {
      width: 36,
      height: 26
    };

    const sprite = new Sprite();
    await sprite.setup({
      image: Files.sprites.bird,
      tilesHoriz: 3,
      tilesVert: 1,
      numTiles: 3,
      tileDispDuration: 75,
      size
    });

    this.player = new Node({
      sprite
    });
    this.scene.add(this.player);
  };

  setupGround = async () => {
    const { scene } = this;
    const size = {
      width: scene.size.width,
      height: scene.size.width * 0.333333333
    };

    this.groundNode = new Group();

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

    this.groundNode.position.y =
      (scene.size.height + (size.height - GROUND_HEIGHT)) * -0.5;

    this.groundNode.top = this.groundNode.position.y + size.height / 2;

    this.groundNode.position.z = 0.01;
    scene.add(this.groundNode);
  };

  setupPipe = async ({ key, y }) => {
    const size = {
      width: 52,
      height: 320
    };

    const tbs = {
      top: Files.sprites.pipe_top,
      bottom: Files.sprites.pipe_bottom
    };

    const pipe = await this.setupStaticNode({
      image: tbs[key],
      size,
      name: key
    });
    pipe.y = y;

    return pipe;
  };

  setupStaticNode = async ({ image, size, name }) => {
    const sprite = new Sprite();

    await sprite.setup({
      image,
      size
    });

    const node = new Node({
      sprite
    });
    node.name = name;
    return node;
  };

  spawnPipe = async (openPos, flipped) => {
    let pipeY;
    if (flipped) {
      pipeY = Math.floor(openPos - OPENING / 2 - 320);
    } else {
      pipeY = Math.floor(openPos + OPENING / 2);
    }
    let pipeKey = flipped ? "bottom" : "top";
    let pipe;

    const end = this.scene.bounds.right + 26;
    if (this.deadPipeTops.length > 0 && pipeKey === "top") {
      pipe = this.deadPipeTops.pop().revive();
      pipe.reset(end, pipeY);
    } else if (this.deadPipeBottoms.length > 0 && pipeKey === "bottom") {
      pipe = this.deadPipeBottoms.pop().revive();
      pipe.reset(end, pipeY);
    } else {
      pipe = await this.setupPipe({
        scene: this.scene,
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
    });
    // Get a random spot for the center of the two pipes
    const pipeY =
      this.scene.size.height / 2 +
      (Math.random() - 0.5) * this.scene.size.height * 0.2;

    // 3
    this.spawnPipe(pipeY);
    this.spawnPipe(pipeY, true);
  };

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

  addScore = () => {
    this.setState({ score: this.state.score + 1 });
  };

  setGameOver = () => {
    this.gameOver = true;
    clearInterval(this.pillarInterval);
  };

  reset = () => {
    this.gameStarted = false;
    this.gameOver = false;
    this.setState({ score: 0 });

    this.player.reset(this.scene.size.width * -0.3, 0);
    this.player.angle = 0;
    this.pipes.removeAll();
  };

  onSetup = async ({ scene }) => {
    // Give us global reference to the scene
    this.scene = scene;
    this.scene.add(this.pipes);
    await this.setupBackground();
    await this.setupGround();
    await this.setupPlayer();

    this.reset();
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

  updateGame = delta => {
    if (this.gameStarted) {
      this.velocity -= GRAVITY * delta;
      const target = this.groundNode.top;

      if (!this.gameOver) {
        const playerBox = new THREE.Box3().setFromObject(this.player);

        this.pipes.forEachAlive(pipe => {
          pipe.x += pipe.velocity;
          const pipeBox = new THREE.Box3().setFromObject(pipe);

          if (pipeBox.intersectsBox(playerBox)) {
            this.setGameOver();
          }

          if (
            pipe.name === "bottom" &&
            !pipe.passed &&
            pipe.x < this.player.x
          ) {
            pipe.passed = true;
            this.addScore();
          }
        });

        this.player.angle = Math.min(
          Math.PI / 4,
          Math.max(-Math.PI / 2, (FLAP + this.velocity) / FLAP)
        );

        if (this.player.y <= target) {
          this.setGameOver();
        }

        this.player.update(delta);
      }

      // if the game is over then let the player continue to fall until they hit the floor
      if (this.player.y <= target) {
        this.player.angle = -Math.PI / 2;
        this.player.y = target;
        this.velocity = 0;
      } else {
        this.player.y += this.velocity * delta;
      }
    } else {
      this.player.update(delta);
      this.player.y = 8 * Math.cos(Date.now() / 200);
      this.player.angle = 0;
    }

    // 1
    if (!this.gameOver) {
      this.groundNode.children.map((node, index) => {
        // 2
        node.x -= SPEED;
        // 3
        if (node.x < this.scene.size.width * -1) {
          let nextIndex = index + 1;
          if (nextIndex === this.groundNode.children.length) {
            nextIndex = 0;
          }
          const nextNode = this.groundNode.children[nextIndex];
          // 4
          node.x = nextNode.x + this.scene.size.width - 1.55;
        }
      });
    }
  };

  renderScore = () => (
    <Text
      style={{
        textAlign: "center",
        fontSize: 64,
        position: "absolute",
        left: 0,
        right: 0,
        color: "white",
        top: 64,
        backgroundColor: "transparent"
      }}
    >
      {this.state.score}
    </Text>
  );

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
        {this.renderScore()}
      </View>
    );
  }
}
