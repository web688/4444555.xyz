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
const IVORY = 0xe5e0d7;
const ECHO_BLUE = 0x93aeb8;
const READY_BLUE = 0xb9d2da;
const GRAPHITE_IVORY = 0xc9c4b9;
const DANGER_COPPER = 0xa8654f;

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
  ring: any;
};

type NodeVisual = {
  root: any;
  iris: any;
  pulse: any;
};

function strokeRect(graphics: any, x: number, y: number, width: number, height: number, color: number, alpha: number, lineWidth: number) {
  graphics.rect(x, y, width, height).stroke({ color, alpha, width: lineWidth });
}

function createShardGraphic(pixi: PixiModule, color: number): any {
  const shard = new pixi.Graphics();
  const points = [0, -16, 13, 5, 3, 13, -16, 8];
  shard.poly(points).fill({ color, alpha: 1 });
  shard.poly(points).stroke({ color: 0xffffff, alpha: 0.6, width: 0.8 });
  return shard;
}

function createActorVisual(pixi: PixiModule, color: number, withCore: boolean): ActorVisual {
  const root = new pixi.Container();
  const shard = createShardGraphic(pixi, color);
  const ring = new pixi.Graphics().circle(0, 0, 25).stroke({ color: 0xcce0e5, alpha: 1, width: 1.3 });
  ring.visible = false;
  root.addChild(shard, ring);
  if (withCore) {
    const core = new pixi.Graphics().circle(-2, 2, 4.5).fill({ color: 0x9ebbc5, alpha: 0.78 });
    root.addChild(core);
  }
  return { root, shard, ring };
}

