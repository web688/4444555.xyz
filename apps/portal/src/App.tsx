import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { games } from "./catalog";
import { GRAVITY_COURIER_PROGRESS_EVENT, loadCourierProgress, type CourierProgress } from "./games/gravity-courier/progress";
import { ORBITAL_SLINGSHOT_PROGRESS_EVENT, loadSlingshotProgress, type SlingshotProgress } from "./games/orbital-slingshot/progress";

const Arrow = () => <span aria-hidden="true">↗</span>;
const GravityCourierGate = lazy(() => import("./games/gravity-courier/GravityCourierGate"));
const OrbitalSlingshotGate = lazy(() => import("./games/orbital-slingshot/OrbitalSlingshotGate"));
const HullwatchGate = lazy(() => import("./games/hullwatch/HullwatchGate"));

export function App() {
  const [query, setQuery] = useState("");
  const [activeGame, setActiveGame] = useState<string | null>(null);
  const [courierProgress, setCourierProgress] = useState(loadCourierProgress);
  const [slingshotProgress, setSlingshotProgress] = useState(loadSlingshotProgress);

  useEffect(() => {
    const syncCourier = (event?: Event) => {
      const detail = (event as CustomEvent<CourierProgress> | undefined)?.detail;
      setCourierProgress(detail ?? loadCourierProgress());
    };
    const syncSlingshot = (event?: Event) => {
      const detail = (event as CustomEvent<SlingshotProgress> | undefined)?.detail;
      setSlingshotProgress(detail ?? loadSlingshotProgress());
    };
    window.addEventListener(GRAVITY_COURIER_PROGRESS_EVENT, syncCourier);
    window.addEventListener(ORBITAL_SLINGSHOT_PROGRESS_EVENT, syncSlingshot);
    window.addEventListener("storage", syncCourier);
    window.addEventListener("storage", syncSlingshot);
    return () => {
      window.removeEventListener(GRAVITY_COURIER_PROGRESS_EVENT, syncCourier);
      window.removeEventListener(ORBITAL_SLINGSHOT_PROGRESS_EVENT, syncSlingshot);
      window.removeEventListener("storage", syncCourier);
      window.removeEventListener("storage", syncSlingshot);
    };
  }, []);
  const visibleGames = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return games;
    return games.filter((game) =>
      [game.title, game.description, game.genre, ...game.tags].join(" ").toLowerCase().includes(needle)
    );
  }, [query]);

  return (
    <div className="site-shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="4444555 home">
          <span className="brand-mark">44</span><span>44555</span>
        </a>
        <nav aria-label="Primary navigation">
          <a href="#games">Games</a><a href="#gate">Production</a><a href="#foundation">Foundation</a>
        </nav>
        <button className="profile-button" disabled title="Accounts arrive in the backend phase">
          <span className="presence" /> Player profile <span className="soon">Soon</span>
        </button>
      </header>

      <main id="top">
        <section className="hero">
          <div className="hero-copy">
            <p className="kicker"><span /> A new browser arcade is entering orbit</p>
            <h1>Short sessions.<br /><em>Serious worlds.</em></h1>
            <p className="hero-lede">Original, mastery-driven games built for the browser—with cinematic art direction, tactile controls, and scores worth chasing.</p>
            <div className="hero-actions">
              <a className="primary-action" href="#games">Explore the lineup <Arrow /></a>
              <a className="text-action" href="#gate">See how quality is proven</a>
            </div>
            <dl className="hero-facts">
              <div><dt>01</dt><dd>Production game<br />now playable</dd></div>
              <div><dt>03</dt><dd>Launch-ready<br />game directions</dd></div>
              <div><dt>15 MB</dt><dd>First-load target<br />for the 3D slice</dd></div>
            </dl>
          </div>

          <div className="orbit-stage" aria-label="Abstract visualization of the Gravity Courier world">
            <div className="ambient ambient-one" /><div className="ambient ambient-two" />
            <div className="orbit orbit-one" /><div className="orbit orbit-two" /><div className="orbit orbit-three" />
            <div className="planet"><div className="planet-shine" /><div className="planet-shadow" /></div>
            <div className="courier"><span className="wing left" /><span className="core" /><span className="wing right" /><span className="trail" /></div>
            <div className="signal signal-a" /><div className="signal signal-b" /><div className="signal signal-c" />
            <div className="stage-label"><small>Incoming transmission</small><strong>GRAVITY COURIER</strong><span>Production flight online</span></div>
            <div className="coordinates">45° 07′ 12″ N<br />ORBITAL LANE / 04</div>
          </div>
        </section>

        <section className="catalog section" id="games">
          <div className="section-heading">
            <div><p className="section-index">01 / DISCOVER</p><h2>Choose your next obsession.</h2></div>
            <label className="search"><span aria-hidden="true">⌕</span><span className="sr-only">Search games</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search worlds, genres, skills…" /></label>
          </div>
          <div className="game-grid" aria-live="polite">
            {visibleGames.map((game, index) => (
              <article className={`game-card ${game.accent}`} key={game.slug}>
                <div className="card-art" aria-hidden="true"><div className="art-grid" /><div className="art-object" /><span className="card-number">0{index + 1}</span><span className="status">{game.mode === "production" ? "Playable production" : game.mode === "visual-gate" ? "In visual gate" : "In concept"}</span></div>
                <div className="card-body">
                  <p className="card-eyebrow">{game.eyebrow}</p><h3>{game.title}</h3><p>{game.description}</p>
                  {game.slug === "gravity-courier" && (
                    <section className="flight-record" aria-label="Gravity Courier local flight record">
                      <div><span>LOCAL BEST</span><strong>{courierProgress.bestScore.toLocaleString("en-US").padStart(7, "0")}</strong></div>
                      <div><span>DELIVERIES</span><strong>{courierProgress.deliveries} / {courierProgress.totalRuns}</strong></div>
                      <div className="recent-runs"><span>RECENT</span>{courierProgress.recentRuns.length === 0 ? <small>NO RUNS YET</small> : courierProgress.recentRuns.slice(0, 3).map((run) => <i className={run.medal} key={run.id} title={`${run.medal} · ${run.score.toLocaleString("en-US")}`}>{run.score.toLocaleString("en-US")}</i>)}</div>
                    </section>
                  )}
                  {game.slug === "orbital-slingshot" && (
                    <section className="flight-record" aria-label="Orbital Slingshot local flight record">
                      <div><span>LOCAL BEST</span><strong>{slingshotProgress.bestScore.toLocaleString("en-US").padStart(7, "0")}</strong></div>
                      <div><span>INSERTIONS</span><strong>{slingshotProgress.insertions} / {slingshotProgress.totalRuns}</strong></div>
                      <div className="recent-runs"><span>RECENT</span>{slingshotProgress.recentRuns.length === 0 ? <small>NO RUNS YET</small> : slingshotProgress.recentRuns.slice(0, 3).map((run) => <i className={run.medal} key={run.id} title={`${run.medal} · ${run.score.toLocaleString("en-US")}`}>{run.score.toLocaleString("en-US")}</i>)}</div>
                    </section>
                  )}
                  <div className="tag-row">{game.tags.map((tag) => <span key={tag}>{tag}</span>)}</div>
                  <footer><span>{game.genre}</span><span>{game.session}</span><button aria-label={game.playable ? `Launch ${game.title}` : `View ${game.title} concept`} disabled={!game.playable} onClick={() => game.playable && setActiveGame(game.slug)}><Arrow /></button></footer>
                </div>
              </article>
            ))}
          </div>
          {visibleGames.length === 0 && <p className="empty-state">No signal found. Try a different search.</p>}
        </section>

        <section className="gate section" id="gate">
          <div className="gate-copy"><p className="section-index">02 / PRODUCTION BATCH 01</p><h2>The gate is open.</h2><p>The accepted flight feel now supports a complete two-minute run: four escalating sectors, deterministic daily routes, real failure, medals, instant retry, and a local pilot record.</p><a className="text-action light" href="#foundation">Inspect the platform boundary <Arrow /></a></div>
          <ol className="gate-list">
            <li><span>01</span><div><strong>Accepted flight language</strong><p>Cinematic orbital depth, readable warning marks, direct steering, and restrained motion particles.</p></div><b>Locked</b></li>
            <li><span>02</span><div><strong>A complete production run</strong><p>Launch, escalating hazards, near-miss chains, hull failure, delivery, medal, and a clean reset.</p></div><b>Playable</b></li>
            <li><span>03</span><div><strong>Progress that survives exit</strong><p>Best score, deliveries, medals, and recent runs remain on this device while account sync waits for the backend phase.</p></div><b>Local</b></li>
          </ol>
        </section>

        <section className="foundation section" id="foundation">
          <div className="section-heading"><div><p className="section-index">03 / PLATFORM</p><h2>Every game, one language.</h2></div><p>The production prototype now proves lifecycle and device persistence. Identity, account sync, and trusted global scores remain behind the same host boundary.</p></div>
          <div className="contract-grid">
            {[["LIFECYCLE","Mount, ready, pause, resume, exit and teardown."],["PLAYER","Identity and settings arrive through a narrow host context."],["PROGRESS","Scores, achievements, saves and stats use versioned claims."],["TRUST","Run tickets and replay evidence prepare server-side validation."]].map(([label, copy]) => <div className="contract" key={label}><span>{label}</span><p>{copy}</p></div>)}
          </div>
        </section>
      </main>
      <footer className="site-footer"><a className="brand" href="#top"><span className="brand-mark">44</span><span>44555</span></a><p>Foundation 0.1 · Built to add worlds without rebuilding the universe.</p><span>© 2026</span></footer>
      {activeGame === "gravity-courier" && (
        <Suspense fallback={<div className="gate-loading" role="status"><span />Loading orbital lane…</div>}>
          <GravityCourierGate onExit={() => setActiveGame(null)} />
        </Suspense>
      )}
      {activeGame === "orbital-slingshot" && (
        <Suspense fallback={<div className="gate-loading" role="status"><span />Loading orbital trajectory…</div>}>
          <OrbitalSlingshotGate onExit={() => setActiveGame(null)} />
        </Suspense>
      )}
      {activeGame === "hullwatch" && (
        <Suspense fallback={<div className="gate-loading" role="status"><span />Loading defense station…</div>}>
          <HullwatchGate onExit={() => setActiveGame(null)} />
        </Suspense>
      )}
    </div>
  );
}
