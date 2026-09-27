import { useEffect, useId, useRef, useState } from "react";
import { useUnit } from "effector-react";
import { Gender, ItemKind, ITEM_NAMES, quickSlots, Vitals } from "@/lib/survival/rules";
import { RenderDistance, RENDER_DISTANCE_OPTIONS, terrainHeight } from "@/lib/survival/world";
import { $hasSave, $phase, $world, $saveAvailable, $session, $settings, $ready, loadSolo, newLife, persistSolo, phaseChanged, settingsChanged } from "@/stores/sandbox/sandbox";
import { SandboxRuntime, syncStream } from "../lib/runtime";
import { connectRoom, disconnectRoom, performAction } from "../lib/session";
import { muteAudio, startAudio } from "../lib/audio";
import packageJson from "../../../../package.json";

const ItemIcon = ({ kind }: { kind: ItemKind }) => {
  const paths: Record<ItemKind, string> = {
    stone: "M5 18 8 7l12-3 7 12-7 11H10Z", chopper: "m6 22 3-15 12-4 7 16-5-2-3 5-4-2-3 6Z", branch: "m9 28 11-24 3 1-11 25ZM15 16 7 9M18 12l9-3", spear: "M8 29 23 3l-2 9-5-3", fiber: "M8 28C4 17 13 15 10 3M14 28C20 17 9 12 18 3M20 28C17 15 26 15 24 5", cord: "M9 5c16-8 18 15 7 15S3 12 10 7c7-5 12 12 6 19", nut: "M10 6C-1 17 9 28 16 28S33 16 22 6Z M10 6l12 0M16 8v18", kernel: "M14 5C5 6 4 14 8 23c3 7 15 3 17-5S23 1 14 5Z", apple: "M16 9c-8-6-15 1-12 11 2 7 8 11 12 7 4 4 10 0 12-7 3-10-4-17-12-11ZM16 8c0-4 3-6 7-6M18 5c4-3 7-1 7 2-4 2-6 1-7-2Z", rawMeat: "M9 5c-8 2-6 20 3 22s18-9 15-16S18 3 9 5Z M11 11c6-7 17 8 9 10S6 17 11 11", hide: "m8 3 8 4 8-4-2 10 7 7-6 3 1 7-8-3-8 3 1-7-6-3 7-7Z", bag: "M6 12q10-7 20 0v15H6ZM10 12V7q6-8 12 0v5", backpack: "M7 8q9-7 18 0v20H7ZM11 7V4h10v3M10 17h12v8H10Z",
    flint: "M6 20 10 8l10-3 7 9-5 11-11 2ZM13 12l6 3", flake: "M7 24 20 5l6 7-13 14Z", handaxe: "M16 3 25 17l-4 11h-10L7 17Z M16 8v16",
    stick: "M7 27 25 5", twig: "M8 26 24 7M16 17l6 1M13 20l-2-6", dryGrass: "M10 28C9 18 12 10 9 3M15 28c0-10 2-17 0-25M20 28c1-9-2-16 3-24M25 27c-3-8 1-14-2-21",
    bone: "M9 9a3 3 0 1 1 3-4l10 14a3 3 0 1 1 4 5 3 3 0 1 1-5 1L11 11a3 3 0 1 1-2-2Z", boneShard: "M8 26 22 6l3 3-14 18Z", awl: "M7 28 25 4M22 7l3 1",
    hardSpear: "M8 29 23 3l-2 9-5-3M21 6l3 1", stoneSpear: "M8 29 21 8M20 3l6 1-3 7-5-2ZM18 12l-3-2", 
    blueberry: "M11 16a4 4 0 1 0 0.1 0M20 13a4 4 0 1 0 0.1 0M17 22a4 4 0 1 0 0.1 0", redberry: "M11 16a4 4 0 1 0 0.1 0M20 13a4 4 0 1 0 0.1 0M17 22a4 4 0 1 0 0.1 0M16 5v6",
    mushroom: "M4 16C5 6 27 6 28 16ZM13 16v10h6V16", toadstool: "M4 16C5 6 27 6 28 16ZM13 16v10h6V16M11 11h.1M18 9h.1M22 12h.1",
    termites: "M8 12h6M18 16h6M10 22h6M14 12a1 1 0 1 1 0 .1", grubs: "M8 14c2-5 8-5 9 0s-4 7-7 5M18 22c2-4 7-3 7 1",
    egg: "M16 4c-7 0-10 12-9 17s5 8 9 8 8-3 9-8S23 4 16 4Z", cookedEgg: "M16 4c-7 0-10 12-9 17s5 8 9 8 8-3 9-8S23 4 16 4ZM11 17l10 2",
    clam: "M4 20C6 8 26 8 28 20ZM16 10v10M10 12l3 8M22 12l-3 8", clamMeat: "M7 18c0-6 18-8 18 0s-18 6-18 0Z", marrow: "M6 20c2-9 18-11 20-2s-18 11-20 2ZM12 17h8",
    tuber: "M5 18c1-8 12-9 16-6 5-2 8 3 6 8-3 6-18 7-22-2ZM12 12l-2-6M16 11l1-6", roastedTuber: "M5 18c1-8 12-9 16-6 5-2 8 3 6 8-3 6-18 7-22-2ZM10 18h12",
    cookedMeat: "M9 5c-8 2-6 20 3 22s18-9 15-16S18 3 9 5ZM10 14l12 4", fish: "M4 16c6-8 16-8 20 0-4 8-14 8-20 0ZM24 16l5-5v10ZM9 15h.1", cookedFish: "M4 16c6-8 16-8 20 0-4 8-14 8-20 0ZM24 16l5-5v10ZM10 13l8 6",
    rotten: "M6 21c1-7 8-11 12-9 5-3 10 2 8 8-2 6-18 8-20 1ZM11 9c1-2 0-4 2-5M18 8c-1-2 1-3 0-5M24 11c1-2 3-2 3-4",
  };
  return <svg viewBox="0 0 32 32" width="31" height="31" fill="currentColor" fillOpacity=".12" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" aria-hidden="true"><path d={paths[kind]} /></svg>;
};

