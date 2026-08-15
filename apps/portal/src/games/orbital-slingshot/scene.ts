import { SlingshotAudio } from "./audio";
import { createSeededRandom, getDailyRouteKey, hashRouteSeed } from "./progress";

export type SlingshotPhase =
  | "ready"
  | "aiming"
  | "flight"
  | "paused"
  | "sector_cleared"
  | "complete"
  | "failed"
  | "error";

export type SlingshotReport = {
  averageFps: number;
  renderWidth: number;
  renderHeight: number;
  devicePixelRatio: number;
  totalTimeSeconds: number;
  beaconsCollected: number;
  slingshots: number;
  maxMultiplier: number;
};

export type SlingshotTelemetry = {
  phase: SlingshotPhase;
  elapsed: number;
  score: number;
  multiplier: number;
  speed: number;
  gForce: number;
  fuel: number;
  sector: number;
  beaconsCollected: number;
  totalBeacons: number;
  slingshots: number;
  maxMultiplier: number;
  routeKey: string;
  fps: number;
  callout: string;
  report: SlingshotReport | null;
};

export type SlingshotRuntime = {
  start(): void;
  pause(): void;
  resume(): void;
  restart(): void;
  setMuted(muted: boolean): void;
  fireThruster(dirX: number, dirY: number): void;
  setAim(angle: number, power: number): void;
  launch(): void;
  destroy(): void;
};

export interface CelestialBody {
  id: string;
  x: number;
  y: number;
  radius: number;
  gravityRadius: number;
  mass: number;
  type: "planet" | "pulsar" | "anomaly";
  name: string;
  pulsarPhase?: number;
  rotation?: number;
}

export interface TelemetryBeacon {
  id: string;
  x: number;
  y: number;
  radius: number;
  collected: boolean;
  pulsePhase: number;
}

export interface ExtractionGate {
  x: number;
  y: number;
  radius: number;
  rotation: number;
}

export interface SectorConfig {
  sector: number;
  name: string;
  bodies: CelestialBody[];
  beacons: TelemetryBeacon[];
  gate: ExtractionGate;
  launchPos: { x: number; y: number };
  defaultAngle: number;
  defaultPower: number;
}

export const G_CONSTANT = 1800;
const MAX_SECTORS = 4;
const BASE_WIDTH = 1600;
const BASE_HEIGHT = 900;

