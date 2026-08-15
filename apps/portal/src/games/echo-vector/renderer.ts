import {
  ECHO_ARENA_HEIGHT,
  ECHO_ARENA_WIDTH,
  ECHO_TOTAL_CYCLES,
  getBeatPulse,
  getNodeCue,
  sampleEchoActor,
  type ActorSample,
  type EchoSimulation,
} from "./rules.ts";

const PIXI_URL = "https://cdn.jsdelivr.net/npm/pixi.js@8.18.1/dist/pixi.min.mjs";

const BLACK = 0x050607;
const OBSIDIAN = 0x0a0c0d;
const GRAPHITE = 0x141719;
const GRAPHITE_LIGHT = 0x23282a;
const IVORY = 0xe9e3d8;
const IVORY_DIM = 0xbcb6aa;
const ECHO_BLUE = 0x93aeb8;
const READY_BLUE = 0xc3dce2;
const TARGET_BLUE = 0x7898a2;
const DANGER_COPPER = 0xb06b52;

export type EchoRenderer = {
  render: (state: EchoSimulation) => void;
  destroy: () => void;
};

type PixiModule = {
  Application: new () => any;
  Container: new () => any;
  Graphics: new () => any;
};

type ActorVisual = {
  root: any;
  shard: any;
  phaseRing: any;
  core?: any;
};

type NodeVisual = {
  root: any;
  shadow: any;
  base: any;
  iris: any;
  core: any;
  targetRing: any;
  readyRing: any;
  wakeMark: any;
  activationRing: any;
};

function strokeRect(
  graphics: any,
  x: number,
  y: number,
  width: number,
  height: number,
  color: number,
  alpha: number,
  lineWidth: number,
) {
  graphics.rect(x, y, width, height).stroke({ color, alpha, width: lineWidth });
}

function regularPolygon(cx: number, cy: number, radius: number, sides: number, rotation = 0): number[] {
  const points: number[] = [];
  for (let index = 0; index < sides; index += 1) {
    const angle = rotation + (Math.PI * 2 * index) / sides;
    points.push(cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius);
  }
  return points;
}

function createShardGraphic(pixi: PixiModule, color: number, echo: boolean): any {
  const graphic = new pixi.Graphics();
  const shadow = [2, -20, 17, 4, 7, 17, -5, 11, -19, 8, -8, -4];
  const body = [0, -20, 16, 4, 6, 16, -5, 10, -19, 7, -8, -5];

  if (!echo) graphic.poly(shadow.map((value, index) => value + (index % 2 === 0 ? 3 : 4))).fill({ color: 0x000000, alpha: 0.5 });
  graphic.poly(body).fill({ color, alpha: echo ? 0.72 : 1 });
  graphic.poly(body).stroke({ color: echo ? READY_BLUE : 0xffffff, alpha: echo ? 0.42 : 0.72, width: echo ? 0.9 : 1.2 });

  if (!echo) {
    graphic
      .moveTo(-7, -5)
      .lineTo(0, -17)
      .lineTo(6, 2)
      .stroke({ color: 0xffffff, alpha: 0.28, width: 1 });
    graphic
      .moveTo(-8, 6)
      .lineTo(5, 12)
      .stroke({ color: 0x777d7d, alpha: 0.4, width: 1 });
  }
  return graphic;
}

function createActorVisual(pixi: PixiModule, color: number, withCore: boolean, echo = false): ActorVisual {
  const root = new pixi.Container();
  const phaseRing = new pixi.Graphics();
  phaseRing.circle(0, 0, 30).stroke({ color: READY_BLUE, alpha: 0.88, width: 1.4 });
  phaseRing.circle(0, 0, 35).stroke({ color: READY_BLUE, alpha: 0.2, width: 1 });
  phaseRing.visible = false;

  const shard = createShardGraphic(pixi, color, echo);
  root.addChild(phaseRing, shard);

  let core: any | undefined;
  if (withCore) {
    core = new pixi.Graphics();
    core.circle(-1, 1, 6).fill({ color: 0x0c1113, alpha: 1 });
    core.circle(-1, 1, 4).fill({ color: READY_BLUE, alpha: 0.84 });
    core.circle(-2, 0, 1.5).fill({ color: 0xffffff, alpha: 0.7 });
    root.addChild(core);
  }

  return { root, shard, phaseRing, ...(core ? { core } : {}) };
}

