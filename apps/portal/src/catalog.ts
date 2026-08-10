export type Game = {
  slug: string;
  eyebrow: string;
  title: string;
  description: string;
  genre: string;
  session: string;
  mode: "visual-gate" | "concept";
  accent: string;
  tags: string[];
  playable?: boolean;
};

export const games: Game[] = [
  {
    slug: "gravity-courier",
    eyebrow: "Featured / Visual Gate 01",
    title: "Gravity Courier",
    description: "Thread a luminous courier craft through collapsing orbital machinery. Trade safe lines for impossible multipliers.",
    genre: "Precision flight",
    session: "2–4 min",
    mode: "visual-gate",
    accent: "amber",
    tags: ["3D", "Skill", "Visual gate"],
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
