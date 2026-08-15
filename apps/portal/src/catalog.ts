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
    slug: "orbital-pinball",
    eyebrow: "Featured / Visual Prototype 02",
    title: "Orbital Pinball",
    description: "Frameless pinball suspended in open space. Keep a relay field alive through precision flipper play, node banks, orbital loops, and escalating chains.",
    genre: "Kinetic 3D pinball",
    session: "3 min",
    mode: "visual-gate",
    accent: "cyan",
    tags: ["3D", "Physics", "Skill"],
    playable: true
  },
  {
    slug: "echo-vector",
    eyebrow: "Concept 02",
    title: "Echo Vector",
    description: "Your previous runs return as temporal echoes—sometimes allies, sometimes moving hazards you authored yourself.",
    genre: "Rhythm tactics",
    session: "3 min",
    mode: "concept",
    accent: "cyan",
    tags: ["2D", "Rhythm", "Mastery"]
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