function createNodeVisual(pixi: PixiModule): NodeVisual {
  const root = new pixi.Container();
  const iris = new pixi.Graphics();
  iris.circle(0, 0, 27).stroke({ color: 0xffffff, alpha: 1, width: 1.2 });
  iris.circle(0, 0, 15).stroke({ color: 0xffffff, alpha: 0.55, width: 0.9 });
  for (let blade = 0; blade < 6; blade += 1) {
    const angle = (Math.PI * 2 * blade) / 6;
    iris
      .moveTo(Math.cos(angle) * 10, Math.sin(angle) * 10)
      .lineTo(Math.cos(angle + 0.28) * 22, Math.sin(angle + 0.28) * 22)
      .stroke({ color: 0xffffff, alpha: 0.52, width: 1 });
  }
  const pulse = new pixi.Graphics().circle(0, 0, 34).stroke({ color: 0xc8e0e5, alpha: 1, width: 1 });
  pulse.visible = false;
  root.addChild(iris, pulse);
  return { root, iris, pulse };
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
  const chamber = new pixi.Graphics();
  const trails = new pixi.Graphics();
  root.addChild(chamber, trails);
  app.stage.addChild(root);

  chamber.rect(0, 0, ECHO_ARENA_WIDTH, ECHO_ARENA_HEIGHT).fill({ color: 0x08090a, alpha: 1 });
  strokeRect(chamber, 22, 22, ECHO_ARENA_WIDTH - 44, ECHO_ARENA_HEIGHT - 44, 0xded9cf, 0.22, 1);
  strokeRect(chamber, 34, 34, ECHO_ARENA_WIDTH - 68, ECHO_ARENA_HEIGHT - 68, 0x7e7b75, 0.12, 1);
  for (let x = 95; x < ECHO_ARENA_WIDTH; x += 135) {
    chamber.moveTo(x, 42).lineTo(x, ECHO_ARENA_HEIGHT - 42).stroke({ color: 0xb8b3aa, alpha: 0.035, width: 1 });
  }
  for (let y = 90; y < ECHO_ARENA_HEIGHT; y += 110) {
    chamber.moveTo(42, y).lineTo(ECHO_ARENA_WIDTH - 42, y).stroke({ color: 0xb8b3aa, alpha: 0.035, width: 1 });
  }
  chamber.circle(ECHO_ARENA_WIDTH / 2, ECHO_ARENA_HEIGHT / 2, 118).stroke({ color: 0xc5c0b5, alpha: 0.08, width: 1 });
  chamber.circle(ECHO_ARENA_WIDTH / 2, ECHO_ARENA_HEIGHT / 2, 228).stroke({ color: 0xc5c0b5, alpha: 0.045, width: 1 });

  const nodeVisuals: NodeVisual[] = Array.from({ length: 8 }, () => createNodeVisual(pixi));
  for (const visual of nodeVisuals) root.addChild(visual.root);

  const echoVisuals: ActorVisual[] = Array.from({ length: ECHO_TOTAL_CYCLES - 1 }, () => createActorVisual(pixi, ECHO_BLUE, false));
  for (const visual of echoVisuals) {
    visual.root.visible = false;
    root.addChild(visual.root);
  }
  const playerVisual = createActorVisual(pixi, IVORY, true);
  root.addChild(playerVisual.root);

  const beatBorder = new pixi.Graphics();
  strokeRect(beatBorder, 26, 26, ECHO_ARENA_WIDTH - 52, ECHO_ARENA_HEIGHT - 52, 0xd8d4ca, 1, 1);
  beatBorder.alpha = 0;
  root.addChild(beatBorder);

  const dangerBorder = new pixi.Graphics();
  strokeRect(dangerBorder, 31, 31, ECHO_ARENA_WIDTH - 62, ECHO_ARENA_HEIGHT - 62, DANGER_COPPER, 1, 2);
  dangerBorder.alpha = 0;
  root.addChild(dangerBorder);

  const confluenceRing = new pixi.Graphics().circle(0, 0, 36).stroke({ color: 0xc8e0e5, alpha: 1, width: 1 });
  confluenceRing.alpha = 0;
  root.addChild(confluenceRing);

  const actorSample: ActorSample = { x: 0, y: 0, phase: false, echoIndex: -1 };
  let renderCounter = 0;
  let confluenceEnergy = 0;

  const redrawTrails = (state: EchoSimulation) => {
    trails.clear();
    const stride = coarse ? 42 : 24;
    for (let echoIndex = 0; echoIndex < state.tapes.length; echoIndex += 1) {
      const tape = state.tapes[echoIndex];
      if (!tape || tape.length < 2) continue;
      const age = state.tapes.length - echoIndex;
      const alpha = Math.max(0.055, 0.19 - age * 0.025);
      let begun = false;
      for (let tick = 0; tick < tape.length; tick += stride) {
        const x = tape.x[tick] ?? 0;
        const y = tape.y[tick] ?? 0;
        if (!begun) {
          trails.moveTo(x, y);
          begun = true;
        } else trails.lineTo(x, y);
      }
      trails.stroke({ color: 0x9fb4bd, alpha, width: age === 1 ? 1.35 : 0.85 });
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
        } else trails.lineTo(x, y);
      }
      trails.stroke({ color: IVORY, alpha: 0.12, width: 1 });
    }
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

      for (let index = 0; index < state.nodes.length; index += 1) {
        const node = state.nodes[index];
        const visual = nodeVisuals[index];
        if (!node || !visual) continue;
        const cue = getNodeCue(state, node.id);
        visual.root.position.set(node.x, node.y);
        visual.iris.tint = cue.ready ? READY_BLUE : GRAPHITE_IVORY;
        visual.iris.alpha = cue.ready ? 0.62 + cue.intensity * 0.3 : 0.24;
        visual.iris.rotation = cue.ready && !reducedMotion ? cue.intensity * 0.06 : 0;
        visual.pulse.visible = cue.ready;
        visual.pulse.alpha = cue.ready ? cue.intensity * (reducedMotion ? 0.08 : 0.16) : 0;
        const pulseScale = reducedMotion ? 1 : 1 + cue.intensity * 0.12;
        visual.pulse.scale.set(pulseScale);
      }

      for (let echoIndex = 0; echoIndex < echoVisuals.length; echoIndex += 1) {
        const visual = echoVisuals[echoIndex];
        if (!visual) continue;
        const exists = echoIndex < state.tapes.length && sampleEchoActor(state, echoIndex, actorSample);
        visual.root.visible = exists;
        if (!exists) continue;
        const age = state.tapes.length - echoIndex;
        visual.root.position.set(actorSample.x, actorSample.y);
        visual.root.scale.set(0.9);
        visual.root.alpha = Math.max(0.12, 0.48 - age * 0.06);
        visual.ring.visible = actorSample.phase;
      }

      playerVisual.root.position.set(state.player.x, state.player.y);
      playerVisual.root.alpha = 1;
      playerVisual.ring.visible = state.player.phaseTicks > 0;

      const beat = getBeatPulse(state);
      beatBorder.alpha = beat * (reducedMotion ? 0.055 : 0.1);
      if (state.coherence < 45) {
        const danger = (45 - state.coherence) / 45;
        dangerBorder.alpha = 0.05 + danger * 0.13;
      } else dangerBorder.alpha = 0;

      for (const event of state.events) {
        if (event.type === "confluence") confluenceEnergy = Math.max(confluenceEnergy, 1);
      }
      if (confluenceEnergy > 0.01) {
        confluenceRing.position.set(state.player.x, state.player.y);
        confluenceRing.alpha = confluenceEnergy * (reducedMotion ? 0.08 : 0.2);
        confluenceRing.scale.set(1 + (1 - confluenceEnergy) * (reducedMotion ? 0.1 : 0.75));
        confluenceEnergy *= reducedMotion ? 0.72 : 0.86;
      } else confluenceRing.alpha = 0;

      app.renderer.render(app.stage);
    },
    destroy() {
      app.destroy(false, { children: true, texture: true, textureSource: true });
    },
  };
}
