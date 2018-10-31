import Expo from "expo";
import React from "react";
import * as THREE from "three";

export default class Group extends THREE.Group {
  constructor({ ...props }) {
    super(props);
  }

  removeAll = () => {
    while (this.children.length) {
      this.remove(this.children[0]);
    }
  };

  forEachAlive = (callback, callbackContext, args) => {
    this.traverse(function(node) {
      if (node.alive) {
        callback(node);
      }
    });
  };
}
