export type Game = {
  slug: string;
  eyebrow: string;
  title: string;
  description: string;
  genre: string;
  session: string;
  mode: "production" | "visual-gate" | "concept";
  accent: string;
  tags: string[];
  playable?: boolean;
};

export const games: Game[] = [
  {
    slug: "gravity-courier",
    eyebrow: "Featured / Production Flight 01",
    title: "Gravity Courier",
    description: "Thread a luminous courier craft through collapsing orbital machinery. Trade safe lines for impossible multipliers.",
    genre: "Precision flight",
    session: "2 min",
    mode: "production",
    accent: "amber",
    tags: ["3D", "Skill", "Daily route"],
    playable: true
  },
  {
    slug: "orbital-slingshot",
    eyebrow: "Featured / Production Flight 02",
    title: "Orbital Slingshot",
    description: "Plot gravitational slingshots through collapsing star systems. Harness orbital velocity to collect telemetry and dock with extraction gates.",
    genre: "Orbital mechanics",
    session: "2 min",
    mode: "production",
    accent: "cyan",
    tags: ["2D", "Gravity physics", "Daily route"],
    playable: true
  },
  {
    slug: "echo-vector",
    eyebrow: "Phase Candidate / Temporal Trial 01",
    title: "Echo Vector",
    description: "Your previous runs return as temporal echoes—sometimes allies, sometimes moving hazards you authored yourself.",
    genre: "Temporal tactics",
    session: "3 min",
    mode: "visual-gate",
    accent: "cyan",
    tags: ["2D", "Temporal", "Mastery"],
    playable: true
  },
  {
    slug: "prism-siege",
    eyebrow: "Concept 03",
    title: "Prism Siege",
    description: "Rotate a living prism to refract hostile light into chain reactions across a reactive arena.",
    genre: "Arena puzzler",
    session: "4–6 min",
    mode: "concept",
    accent: "violet",
    tags: ["2.5D", "Combos", "Endless"]
  }
];