function createNodeVisual(pixi: PixiModule): NodeVisual {
  const root = new pixi.Container();

  const shadow = new pixi.Graphics();
  shadow.circle(3, 5, 38).fill({ color: 0x000000, alpha: 0.52 });
  shadow.poly(regularPolygon(3, 5, 44, 8, Math.PI / 8)).fill({ color: 0x000000, alpha: 0.28 });

  const base = new pixi.Graphics();
  base.poly(regularPolygon(0, 0, 43, 8, Math.PI / 8)).fill({ color: GRAPHITE, alpha: 0.98 });
  base.poly(regularPolygon(0, 0, 43, 8, Math.PI / 8)).stroke({ color: IVORY_DIM, alpha: 0.34, width: 1 });
  base.circle(0, 0, 34).fill({ color: OBSIDIAN, alpha: 1 });
  base.circle(0, 0, 34).stroke({ color: IVORY_DIM, alpha: 0.34, width: 1.1 });
  base.circle(0, 0, 28).stroke({ color: 0x697174, alpha: 0.4, width: 1 });
  for (let spoke = 0; spoke < 8; spoke += 1) {
    const angle = (Math.PI * 2 * spoke) / 8;
    base
      .moveTo(Math.cos(angle) * 35, Math.sin(angle) * 35)
      .lineTo(Math.cos(angle) * 40, Math.sin(angle) * 40)
      .stroke({ color: IVORY, alpha: 0.28, width: 1.2 });
  }

  const iris = new pixi.Graphics();
  for (let blade = 0; blade < 6; blade += 1) {
    const a0 = (Math.PI * 2 * blade) / 6 - 0.17;
    const a1 = a0 + 0.62;
    const bladePoints = [
      Math.cos(a0) * 9,
      Math.sin(a0) * 9,
      Math.cos(a0 + 0.18) * 24,
      Math.sin(a0 + 0.18) * 24,
      Math.cos(a1) * 20,
      Math.sin(a1) * 20,
      Math.cos(a1 - 0.16) * 9,
      Math.sin(a1 - 0.16) * 9,
    ];
    iris.poly(bladePoints).fill({ color: IVORY_DIM, alpha: 0.16 });
    iris.poly(bladePoints).stroke({ color: IVORY, alpha: 0.3, width: 0.8 });
  }

  const core = new pixi.Graphics();
  core.circle(0, 0, 10).fill({ color: 0x101416, alpha: 1 });
  core.circle(0, 0, 6).fill({ color: 0x656d6f, alpha: 0.45 });
  core.circle(-1, -1, 2).fill({ color: IVORY, alpha: 0.18 });

  const targetRing = new pixi.Graphics();
  targetRing.circle(0, 0, 49).stroke({ color: TARGET_BLUE, alpha: 0.9, width: 1.6 });
  for (let mark = 0; mark < 4; mark += 1) {
    const angle = (Math.PI * 2 * mark) / 4;
    targetRing
      .moveTo(Math.cos(angle) * 47, Math.sin(angle) * 47)
      .lineTo(Math.cos(angle) * 56, Math.sin(angle) * 56)
      .stroke({ color: READY_BLUE, alpha: 0.75, width: 1.2 });
  }
  targetRing.visible = false;

  const readyRing = new pixi.Graphics();
  readyRing.circle(0, 0, 55).stroke({ color: READY_BLUE, alpha: 0.96, width: 2 });
  readyRing.circle(0, 0, 61).stroke({ color: READY_BLUE, alpha: 0.28, width: 1 });
  readyRing.visible = false;

  const wakeMark = new pixi.Graphics();
  wakeMark
    .moveTo(-12, -51)
    .lineTo(0, -58)
    .lineTo(12, -51)
    .stroke({ color: READY_BLUE, alpha: 0.95, width: 1.4 });
  wakeMark.visible = false;

  const activationRing = new pixi.Graphics();
  activationRing.circle(0, 0, 66).stroke({ color: IVORY, alpha: 0.9, width: 1.2 });
  activationRing.alpha = 0;

  root.addChild(shadow, base, iris, core, targetRing, readyRing, wakeMark, activationRing);
  return { root, shadow, base, iris, core, targetRing, readyRing, wakeMark, activationRing };
}