export function buildDailySectors(seedValue: number): SectorConfig[] {
  const random = createSeededRandom(seedValue);

  return [
    // Sector 1: Binary System
    {
      sector: 1,
      name: "Keplerian Outpost",
      launchPos: { x: 180, y: 450 },
      defaultAngle: 0.25,
      defaultPower: 380,
      bodies: [
        {
          id: "s1-p1",
          x: 620,
          y: 360,
          radius: 46,
          gravityRadius: 260,
          mass: 280,
          type: "planet",
          name: "Helios Prime",
        },
        {
          id: "s1-p2",
          x: 1060,
          y: 560,
          radius: 54,
          gravityRadius: 300,
          mass: 360,
          type: "planet",
          name: "Vespera",
        },
      ],
      beacons: [
        { id: "s1-b1", x: 620, y: 190, radius: 12, collected: false, pulsePhase: 0 },
        { id: "s1-b2", x: 840, y: 480, radius: 12, collected: false, pulsePhase: 1.2 },
        { id: "s1-b3", x: 1060, y: 740, radius: 12, collected: false, pulsePhase: 2.4 },
      ],
      gate: { x: 1440, y: 450, radius: 38, rotation: 0 },
    },
    // Sector 2: Triple Asteroid Resonance
    {
      sector: 2,
      name: "Coriolis Belt",
      launchPos: { x: 160, y: 720 },
      defaultAngle: -0.5,
      defaultPower: 420,
      bodies: [
        {
          id: "s2-p1",
          x: 520,
          y: 480,
          radius: 42,
          gravityRadius: 240,
          mass: 260,
          type: "planet",
          name: "Astraea",
        },
        {
          id: "s2-p2",
          x: 940,
          y: 280,
          radius: 48,
          gravityRadius: 280,
          mass: 320,
          type: "planet",
          name: "Chronos",
        },
        {
          id: "s2-p3",
          x: 1080,
          y: 680,
          radius: 38,
          gravityRadius: 220,
          mass: 240,
          type: "planet",
          name: "Thalassa",
        },
      ],
      beacons: [
        { id: "s2-b1", x: 520, y: 290, radius: 12, collected: false, pulsePhase: 0.5 },
        { id: "s2-b2", x: 940, y: 110, radius: 12, collected: false, pulsePhase: 1.8 },
        { id: "s2-b3", x: 1260, y: 520, radius: 12, collected: false, pulsePhase: 3.1 },
      ],
      gate: { x: 1450, y: 220, radius: 38, rotation: 0 },
    },
    // Sector 3: Pulsar Repulsion Core
    {
      sector: 3,
      name: "Hyperion Pulsar",
      launchPos: { x: 180, y: 200 },
      defaultAngle: 0.45,
      defaultPower: 440,
      bodies: [
        {
          id: "s3-psr",
          x: 760,
          y: 450,
          radius: 34,
          gravityRadius: 320,
          mass: -360,
          type: "pulsar",
          name: "PSR-J1740",
          pulsarPhase: 0,
        },
        {
          id: "s3-p1",
          x: 480,
          y: 680,
          radius: 50,
          gravityRadius: 280,
          mass: 340,
          type: "planet",
          name: "Typhon",
        },
        {
          id: "s3-p2",
          x: 1120,
          y: 260,
          radius: 56,
          gravityRadius: 310,
          mass: 380,
          type: "planet",
          name: "Erebus",
        },
      ],
      beacons: [
        { id: "s3-b1", x: 480, y: 470, radius: 12, collected: false, pulsePhase: 0 },
        { id: "s3-b2", x: 760, y: 720, radius: 12, collected: false, pulsePhase: 1.5 },
        { id: "s3-b3", x: 1120, y: 470, radius: 12, collected: false, pulsePhase: 3.0 },
      ],
      gate: { x: 1440, y: 740, radius: 38, rotation: 0 },
    },
    // Sector 4: Singularity Horizon
    {
      sector: 4,
      name: "Event Horizon Gate",
      launchPos: { x: 160, y: 450 },
      defaultAngle: -0.3,
      defaultPower: 460,
      bodies: [
        {
          id: "s4-bh",
          x: 800,
          y: 450,
          radius: 40,
          gravityRadius: 400,
          mass: 650,
          type: "anomaly",
          name: "Sagittarius-44",
        },
        {
          id: "s4-p1",
          x: 480,
          y: 200,
          radius: 44,
          gravityRadius: 250,
          mass: 280,
          type: "planet",
          name: "Styx",
        },
        {
          id: "s4-p2",
          x: 1150,
          y: 700,
          radius: 48,
          gravityRadius: 270,
          mass: 300,
          type: "planet",
          name: "Nemesis",
        },
      ],
      beacons: [
        { id: "s4-b1", x: 480, y: 390, radius: 12, collected: false, pulsePhase: 0.8 },
        { id: "s4-b2", x: 800, y: 210, radius: 12, collected: false, pulsePhase: 2.1 },
        { id: "s4-b3", x: 800, y: 690, radius: 12, collected: false, pulsePhase: 3.4 },
        { id: "s4-b4", x: 1150, y: 490, radius: 12, collected: false, pulsePhase: 4.2 },
      ],
      gate: { x: 1460, y: 450, radius: 40, rotation: 0 },
    },
  ];
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

interface TrailPoint {
  x: number;
  y: number;
  speed: number;
  alpha: number;
}

export async function createOrbitalSlingshotScene(
  canvas: HTMLCanvasElement,
  onTelemetry: (telemetry: SlingshotTelemetry) => void,
): Promise<SlingshotRuntime> {
  const context = canvas.getContext("2d");
  if (!context) throw new Error("2D Canvas is not available in this browser.");
  const ctx: CanvasRenderingContext2D = context;

  const audio = new SlingshotAudio();
  const routeKey = getDailyRouteKey();
  const seed = hashRouteSeed(routeKey);
  const sectors = buildDailySectors(seed);

  let currentSectorIndex = 0;
  let currentSector: SectorConfig = sectors[0] ?? {
    sector: 1,
    name: "Keplerian Outpost",
    launchPos: { x: 180, y: 450 },
    defaultAngle: 0.25,
    defaultPower: 380,
    bodies: [],
    beacons: [],
    gate: { x: 1440, y: 450, radius: 38, rotation: 0 },
  };

  let phase: SlingshotPhase = "ready";
  let score = 0;
  let multiplier = 1;
  let maxMultiplier = 1;
  let slingshots = 0;
  let beaconsCollectedTotal = 0;
  let fuel = 3;
  let elapsed = 0;
  let callout = "SECTOR 1: KEPLERIAN OUTPOST — SET TRAJECTORY";
  let calloutTimer = 4;

  let aimAngle = currentSector.defaultAngle;
  let aimPower = currentSector.defaultPower;
  let isAiming = false;

  let probeX = currentSector.launchPos.x;
  let probeY = currentSector.launchPos.y;
  let probeVx = 0;
  let probeVy = 0;
  const probeRadius = 7;
  let probeAlive = true;

  const bodySlingshotTracker: Record<string, { enteredPeriapsis: boolean; passed: boolean }> = {};
  const particles: Particle[] = [];
  const trail: TrailPoint[] = [];
  const stars: { x: number; y: number; size: number; alpha: number; speed: number }[] = [];

  for (let i = 0; i < 180; i += 1) {
    stars.push({
      x: Math.random() * BASE_WIDTH,
      y: Math.random() * BASE_HEIGHT,
      size: Math.random() * 1.8 + 0.5,
      alpha: Math.random() * 0.7 + 0.3,
      speed: Math.random() * 0.15 + 0.05,
    });
  }

  let animationId = 0;
  let lastTimestamp = performance.now();
  let frameCount = 0;
  let fps = 60;
  let fpsTimer = 0;
  let running = false;

  function resetSector(sectorIdx: number) {
    currentSectorIndex = sectorIdx;
    const targetSector = sectors[sectorIdx];
    if (targetSector) {
      currentSector = targetSector;
    }
    probeX = currentSector.launchPos.x;
    probeY = currentSector.launchPos.y;
    probeVx = 0;
    probeVy = 0;
    probeAlive = true;
    aimAngle = currentSector.defaultAngle;
    aimPower = currentSector.defaultPower;
    fuel = 3;
    trail.length = 0;
    particles.length = 0;
    for (const body of currentSector.bodies) {
      bodySlingshotTracker[body.id] = { enteredPeriapsis: false, passed: false };
    }
    for (const b of currentSector.beacons) {
      b.collected = false;
    }
    phase = "aiming";
    callout = `SECTOR ${currentSector.sector}: ${currentSector.name.toUpperCase()}`;
    calloutTimer = 3;
  }

  function launchProbe() {
    if (phase !== "aiming" && phase !== "ready") return;
    probeVx = Math.cos(aimAngle) * aimPower;
    probeVy = Math.sin(aimAngle) * aimPower;
    phase = "flight";
    callout = "PROBE LAUNCHED — GRAVITATIONAL CAPTURE ACTIVE";
    calloutTimer = 2.5;
    audio.launch();

    for (let i = 0; i < 20; i += 1) {
      const angle = aimAngle + Math.PI + (Math.random() - 0.5) * 0.8;
      const speed = Math.random() * 120 + 40;
      particles.push({
        x: probeX,
        y: probeY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0,
        maxLife: 0.4 + Math.random() * 0.3,
        color: "#00f0a8",
        size: Math.random() * 3 + 1.5,
      });
    }
  }

  function fireThrusterPulse(dx: number, dy: number) {
    if (phase !== "flight" || fuel <= 0 || !probeAlive) return;
    fuel -= 1;
    const impulse = 140;
    probeVx += dx * impulse;
    probeVy += dy * impulse;
    audio.thrusterBurn();
    callout = `MICRO-BURN ENGAGED [${fuel}/3 REMAINING]`;
    calloutTimer = 1.8;

    for (let i = 0; i < 16; i += 1) {
      const angle = Math.atan2(-dy, -dx) + (Math.random() - 0.5) * 0.6;
      const speed = Math.random() * 160 + 60;
      particles.push({
        x: probeX,
        y: probeY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0,
        maxLife: 0.35 + Math.random() * 0.2,
        color: "#38bdf8",
        size: Math.random() * 2.5 + 1,
      });
    }
  }

  function simulateTrajectory(steps = 160, dt = 0.016): { x: number; y: number }[] {
    const points: { x: number; y: number }[] = [];
    let simX = currentSector.launchPos.x;
    let simY = currentSector.launchPos.y;
    let simVx = Math.cos(aimAngle) * aimPower;
    let simVy = Math.sin(aimAngle) * aimPower;

    for (let i = 0; i < steps; i += 1) {
      points.push({ x: simX, y: simY });
      let ax = 0;
      let ay = 0;

      for (const body of currentSector.bodies) {
        const dx = body.x - simX;
        const dy = body.y - simY;
        const distSq = dx * dx + dy * dy;
        const dist = Math.sqrt(distSq);
        if (dist < body.radius) {
          return points;
        }
        if (dist < body.gravityRadius) {
          const force = (G_CONSTANT * body.mass) / Math.max(distSq, 900);
          ax += (dx / dist) * force;
          ay += (dy / dist) * force;
        }
      }

      simVx += ax * dt;
      simVy += ay * dt;
      simX += simVx * dt;
      simY += simVy * dt;

      if (simX < -100 || simX > BASE_WIDTH + 100 || simY < -100 || simY > BASE_HEIGHT + 100) {
        break;
      }
    }
    return points;
  }

  function updatePhysics(dt: number) {
    if (phase !== "flight" || !probeAlive) return;

    elapsed += dt;
    let ax = 0;
    let ay = 0;
    let maxProximityIntensity = 0;

    for (const body of currentSector.bodies) {
      const dx = body.x - probeX;
      const dy = body.y - probeY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < body.radius + probeRadius) {
        probeAlive = false;
        phase = "failed";
        callout = `CRITICAL HULL FAILURE — COLLISION WITH ${body.name.toUpperCase()}`;
        calloutTimer = 5;
        audio.hit();

        for (let i = 0; i < 40; i += 1) {
          const angle = Math.random() * Math.PI * 2;
          const speed = Math.random() * 220 + 30;
          particles.push({
            x: probeX,
            y: probeY,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            life: 0,
            maxLife: 0.6 + Math.random() * 0.4,
            color: i % 2 === 0 ? "#ff4d4d" : "#ffbd59",
            size: Math.random() * 4 + 2,
          });
        }
        return;
      }

      if (dist < body.gravityRadius) {
        const force = (G_CONSTANT * body.mass) / Math.max(dist * dist, 900);
        ax += (dx / dist) * force;
        ay += (dy / dist) * force;

        const prox = 1 - (dist - body.radius) / (body.gravityRadius - body.radius);
        if (prox > maxProximityIntensity) maxProximityIntensity = prox;

        const tracker = bodySlingshotTracker[body.id];
        if (tracker && !tracker.passed) {
          const periapsisThreshold = body.radius * 2.2;
          if (dist < periapsisThreshold && !tracker.enteredPeriapsis) {
            tracker.enteredPeriapsis = true;
          } else if (dist >= periapsisThreshold && tracker.enteredPeriapsis) {
            tracker.passed = true;
            slingshots += 1;
            multiplier = Math.min(10, multiplier + 1);
            if (multiplier > maxMultiplier) maxMultiplier = multiplier;
            const points = 1500 * multiplier;
            score += points;
            callout = `GRAVITY SLINGSHOT! ×${multiplier} [ +${points.toLocaleString()} PTS ]`;
            calloutTimer = 2.4;
            audio.slingshot(multiplier);

            for (let i = 0; i < 24; i += 1) {
              const angle = (i / 24) * Math.PI * 2;
              particles.push({
                x: body.x + Math.cos(angle) * body.radius * 1.5,
                y: body.y + Math.sin(angle) * body.radius * 1.5,
                vx: Math.cos(angle) * 110,
                vy: Math.sin(angle) * 110,
                life: 0,
                maxLife: 0.4,
                color: "#00f0a8",
                size: 2.5,
              });
            }
          }
        }
      }
    }

    audio.updateGravityProximity(maxProximityIntensity);

    probeVx += ax * dt;
    probeVy += ay * dt;
    probeX += probeVx * dt;
    probeY += probeVy * dt;

    const currentSpeed = Math.sqrt(probeVx * probeVx + probeVy * probeVy);

    trail.unshift({ x: probeX, y: probeY, speed: currentSpeed, alpha: 1 });
    if (trail.length > 40) trail.pop();

    for (let i = 0; i < currentSector.beacons.length; i += 1) {
      const beacon = currentSector.beacons[i];
      if (beacon && !beacon.collected) {
        const bdx = beacon.x - probeX;
        const bdy = beacon.y - probeY;
        const bDist = Math.sqrt(bdx * bdx + bdy * bdy);
        if (bDist < beacon.radius + probeRadius + 14) {
          beacon.collected = true;
          beaconsCollectedTotal += 1;
          const bPoints = 2500 * multiplier;
          score += bPoints;
          callout = `TELEMETRY BEACON RECOVERED [ +${bPoints.toLocaleString()} PTS ]`;
          calloutTimer = 2.0;
          audio.beaconPickup(i);

          for (let p = 0; p < 18; p += 1) {
            const angle = (p / 18) * Math.PI * 2;
            particles.push({
              x: beacon.x,
              y: beacon.y,
              vx: Math.cos(angle) * 80,
              vy: Math.sin(angle) * 80,
              life: 0,
              maxLife: 0.35,
              color: "#38bdf8",
              size: 2,
            });
          }
        }
      }
    }

    const gdx = currentSector.gate.x - probeX;
    const gdy = currentSector.gate.y - probeY;
    const gDist = Math.sqrt(gdx * gdx + gdy * gdy);

    if (gDist < currentSector.gate.radius + probeRadius) {
      audio.dockingComplete();
      const fuelBonus = fuel * 1000;
      score += 5000 + fuelBonus;

      if (currentSectorIndex + 1 < MAX_SECTORS) {
        phase = "sector_cleared";
        callout = `SECTOR ${currentSector.sector} COMPLETE! PREPARING NEXT INSERTION...`;
        calloutTimer = 3;
        setTimeout(() => {
          if (running) resetSector(currentSectorIndex + 1);
        }, 1800);
      } else {
        phase = "complete";
        callout = "ALL SECTORS SURVEYED — MISSION ACCOMPLISHED!";
        calloutTimer = 10;
      }
      return;
    }

    if (probeX < -150 || probeX > BASE_WIDTH + 150 || probeY < -150 || probeY > BASE_HEIGHT + 150) {
      probeAlive = false;
      phase = "failed";
      callout = "ORBITAL TRAJECTORY LOST IN DEEP SPACE — RETRYING";
      calloutTimer = 4;
      audio.fail();
    }
  }

  function render() {
    const dpr = window.devicePixelRatio || 1;
    const width = canvas.clientWidth || BASE_WIDTH;
    const height = canvas.clientHeight || BASE_HEIGHT;

    if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
      canvas.width = width * dpr;
      canvas.height = height * dpr;
    }

    ctx.save();
    ctx.scale((width * dpr) / BASE_WIDTH, (height * dpr) / BASE_HEIGHT);

    ctx.fillStyle = "#07080d";
    ctx.fillRect(0, 0, BASE_WIDTH, BASE_HEIGHT);

    const nebula = ctx.createRadialGradient(
      BASE_WIDTH * 0.65,
      BASE_HEIGHT * 0.45,
      50,
      BASE_WIDTH * 0.65,
      BASE_HEIGHT * 0.45,
      600,
    );
    nebula.addColorStop(0, "rgba(0, 240, 168, 0.04)");
    nebula.addColorStop(0.5, "rgba(24, 48, 80, 0.06)");
    nebula.addColorStop(1, "transparent");
    ctx.fillStyle = nebula;
    ctx.fillRect(0, 0, BASE_WIDTH, BASE_HEIGHT);

    for (const star of stars) {
      ctx.fillStyle = `rgba(255, 255, 255, ${star.alpha})`;
      ctx.fillRect(star.x, star.y, star.size, star.size);
    }

    ctx.strokeStyle = "rgba(255, 255, 255, 0.035)";
    ctx.lineWidth = 1;
    for (let x = 100; x < BASE_WIDTH; x += 150) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, BASE_HEIGHT);
      ctx.stroke();
    }
    for (let y = 100; y < BASE_HEIGHT; y += 150) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(BASE_WIDTH, y);
      ctx.stroke();
    }

    for (const body of currentSector.bodies) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(body.x, body.y, body.gravityRadius, 0, Math.PI * 2);
      ctx.strokeStyle =
        body.type === "pulsar" ? "rgba(255, 90, 90, 0.15)" : "rgba(0, 240, 168, 0.12)";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 6]);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.beginPath();
      ctx.arc(body.x, body.y, body.radius * 2.2, 0, Math.PI * 2);
      ctx.strokeStyle =
        body.type === "pulsar" ? "rgba(255, 120, 80, 0.25)" : "rgba(0, 240, 168, 0.28)";
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(body.x, body.y, body.radius + 5, 0, Math.PI * 2);
      ctx.strokeStyle = "#ff7700";
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(body.x, body.y, body.radius, 0, Math.PI * 2);
      ctx.fillStyle = body.type === "anomaly" ? "#111218" : "#ffffff";
      ctx.fill();

      if (body.type === "anomaly") {
        ctx.strokeStyle = "#00f0a8";
        ctx.lineWidth = 3;
        ctx.stroke();
      }

      ctx.fillStyle = "rgba(255, 255, 255, 0.45)";
      ctx.font = "10px 'DM Mono', monospace";
      ctx.textAlign = "center";
      ctx.fillText(body.name.toUpperCase(), body.x, body.y + body.radius + 22);
      ctx.restore();
    }

    for (const beacon of currentSector.beacons) {
      if (!beacon.collected) {
        beacon.pulsePhase += 0.04;
        const pulseScale = 1 + Math.sin(beacon.pulsePhase) * 0.15;
        ctx.save();
        ctx.beginPath();
        ctx.arc(beacon.x, beacon.y, beacon.radius * pulseScale, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(56, 189, 248, 0.25)";
        ctx.fill();

        ctx.beginPath();
        ctx.arc(beacon.x, beacon.y, beacon.radius, 0, Math.PI * 2);
        ctx.fillStyle = "#38bdf8";
        ctx.fill();

        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.fillStyle = "#ffffff";
        ctx.font = "8px 'DM Mono', monospace";
        ctx.textAlign = "center";
        ctx.fillText("DATA", beacon.x, beacon.y + beacon.radius + 14);
        ctx.restore();
      }
    }

    const gate = currentSector.gate;
    gate.rotation += 0.02;
    ctx.save();
    ctx.translate(gate.x, gate.y);
    ctx.rotate(gate.rotation);

    ctx.beginPath();
    ctx.arc(0, 0, gate.radius, 0, Math.PI * 2);
    ctx.strokeStyle = "#00f0a8";
    ctx.lineWidth = 3;
    ctx.setLineDash([8, 6]);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.beginPath();
    ctx.arc(0, 0, gate.radius * 0.65, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(0, 240, 168, 0.2)";
    ctx.fill();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.restore();
    ctx.fillStyle = "#00f0a8";
    ctx.font = "10px 'DM Mono', monospace";
    ctx.textAlign = "center";
    ctx.fillText("EXTRACTION GATE", gate.x, gate.y + gate.radius + 20);

    if (phase === "aiming" || phase === "ready") {
      const trajectory = simulateTrajectory(160);
      ctx.save();
      ctx.beginPath();
      for (let i = 0; i < trajectory.length; i += 1) {
        const pt = trajectory[i];
        if (pt) {
          if (i === 0) ctx.moveTo(pt.x, pt.y);
          else ctx.lineTo(pt.x, pt.y);
        }
      }
      ctx.strokeStyle = "rgba(0, 240, 168, 0.5)";
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 8]);
      ctx.stroke();
      ctx.setLineDash([]);

      const aimLen = (aimPower / 500) * 80;
      const ax = currentSector.launchPos.x + Math.cos(aimAngle) * aimLen;
      const ay = currentSector.launchPos.y + Math.sin(aimAngle) * aimLen;
      ctx.beginPath();
      ctx.moveTo(currentSector.launchPos.x, currentSector.launchPos.y);
      ctx.lineTo(ax, ay);
      ctx.strokeStyle = "#00f0a8";
      ctx.lineWidth = 3;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(currentSector.launchPos.x, currentSector.launchPos.y, 16, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(255, 255, 255, 0.6)";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
    }

    if (trail.length > 1) {
      ctx.save();
      for (let i = 0; i < trail.length - 1; i += 1) {
        const t1 = trail[i];
        const t2 = trail[i + 1];
        if (t1 && t2) {
          const alpha = (1 - i / trail.length) * 0.75;
          ctx.beginPath();
          ctx.moveTo(t1.x, t1.y);
          ctx.lineTo(t2.x, t2.y);
          ctx.strokeStyle = `rgba(0, 240, 168, ${alpha})`;
          ctx.lineWidth = Math.max(1, 4 - (i / trail.length) * 3);
          ctx.stroke();
        }
      }
      ctx.restore();
    }

    for (const p of particles) {
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }

    if (probeAlive && (phase === "flight" || phase === "aiming" || phase === "ready")) {
      ctx.save();
      ctx.translate(probeX, probeY);
      const probeAngle =
        phase === "flight" && (probeVx !== 0 || probeVy !== 0)
          ? Math.atan2(probeVy, probeVx)
          : aimAngle;
      ctx.rotate(probeAngle);

      ctx.beginPath();
      ctx.moveTo(12, 0);
      ctx.lineTo(-8, -7);
      ctx.lineTo(-4, 0);
      ctx.lineTo(-8, 7);
      ctx.closePath();
      ctx.fillStyle = "#ffffff";
      ctx.fill();

      ctx.beginPath();
      ctx.arc(0, 0, 3, 0, Math.PI * 2);
      ctx.fillStyle = "#00f0a8";
      ctx.fill();

      ctx.restore();
    }

    ctx.restore();
  }

  function tick(timestamp: number) {
    if (!running) return;
    const deltaMs = timestamp - lastTimestamp;
    lastTimestamp = timestamp;
    const dt = Math.min(0.1, deltaMs / 1000);

    frameCount += 1;
    fpsTimer += dt;
    if (fpsTimer >= 0.5) {
      fps = Math.round((frameCount / fpsTimer) * 10) / 10;
      frameCount = 0;
      fpsTimer = 0;
    }

    if (calloutTimer > 0) {
      calloutTimer -= dt;
      if (calloutTimer <= 0) callout = "";
    }

    for (let i = particles.length - 1; i >= 0; i -= 1) {
      const p = particles[i];
      if (p) {
        p.life += dt;
        if (p.life >= p.maxLife) {
          particles.splice(i, 1);
        } else {
          p.x += p.vx * dt;
          p.y += p.vy * dt;
        }
      }
    }

    if (phase === "flight") {
      updatePhysics(dt);
    }

    render();

    const speedKmh = Math.round(Math.sqrt(probeVx * probeVx + probeVy * probeVy) * 10);
    const gForce = Math.round((speedKmh / 400) * 10) / 10;

    onTelemetry({
      phase,
      elapsed,
      score,
      multiplier,
      speed: speedKmh,
      gForce,
      fuel,
      sector: currentSector.sector,
      beaconsCollected: beaconsCollectedTotal,
      totalBeacons: 13,
      slingshots,
      maxMultiplier,
      routeKey,
      fps,
      callout,
      report:
        phase === "complete" || phase === "failed"
          ? {
              averageFps: fps,
              renderWidth: canvas.width,
              renderHeight: canvas.height,
              devicePixelRatio: window.devicePixelRatio || 1,
              totalTimeSeconds: Math.round(elapsed),
              beaconsCollected: beaconsCollectedTotal,
              slingshots,
              maxMultiplier,
            }
          : null,
    });

    animationId = requestAnimationFrame(tick);
  }

  function handlePointerDown(event: PointerEvent) {
    if (phase !== "aiming" && phase !== "ready") return;
    void audio.arm();
    isAiming = true;
    updateAimFromPointer(event);
  }

  function handlePointerMove(event: PointerEvent) {
    if (!isAiming || (phase !== "aiming" && phase !== "ready")) return;
    updateAimFromPointer(event);
  }

  function handlePointerUp() {
    if (!isAiming) return;
    isAiming = false;
  }

  function updateAimFromPointer(event: PointerEvent) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = BASE_WIDTH / rect.width;
    const scaleY = BASE_HEIGHT / rect.height;
    const pointerX = (event.clientX - rect.left) * scaleX;
    const pointerY = (event.clientY - rect.top) * scaleY;

    const dx = pointerX - currentSector.launchPos.x;
    const dy = pointerY - currentSector.launchPos.y;
    aimAngle = Math.atan2(dy, dx);
    const dist = Math.sqrt(dx * dx + dy * dy);
    aimPower = Math.max(180, Math.min(560, dist * 3.2));
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (event.code === "Space") {
      event.preventDefault();
      void audio.arm();
      if (phase === "aiming" || phase === "ready") {
        launchProbe();
      }
    } else if (phase === "flight") {
      if (event.code === "KeyW" || event.code === "ArrowUp") fireThrusterPulse(0, -1);
      else if (event.code === "KeyS" || event.code === "ArrowDown") fireThrusterPulse(0, 1);
      else if (event.code === "KeyA" || event.code === "ArrowLeft") fireThrusterPulse(-1, 0);
      else if (event.code === "KeyD" || event.code === "ArrowRight") fireThrusterPulse(1, 0);
    } else if (phase === "aiming" || phase === "ready") {
      if (event.code === "KeyW" || event.code === "ArrowUp") aimPower = Math.min(560, aimPower + 25);
      else if (event.code === "KeyS" || event.code === "ArrowDown") aimPower = Math.max(180, aimPower - 25);
      else if (event.code === "KeyA" || event.code === "ArrowLeft") aimAngle -= 0.08;
      else if (event.code === "KeyD" || event.code === "ArrowRight") aimAngle += 0.08;
    }
  }

  canvas.addEventListener("pointerdown", handlePointerDown);
  window.addEventListener("pointermove", handlePointerMove);
  window.addEventListener("pointerup", handlePointerUp);
  window.addEventListener("keydown", handleKeyDown);

  resetSector(0);
  running = true;
  lastTimestamp = performance.now();
  animationId = requestAnimationFrame(tick);

  return {
    start() {
      void audio.arm();
      if (phase === "ready" || phase === "aiming") {
        launchProbe();
      }
    },
    pause() {
      if (phase === "flight") phase = "paused";
    },
    resume() {
      if (phase === "paused") {
        phase = "flight";
        lastTimestamp = performance.now();
      }
    },
    restart() {
      score = 0;
      multiplier = 1;
      maxMultiplier = 1;
      slingshots = 0;
      beaconsCollectedTotal = 0;
      elapsed = 0;
      resetSector(0);
    },
    setMuted(muted: boolean) {
      audio.setMuted(muted);
    },
    fireThruster(dx: number, dy: number) {
      fireThrusterPulse(dx, dy);
    },
    setAim(angle: number, power: number) {
      aimAngle = angle;
      aimPower = Math.max(180, Math.min(560, power));
    },
    launch() {
      void audio.arm();
      launchProbe();
    },
    destroy() {
      running = false;
      cancelAnimationFrame(animationId);
      canvas.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("keydown", handleKeyDown);
      audio.destroy();
    },
  };
}