/** Short, stable, human-readable name of a seed for the menu and pause screen. */
const worldCode = (seed: number) => seed.toString(36).toUpperCase().padStart(7, "0");

const VitalDial = ({ vitals }: { vitals: Vitals }) => {
  const clip = useId().replace(/:/g, "");
  return <svg className="origin-vitals" viewBox="0 0 100 100" role="img" aria-label={`Здоровье ${Math.round(vitals.health)}, сытость ${Math.round(vitals.hunger)}, вода ${Math.round(vitals.thirst)}, силы ${Math.round(vitals.stamina)}`}>
    <defs><clipPath id={clip}><circle cx="50" cy="50" r="15" /></clipPath></defs>
    <circle cx="50" cy="50" r="42" fill="#182721" fillOpacity=".35" />
    <circle cx="50" cy="50" r="37" fill="none" stroke="#f0d477" strokeOpacity=".15" strokeWidth="3" />
    <circle cx="50" cy="50" r="37" fill="none" stroke="#dbc56b" strokeWidth="3" strokeLinecap="round" pathLength="100" strokeDasharray={`${vitals.stamina} 100`} transform="rotate(-90 50 50)" />
    <path d="M24 52 A26 26 0 0 0 76 52" stroke="#de974e" strokeOpacity=".15" strokeWidth="4" fill="none" />
    <path d="M24 52 A26 26 0 0 0 76 52" stroke="#de974e" strokeWidth="4" fill="none" strokeLinecap="round" pathLength="100" strokeDasharray={`${vitals.hunger} 100`} />
    <path d="M24 48 A26 26 0 0 1 76 48" stroke="#72aebc" strokeOpacity=".15" strokeWidth="4" fill="none" />
    <path d="M24 48 A26 26 0 0 1 76 48" stroke="#72aebc" strokeWidth="4" fill="none" strokeLinecap="round" pathLength="100" strokeDasharray={`${vitals.thirst} 100`} />
    <circle cx="50" cy="50" r="15" fill="#81483f" fillOpacity=".25" />
    <rect x="35" y={65 - vitals.health * 0.3} width="30" height={vitals.health * 0.3} fill="#b8584c" clipPath={`url(#${clip})`} />
    <circle cx="50" cy="50" r="15" fill="none" stroke="#e99a83" strokeOpacity=".35" strokeWidth=".7" />
  </svg>;
};