function drawChamber(pixi: PixiModule): any {
  const chamber = new pixi.Graphics();
  chamber.rect(0, 0, ECHO_ARENA_WIDTH, ECHO_ARENA_HEIGHT).fill({ color: BLACK, alpha: 1 });

  chamber.rect(18, 18, ECHO_ARENA_WIDTH - 36, ECHO_ARENA_HEIGHT - 36).fill({ color: 0x080a0b, alpha: 1 });
  strokeRect(chamber, 18, 18, ECHO_ARENA_WIDTH - 36, ECHO_ARENA_HEIGHT - 36, IVORY, 0.34, 1.2);
  strokeRect(chamber, 28, 28, ECHO_ARENA_WIDTH - 56, ECHO_ARENA_HEIGHT - 56, 0x6f7474, 0.25, 1);

  const centerX = ECHO_ARENA_WIDTH / 2;
  const centerY = ECHO_ARENA_HEIGHT / 2;

  const octagonOuter = regularPolygon(centerX, centerY, 242, 8, Math.PI / 8);
  const octagonInner = regularPolygon(centerX, centerY, 128, 8, Math.PI / 8);
  chamber.poly(octagonOuter).fill({ color: 0x0c0f10, alpha: 1 });
  chamber.poly(octagonOuter).stroke({ color: IVORY_DIM, alpha: 0.18, width: 1.1 });
  chamber.poly(octagonInner).fill({ color: 0x090b0c, alpha: 1 });
  chamber.poly(octagonInner).stroke({ color: IVORY_DIM, alpha: 0.28, width: 1.1 });

  chamber.circle(centerX, centerY, 105).stroke({ color: 0x7e888a, alpha: 0.2, width: 1 });
  chamber.circle(centerX, centerY, 164).stroke({ color: 0x7e888a, alpha: 0.12, width: 1 });
  chamber.circle(centerX, centerY, 232).stroke({ color: IVORY_DIM, alpha: 0.13, width: 1 });

  const nodePoints = [
    [170, 150],
    [365, 112],
    [630, 112],
    [830, 150],
    [865, 388],
    [665, 500],
    [335, 500],
    [135, 388],
  ] as const;

  for (let index = 0; index < nodePoints.length; index += 1) {
    const point = nodePoints[index];
    if (!point) continue;
    const [x, y] = point;
    const dx = x - centerX;
    const dy = y - centerY;
    const length = Math.max(1, Math.hypot(dx, dy));
    const nx = dx / length;
    const ny = dy / length;
    const px = -ny;
    const py = nx;

    const startX = centerX + nx * 132;
    const startY = centerY + ny * 132;
    const endX = x - nx * 49;
    const endY = y - ny * 49;

    chamber
      .moveTo(startX + px * 7, startY + py * 7)
      .lineTo(endX + px * 7, endY + py * 7)
      .stroke({ color: 0x60686a, alpha: 0.16, width: 1 });
    chamber
      .moveTo(startX - px * 7, startY - py * 7)
      .lineTo(endX - px * 7, endY - py * 7)
      .stroke({ color: 0x60686a, alpha: 0.16, width: 1 });
    chamber
      .moveTo(startX, startY)
      .lineTo(endX, endY)
      .stroke({ color: IVORY_DIM, alpha: 0.08, width: 1 });

    const plinth = regularPolygon(x, y, 56, 8, Math.PI / 8);
    chamber.poly(plinth).fill({ color: 0x0c0e0f, alpha: 0.72 });
    chamber.poly(plinth).stroke({ color: 0x5d6465, alpha: 0.14, width: 1 });
  }

  for (let segment = 0; segment < 24; segment += 1) {
    const a0 = -Math.PI / 2 + (Math.PI * 2 * segment) / 24 + 0.02;
    const a1 = -Math.PI / 2 + (Math.PI * 2 * (segment + 1)) / 24 - 0.02;
    const strong = segment % 4 === 0;
    chamber.arc(centerX, centerY, 118, a0, a1).stroke({ color: strong ? IVORY : 0x71797b, alpha: strong ? 0.28 : 0.12, width: strong ? 1.4 : 1 });
  }

  chamber.poly(regularPolygon(centerX, centerY, 44, 6, Math.PI / 6)).fill({ color: 0x0d1011, alpha: 1 });
  chamber.poly(regularPolygon(centerX, centerY, 44, 6, Math.PI / 6)).stroke({ color: IVORY_DIM, alpha: 0.2, width: 1 });

  for (let tick = 0; tick < 8; tick += 1) {
    const angle = (Math.PI * 2 * tick) / 8;
    chamber
      .moveTo(centerX + Math.cos(angle) * 111, centerY + Math.sin(angle) * 111)
      .lineTo(centerX + Math.cos(angle) * 121, centerY + Math.sin(angle) * 121)
      .stroke({ color: IVORY, alpha: 0.26, width: 1 });
  }

  const cornerMarks = [
    [45, 45, 1, 1],
    [ECHO_ARENA_WIDTH - 45, 45, -1, 1],
    [45, ECHO_ARENA_HEIGHT - 45, 1, -1],
    [ECHO_ARENA_WIDTH - 45, ECHO_ARENA_HEIGHT - 45, -1, -1],
  ] as const;
  for (const [x, y, sx, sy] of cornerMarks) {
    chamber.moveTo(x, y).lineTo(x + sx * 34, y).stroke({ color: IVORY, alpha: 0.27, width: 1 });
    chamber.moveTo(x, y).lineTo(x, y + sy * 34).stroke({ color: IVORY, alpha: 0.27, width: 1 });
    chamber.circle(x + sx * 10, y + sy * 10, 2).fill({ color: READY_BLUE, alpha: 0.5 });
  }

  return chamber;
}

export async function createEchoRenderer(canvas: HTMLCanvasElement, reducedMotion: boolean): Promise<EchoRenderer> {
  const pixi = (await import(/* @vite-ignore */ PIXI_URL)) as unknown as PixiModule;
  const app = new pixi.Application();
  const coarse = window.matchMedia("(pointer: coarse)").matches;

  await app.init({
    canvas,
    resizeTo: canvas.parentElement ?? window,
    antialias: !coarse,
    backgroundAlpha: 0,
    autoStart: false,
    autoDensity: true,
    resolution: coarse ? 1 : Math.min(window.devicePixelRatio || 1, 1.5),
    preference: "webgl",
    powerPreference: coarse ? "low-power" : "high-performance",
  });

  const root = new pixi.Container();
  const chamber = drawChamber(pixi);
  const routeGuide = new pixi.Graphics();
  const trails = new pixi.Graphics();
  root.addChild(chamber, routeGuide, trails);
  app.stage.addChild(root);

  const nodeVisuals: NodeVisual[] = Array.from({ length: 8 }, () => createNodeVisual(pixi));
  for (const visual of nodeVisuals) root.addChild(visual.root);

  const echoVisuals: ActorVisual[] = Array.from(
    { length: ECHO_TOTAL_CYCLES - 1 },
    () => createActorVisual(pixi, ECHO_BLUE, false, true),
  );
  for (const visual of echoVisuals) {
    visual.root.visible = false;
    root.addChild(visual.root);
  }

  const playerVisual = createActorVisual(pixi, IVORY, true, false);
  root.addChild(playerVisual.root);

  const beatBorder = new pixi.Graphics();
  strokeRect(beatBorder, 22, 22, ECHO_ARENA_WIDTH - 44, ECHO_ARENA_HEIGHT - 44, READY_BLUE, 1, 1.2);
  beatBorder.alpha = 0;
  root.addChild(beatBorder);

  const dangerBorder = new pixi.Graphics();
  strokeRect(dangerBorder, 25, 25, ECHO_ARENA_WIDTH - 50, ECHO_ARENA_HEIGHT - 50, DANGER_COPPER, 1, 2);
  dangerBorder.alpha = 0;
  root.addChild(dangerBorder);

  const confluenceRing = new pixi.Graphics();
  confluenceRing.circle(0, 0, 38).stroke({ color: READY_BLUE, alpha: 1, width: 1.8 });
  confluenceRing.circle(0, 0, 49).stroke({ color: READY_BLUE, alpha: 0.35, width: 1 });
  confluenceRing.alpha = 0;
  root.addChild(confluenceRing);

  const actorSample: ActorSample = { x: 0, y: 0, phase: false, echoIndex: -1 };
  const lastActivationCounts = new Int16Array(8);
  const activationEnergy = new Float32Array(8);
  let renderCounter = 0;
  let confluenceEnergy = 0;

  const redrawTrails = (state: EchoSimulation) => {
    trails.clear();
    const stride = coarse ? 40 : 22;

    for (let echoIndex = 0; echoIndex < state.tapes.length; echoIndex += 1) {
      const tape = state.tapes[echoIndex];
      if (!tape || tape.length < 2) continue;
      const age = state.tapes.length - echoIndex;
      const alpha = Math.max(0.09, 0.3 - age * 0.042);
      let begun = false;
      for (let tick = 0; tick < tape.length; tick += stride) {
        const x = tape.x[tick] ?? 0;
        const y = tape.y[tick] ?? 0;
        if (!begun) {
          trails.moveTo(x, y);
          begun = true;
        } else {
          trails.lineTo(x, y);
        }
      }
      trails.stroke({ color: ECHO_BLUE, alpha, width: age === 1 ? 1.8 : 1.15 });
    }

    const current = state.recording;
    if (current.length > 2) {
      let begun = false;
      for (let tick = 0; tick < current.length; tick += stride) {
        const x = current.x[tick] ?? 0;
        const y = current.y[tick] ?? 0;
        if (!begun) {
          trails.moveTo(x, y);
          begun = true;
        } else {
          trails.lineTo(x, y);
        }
      }
      trails.stroke({ color: IVORY, alpha: 0.23, width: 1.25 });
    }
  };

  const redrawRouteGuide = (state: EchoSimulation) => {
    routeGuide.clear();
    let selectedNode: EchoSimulation["nodes"][number] | undefined;
    let selectedReady = false;
    let selectedPrimary: EchoSimulation["nodes"][number] | undefined;

    for (const node of state.nodes) {
      const cue = getNodeCue(state, node.id);
      const selected = cue.intensity > 0;
      if (!selected) continue;
      if (cue.primary) selectedPrimary = node;
      if (!selectedNode || cue.primary) {
        selectedNode = node;
        selectedReady = cue.ready;
      }
    }

    const guideNode = selectedPrimary ?? selectedNode;
    if (!guideNode) return;

    const dx = guideNode.x - state.player.x;
    const dy = guideNode.y - state.player.y;
    const distance = Math.max(1, Math.hypot(dx, dy));
    const nx = dx / distance;
    const ny = dy / distance;
    const startX = state.player.x + nx * 34;
    const startY = state.player.y + ny * 34;
    const endX = guideNode.x - nx * 62;
    const endY = guideNode.y - ny * 62;

    routeGuide
      .moveTo(startX, startY)
      .lineTo(endX, endY)
      .stroke({ color: selectedReady ? READY_BLUE : TARGET_BLUE, alpha: selectedReady ? 0.44 : 0.2, width: selectedReady ? 1.4 : 1 });

    const markerX = startX + (endX - startX) * 0.52;
    const markerY = startY + (endY - startY) * 0.52;
    routeGuide.circle(markerX, markerY, 2.6).fill({ color: selectedReady ? READY_BLUE : TARGET_BLUE, alpha: selectedReady ? 0.8 : 0.45 });
  };

  return {
    render(state) {
      const scale = Math.min(app.screen.width / ECHO_ARENA_WIDTH, app.screen.height / ECHO_ARENA_HEIGHT);
      root.scale.set(scale);
      root.position.set(
        (app.screen.width - ECHO_ARENA_WIDTH * scale) / 2,
        (app.screen.height - ECHO_ARENA_HEIGHT * scale) / 2,
      );

      renderCounter += 1;
      if (renderCounter % (coarse ? 6 : 3) === 0 || state.tickInCycle < 2) redrawTrails(state);
      redrawRouteGuide(state);

      for (let index = 0; index < state.nodes.length; index += 1) {
        const node = state.nodes[index];
        const visual = nodeVisuals[index];
        if (!node || !visual) continue;

        const cue = getNodeCue(state, node.id);
        const selected = cue.intensity > 0;
        const active = cue.ready;

        visual.root.position.set(node.x, node.y);
        visual.root.alpha = selected ? 1 : 0.66;
        visual.iris.tint = active ? READY_BLUE : selected ? 0xa7bcc1 : IVORY_DIM;
        visual.iris.alpha = active ? 0.85 : selected ? 0.58 : 0.34;
        visual.core.tint = active ? READY_BLUE : selected ? TARGET_BLUE : IVORY_DIM;
        visual.core.alpha = active ? 1 : selected ? 0.88 : 0.62;

        visual.targetRing.visible = selected;
        visual.targetRing.alpha = active ? 0.28 : 0.48 + cue.intensity * 0.28;
        visual.readyRing.visible = active;
        visual.wakeMark.visible = selected;
        visual.wakeMark.alpha = active ? 1 : 0.45 + cue.intensity * 0.28;

        if (!reducedMotion) {
          visual.iris.rotation = selected ? 0.04 + cue.intensity * 0.1 : 0;
          visual.targetRing.rotation += active ? 0.012 : 0.003;
          if (active) {
            const readyScale = 1 + getBeatPulse(state) * 0.08;
            visual.readyRing.scale.set(readyScale);
          } else {
            visual.readyRing.scale.set(1);
          }
        }

        if (node.activations > lastActivationCounts[index]!) {
          lastActivationCounts[index] = node.activations;
          activationEnergy[index] = 1;
        }
        const energy = activationEnergy[index] ?? 0;
        if (energy > 0.01) {
          visual.activationRing.alpha = energy * (reducedMotion ? 0.24 : 0.7);
          visual.activationRing.scale.set(1 + (1 - energy) * (reducedMotion ? 0.08 : 0.42));
          activationEnergy[index] = energy * (reducedMotion ? 0.62 : 0.84);
        } else {
          visual.activationRing.alpha = 0;
        }
      }

      for (let echoIndex = 0; echoIndex < echoVisuals.length; echoIndex += 1) {
        const visual = echoVisuals[echoIndex];
        if (!visual) continue;
        const exists = echoIndex < state.tapes.length && sampleEchoActor(state, echoIndex, actorSample);
        visual.root.visible = exists;
        if (!exists) continue;

        const age = state.tapes.length - echoIndex;
        visual.root.position.set(actorSample.x, actorSample.y);
        visual.root.scale.set(0.94);
        visual.root.alpha = Math.max(0.2, 0.62 - age * 0.075);
        visual.phaseRing.visible = actorSample.phase;
      }

      playerVisual.root.position.set(state.player.x, state.player.y);
      playerVisual.root.alpha = 1;
      playerVisual.root.scale.set(1.08);
      playerVisual.phaseRing.visible = state.player.phaseTicks > 0;

      const beat = getBeatPulse(state);
      beatBorder.alpha = beat * (reducedMotion ? 0.06 : 0.13);

      if (state.coherence < 45) {
        const danger = (45 - state.coherence) / 45;
        dangerBorder.alpha = 0.07 + danger * 0.2;
      } else {
        dangerBorder.alpha = 0;
      }

      for (const event of state.events) {
        if (event.type === "confluence") confluenceEnergy = Math.max(confluenceEnergy, 1);
      }
      if (confluenceEnergy > 0.01) {
        confluenceRing.position.set(state.player.x, state.player.y);
        confluenceRing.alpha = confluenceEnergy * (reducedMotion ? 0.18 : 0.65);
        confluenceRing.scale.set(1 + (1 - confluenceEnergy) * (reducedMotion ? 0.12 : 1.15));
        confluenceEnergy *= reducedMotion ? 0.64 : 0.84;
      } else {
        confluenceRing.alpha = 0;
      }

      app.renderer.render(app.stage);
    },
    destroy() {
      app.destroy(false, { children: true, texture: true, textureSource: true });
    },
  };
}