const MiniMap = ({ runtime, seed }: { runtime: SandboxRuntime; seed: number }) => {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const draw = () => {
      const ctx = canvas.current?.getContext("2d"); if (!ctx) return;
      for (let x = 0; x < 120; x += 3) for (let y = 0; y < 120; y += 3) {
        const h = terrainHeight(seed, runtime.pose.x + x - 60, runtime.pose.z + y - 60);
        ctx.fillStyle = h < 0 ? "#5d8583" : h > 5 ? "#b3ae8e" : "#68775d"; ctx.fillRect(x, y, 3, 3);
      }
      ctx.save(); ctx.translate(60, 60); ctx.rotate(-runtime.pose.yaw); ctx.fillStyle = "#f2e4c3"; ctx.beginPath(); ctx.moveTo(0, -6); ctx.lineTo(-3, 4); ctx.lineTo(3, 4); ctx.closePath(); ctx.fill(); ctx.restore();
    };
    draw(); const timer = setInterval(draw, 700); return () => clearInterval(timer);
  }, [runtime, seed]);
  return <canvas className="origin-map" ref={canvas} width="120" height="120" aria-label="Миникарта" />;
};

export const SandboxHud = ({ runtime }: { runtime: SandboxRuntime }) => {
  const [phase, world, session, settings, hasSave, canSave, ready] = useUnit([$phase, $world, $session, $settings, $hasSave, $saveAvailable, $ready]);
  const person = world.people[session.mode === "online" ? session.id : "local"];
  const [sheet, setSheet] = useState<"coop" | "settings" | "reset" | null>(new URLSearchParams(location.search).has("room") ? "coop" : null);
  const [name, setName] = useState("Человек"), [room, setRoom] = useState(new URLSearchParams(location.search).get("room") ?? "");
  const [error, setError] = useState(""), [busy, setBusy] = useState(false), [picked, setPicked] = useState<number | null>(null);
  const modal = useRef<HTMLDivElement>(null);
  // A short fade from black whenever the player leaves the menu for the world.
  const [curtain, setCurtain] = useState(0), lastPhase = useRef(phase);
  useEffect(() => { if (lastPhase.current === "menu" && phase !== "menu") setCurtain((value) => value + 1); lastPhase.current = phase; }, [phase]);
  useEffect(() => { muteAudio(!settings.sound || phase !== "playing"); }, [settings.sound, phase]);
  const dead = Boolean(person && person.vitals.health <= 0);
  // Release the captured mouse so the death screen can be used; FirstPerson does not pause the dead.
  useEffect(() => { if (dead && document.pointerLockElement) document.exitPointerLock(); }, [dead]);
  useEffect(() => {
    if (phase !== "paused" && phase !== "inventory" && !sheet) return;
    const previous = document.activeElement as HTMLElement | null;
    modal.current?.querySelector<HTMLElement>("input,button")?.focus();
    const trap = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const elements = modal.current?.querySelectorAll<HTMLElement>("button:not(:disabled),input"); if (!elements?.length) return;
      if (event.shiftKey && document.activeElement === elements[0]) { event.preventDefault(); elements[elements.length - 1].focus(); }
      else if (!event.shiftKey && document.activeElement === elements[elements.length - 1]) { event.preventDefault(); elements[0].focus(); }
    };
    window.addEventListener("keydown", trap); return () => { window.removeEventListener("keydown", trap); previous?.focus(); };
  }, [phase, sheet]);
  const resume = () => {
    startAudio(); muteAudio(!$settings.getState().sound); phaseChanged("playing");
    try { const result = document.querySelector<HTMLCanvasElement>(".shore canvas")?.requestPointerLock(); if (result) void result.catch(() => undefined); } catch { /* Right-drag/arrow fallback is silent. */ }
  };
  useEffect(() => {
    if (phase !== "paused" || sheet) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code === "Escape") { event.preventDefault(); resume(); }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [phase, sheet]);
  const solo = (fresh: boolean) => {
    disconnectRoom(); runtime.peers = [];
    if (fresh || !loadSolo()) newLife();
    const state = $world.getState(); Object.assign(runtime.pose, state.people.local.pose); runtime.pitch = -0.05; runtime.velocityY = 0; syncStream(runtime, state.seed, settings.renderDistance);
    setSheet(null); resume();
  };
  const menu = () => {
    if (session.mode === "solo") persistSolo($world.getState()); disconnectRoom(); runtime.peers = []; loadSolo(); phaseChanged("menu"); setSheet(null);
  };
  const join = async (create: boolean) => {
    setBusy(true); setError("");
    try { if (await connectRoom(name, create ? "" : room, settings.gender, runtime)) { setSheet(null); phaseChanged("paused"); } }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Нет соединения"); }
    finally { setBusy(false); }
  };
  const invite = async () => { const url = new URL(location.href); url.search = ""; url.searchParams.set("room", session.room); try { await navigator.clipboard.writeText(url.toString()); } catch { /* The room code remains visible. */ } };
  const clickSlot = (index: number) => {
    if (phase === "inventory") {
      if (picked === null) setPicked(index);
      else { void performAction({ type: "swap", from: picked, to: index }, runtime); setPicked(null); }
    } else void performAction({ type: "select", slot: index }, runtime);
  };
  const slots = (start: number, count: number) => person?.slots.slice(start, start + count).map((slot, offset) => {
    const index = start + offset;
    return <button key={index} className={`origin-slot ${picked === index || phase !== "inventory" && person.selected === index ? "selected" : ""}`} aria-label={`Ячейка ${index + 1}${slot ? `: ${ITEM_NAMES[slot.kind]}` : ": пусто"}`} aria-pressed={person.selected === index} onClick={() => clickSlot(index)}>{index < quickSlots(person) && <small>{index + 1}</small>}{slot && <ItemIcon kind={slot.kind} />}{slot && slot.durability < 100 && <i style={{ width: `${Math.max(0, slot.durability)}%` }} />}</button>;
  });
  return <div className="origin-ui">
    {phase === "menu" && <div className={`origin-menu ${sheet ? "dimmed" : ""}`}>
      <div className="origin-menu-shade" aria-hidden="true" />
      <div className="origin-grain" aria-hidden="true" />
      <header className="origin-menu-top">
        {hasSave && person && <span className="origin-menu-meta">
          <b>Мир {worldCode(world.seed)}</b>
        </span>}
      </header>
      <div className="origin-menu-content">
        <h1 className="origin-title" aria-label="Исток">{Array.from("Исток").map((letter, index) => <span key={index} aria-hidden="true" style={{ animationDelay: `${0.35 + index * 0.09}s` }}>{letter}</span>)}</h1>
        <p className="origin-tagline">До всего. Две руки, камни и мир, который ничего не объясняет.</p>
        <nav className="origin-menu-actions" aria-label="Главное меню">
          {[
            ...(hasSave ? [{ label: "Продолжить", run: () => solo(false), wait: true }] : []),
            { label: "Новая игра", run: () => hasSave ? setSheet("reset") : solo(true), wait: true },
            { label: "Многопользовательская игра", run: () => setSheet("coop"), wait: true },
            { label: "Настройки", run: () => setSheet("settings"), wait: false },
          ].map((entry, index) => <button key={entry.label} className={index === 0 ? "lead" : ""} disabled={entry.wait && !ready} style={{ animationDelay: `${0.9 + index * 0.08}s` }} onClick={entry.run}>
            <span className="origin-index" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span><span className="origin-label">{entry.label}</span>
          </button>)}
        </nav>
        {!ready && <p className="origin-waking" aria-live="polite">Мир просыпается…</p>}
      </div>
      <footer className="origin-menu-foot" aria-hidden="true"><span>Текущая версия игры: {packageJson.version}</span><span>Ранний прототип</span></footer>
    </div>}
    {curtain > 0 && <div key={curtain} className="origin-curtain" aria-hidden="true" />}
    {phase !== "menu" && person && <>
      {!person.sleeping && person.vitals.health > 0 && phase !== "inventory" && <div className="origin-hands" aria-label="Быстрые ячейки">{slots(0, quickSlots(person))}</div>}
      <VitalDial vitals={person.vitals} />
      {settings.minimap && !person.sleeping && <MiniMap runtime={runtime} seed={world.seed} />}
      {person.vitals.health < 35 && <div className="origin-hurt" style={{ opacity: (35 - person.vitals.health) / 55 }} />}
      {person.sickness > 5 && <div className="origin-sick" style={{ opacity: Math.min(0.7, person.sickness / 110) }} />}
      {person.sleeping && <div className="origin-sleep"><button onClick={() => { void performAction({ type: "wake" }, runtime).then((ok) => { if (ok) resume(); }); }}>Проснуться</button></div>}
      {person.vitals.health <= 0 && <div className="origin-dead"><h2>Тишина.</h2><button onClick={() => { void performAction({ type: "respawn" }, runtime).then((ok) => { if (ok) resume(); }); }}>Родиться заново</button><button onClick={menu}>В меню</button></div>}
    </>}
    {(phase === "paused" || phase === "inventory" || sheet) && <div className={`origin-backdrop ${phase === "menu" ? "from-menu" : phase === "inventory" ? "for-inventory" : "for-pause"}`}><div className={`origin-dialog ${phase === "inventory" ? "inventory" : ""} ${sheet === "settings" ? "settings" : ""} ${phase === "paused" && !sheet ? "pause" : ""}`} ref={modal} role="dialog" aria-modal="true" aria-labelledby="origin-dialog-title">
      {sheet === "settings" && <div className="origin-setting origin-distance-setting"><span id="origin-render-distance-label">Дальность прорисовки</span><div role="group" aria-labelledby="origin-render-distance-label">{(Object.keys(RENDER_DISTANCE_OPTIONS) as RenderDistance[]).map((distance) => <button key={distance} type="button" aria-pressed={settings.renderDistance === distance} className={settings.renderDistance === distance ? "chosen" : ""} onClick={() => settingsChanged({ ...settings, renderDistance: distance })}>{RENDER_DISTANCE_OPTIONS[distance].label}</button>)}</div></div>}
      {phase === "inventory" && person?.backpack ? <><header><h2 id="origin-dialog-title">Рюкзак</h2><button aria-label="Закрыть рюкзак" onClick={() => { setPicked(null); resume(); }}>×</button></header><div className="origin-pack-grid">{slots(9, 21)}</div><div className="origin-bag-grid">{slots(0, 9)}</div></> : sheet === "coop" ? <><h2 id="origin-dialog-title">Вместе.</h2><label>Имя<input value={name} maxLength={18} onChange={(event) => setName(event.target.value)} /></label><button className="origin-primary" disabled={busy} onClick={() => void join(true)}>{busy ? "…" : "Создать мир"}</button><label>Комната<input aria-label="Код комнаты" value={room} maxLength={6} onChange={(event) => setRoom(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))} /></label><button className="origin-primary" disabled={busy || room.length !== 6} onClick={() => void join(false)}>Войти</button>{error && <p className="origin-error" role="alert">{error}</p>}<button disabled={busy} onClick={() => { setSheet(null); setError(""); }}>Назад</button></> : sheet === "settings" ? <><h2 id="origin-dialog-title">Настройки</h2><div className="origin-setting"><span>Миникарта</span><button role="switch" aria-checked={settings.minimap} onClick={() => settingsChanged({ ...settings, minimap: !settings.minimap })}>{settings.minimap ? "Вкл" : "Выкл"}</button></div><div className="origin-setting"><span>Звук</span><button role="switch" aria-checked={settings.sound} onClick={() => settingsChanged({ ...settings, sound: !settings.sound })}>{settings.sound ? "Вкл" : "Выкл"}</button></div><div className="origin-setting"><span>Графика</span><button onClick={() => settingsChanged({ ...settings, quality: settings.quality === "high" ? "low" : "high" })}>{settings.quality === "high" ? "Высокая" : "Лёгкая"}</button></div><div className="origin-setting"><span>Новый персонаж</span><div>{(["male", "female"] as Gender[]).map((gender) => <button key={gender} aria-pressed={settings.gender === gender} className={settings.gender === gender ? "chosen" : ""} onClick={() => settingsChanged({ ...settings, gender })}>{gender === "male" ? "Мужчина" : "Женщина"}</button>)}</div></div><button onClick={() => setSheet(null)}>Назад</button></> : sheet === "reset" ? <><h2 id="origin-dialog-title">Новая жизнь</h2><p>Текущее одиночное сохранение будет заменено новым миром.</p><button className="origin-primary" onClick={() => solo(true)}>Начать</button><button onClick={() => setSheet(null)}>Отмена</button></> : <><p className="origin-kicker">{session.mode === "online" ? "Мир продолжает жить" : "Мир замер"}</p><h2 id="origin-dialog-title">Пауза</h2><button className="origin-primary" onClick={resume}>Продолжить</button><button className="origin-item" onClick={() => { void performAction({ type: "sleep" }, runtime).then((ok) => { if (ok) phaseChanged("playing"); }); }}><span className="origin-index" aria-hidden="true">01</span><span className="origin-label">Спать</span></button><button className="origin-item" onClick={() => setSheet("settings")}><span className="origin-index" aria-hidden="true">02</span><span className="origin-label">Настройки</span></button>{session.mode === "online" && <div className="origin-room"><span>{session.room} · {session.peers.length}/4</span><button onClick={() => void invite()}>Приглашение</button>{session.status === "lost" && <p>Связь прервана</p>}</div>}{!canSave && session.mode === "solo" && <p className="origin-error">Сохранение недоступно</p>}<button className="origin-item origin-leave" onClick={menu}><span className="origin-index" aria-hidden="true">03</span><span className="origin-label">{session.mode === "online" ? "Покинуть мир" : "В меню"}</span></button><p className="origin-world-code" aria-hidden="true">Мир {worldCode(world.seed)}</p></>}
    </div></div>}
  </div>;
};
