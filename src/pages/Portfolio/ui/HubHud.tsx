import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useUnit } from "effector-react";
import styled from "styled-components";
import { BEACONS, CAMP, CRYSTALS, DAWN_DRIVE_UPGRADE, energyLeft, hasUpgrade } from "@/lib/expedition";
import { $expedition, $expeditionNotice, $saveAvailable } from "@/stores/expedition/expedition";
import { TownState } from "../lib/state";
import { resetControls } from "../lib/controls";

const Root = styled.div`
  position: fixed; inset: 0; pointer-events: none; z-index: 40;
  color: #f4f0e5; font-family: "Exo 2", sans-serif;
  button { pointer-events: auto; cursor: pointer; font: inherit; color: inherit; border: 1px solid #ffffff30; background: #ffffff0d; border-radius: 8px; padding: 8px 12px; }
  button:hover { background: #ffffff24; }
  button:focus-visible { outline: 2px solid #ffcf82; outline-offset: 3px; }
`;
const Panel = styled.section`
  position: absolute; top: 22px; left: 22px; width: 290px; padding: 20px;
  border: 1px solid #ffffff26; border-radius: 16px; background: rgb(16 32 39 / var(--hud-opacity, .55)); backdrop-filter: blur(6px);
  box-shadow: 0 12px 40px #10232924;
  h1 { font-size: 22px; margin: 5px 0 10px; }
  p { font-size: 13px; line-height: 1.5; margin: 10px 0; color: #cedbd6; }
  small { color: #ffc980; font-size: 10px; letter-spacing: .18em; }
  progress { width: 100%; height: 6px; accent-color: #8de2bd; }
  @media(max-width: 650px) { top: 10px; left: 10px; width: 230px; padding: 12px; h1 { font-size: 18px; } }
`;
const MiniMap = styled.aside`
  position: absolute; right: 22px; top: 22px; width: 176px; aspect-ratio: 1; padding: 8px;
  border: 1px solid #ffffff26; border-radius: 50%; overflow: hidden;
  background: rgb(16 32 39 / var(--hud-opacity, .55)); backdrop-filter: blur(6px);
  box-shadow: 0 12px 40px #10232924;
  svg { display: block; width: 100%; height: 100%; border-radius: 50%; background: rgb(52 97 94 / calc(var(--hud-opacity, .55) * .5)); }
  @media(max-width: 650px) { top: 10px; right: 10px; width: 118px; padding: 6px; }
`;
const Footer = styled.div`
  position: absolute; bottom: 20px; left: 50%; transform: translateX(-50%);
  max-width: calc(100vw - 30px); width: max-content; border-radius: 12px; padding: 12px 18px;
  background: rgb(16 32 39 / var(--hud-opacity, .55)); backdrop-filter: blur(6px); text-align: center; font-size: 12px; line-height: 1.8;
  strong { color: #ffce84; } span { color: #cedbd6; }
`;
const Speed = styled.div`
  position: absolute; right: 24px; bottom: 22px; min-width: 104px; text-align: right;
  color: #f7ead0; font-size: 25px; font-variant-numeric: tabular-nums;
  text-shadow: 0 2px 12px #102329aa;
  small { display: block; color: #c2d8d0; font-size: 9px; letter-spacing: .18em; }
`;

const PauseLayer = styled.div`
  position: absolute; inset: 0; display: grid; place-items: center; pointer-events: auto;
  background: rgb(7 17 24 / calc(var(--hud-opacity, .55) * .5));
`;
const PauseCard = styled.section`
  width: min(420px, calc(100vw - 40px)); max-height: calc(100dvh - 40px); overflow: auto;
  padding: 30px; border-radius: 22px; border: 1px solid #ffffff35;
  background: rgb(16 32 39 / var(--hud-opacity, .55)); backdrop-filter: blur(8px);
  box-shadow: 0 24px 90px #0003;
  h2 { margin: 7px 0 24px; font-size: 30px; font-weight: 500; }
  h3 { font-size: 12px; font-weight: 500; color: #b7cfc8; margin: 24px 0 12px; letter-spacing: .1em; }
  small { color: #b7cfc8; font-size: 11px; letter-spacing: .2em; }
  label { display: flex; justify-content: space-between; font-size: 14px; }
  input { width: 100%; accent-color: #b7e6d4; margin: 18px 0 0; cursor: pointer; }
  dl { display: grid; grid-template-columns: 110px 1fr; gap: 12px; font-size: 13px; line-height: 1.4; }
  dt { color: #eed3a3; } dd { margin: 0; color: #e1ebe6; }
  > button { width: 100%; margin-top: 20px; padding: 12px; }
`;
const readTransparency = () => {
  try { const raw = localStorage.getItem("portfolio:hud-transparency"); const value = raw === null ? 45 : Number(raw); return Number.isFinite(value) ? Math.max(0, Math.min(85, value)) : 45; }
  catch { return 45; }
};
export const HubHud = ({ state }: { state: TownState }) => {
  const [save, notice, canSave] = useUnit([$expedition, $expeditionNotice, $saveAvailable]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [transparency, setTransparency] = useState(readTransparency);
  const menuRef = useRef<HTMLElement>(null);
  const mapContent = useRef<SVGGElement>(null);
  const navigation = useRef<HTMLParagraphElement>(null);
  const prompt = useRef<HTMLDivElement>(null);
  const speed = useRef<HTMLSpanElement>(null);
  const target = BEACONS.find((beacon) => !save.restored.includes(beacon.id)) ?? BEACONS[0];
  useLayoutEffect(() => {
    state.paused = menuOpen;
    resetControls();
    if (!menuOpen) return;
    const previous = document.activeElement as HTMLElement | null;
    menuRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
    return () => { state.paused = false; resetControls(); previous?.focus(); };
  }, [state, menuOpen]);
  useEffect(() => {
    document.documentElement.style.setProperty("--hud-opacity", String(1 - transparency / 100));
    try { localStorage.setItem("portfolio:hud-transparency", String(transparency)); } catch { /* Settings remain usable without storage. */ }
    return () => { document.documentElement.style.removeProperty("--hud-opacity"); };
  }, [transparency]);
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (event.repeat) return;
      if (event.code === "Escape") { event.preventDefault(); setMenuOpen((open) => !open); }
      if (event.code === "Tab" && state.paused) {
        const elements = menuRef.current?.querySelectorAll<HTMLElement>("button, input");
        if (!elements?.length) return;
        const first = elements[0], last = elements[elements.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [state]);
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const { x, z } = state.player;
      if (speed.current) speed.current.textContent = String(Math.round(Math.abs(state.player.speed) * 3.6)).padStart(2, "0");
      const mapAngle = (state.cameraFacing - Math.PI) * 180 / Math.PI;
      mapContent.current?.setAttribute("transform", `rotate(${mapAngle}) translate(${-x} ${-z})`);
      const allLit = save.restored.length === BEACONS.length;
      const destination = allLit ? CAMP : target;
      const dx = destination.x - x, dz = destination.z - z;
      const direction = ["С", "СВ", "В", "ЮВ", "Ю", "ЮЗ", "З", "СЗ"][(Math.round(Math.atan2(dx, -dz) / (Math.PI / 4)) + 8) % 8];
      if (navigation.current) navigation.current.textContent = `${destination.name} · ${Math.round(Math.hypot(dx, dz))} м · ${direction}`;
      const nearby = BEACONS.find((beacon) => Math.hypot(beacon.x - x, beacon.z - z) < 4);
      if (prompt.current) prompt.current.textContent = nearby ? (save.restored.includes(nearby.id) ? `${nearby.name} · маяк восстановлен` : `F · Зажечь «${nearby.name}» · 3 энергии`) : Math.hypot(x - CAMP.x, z - CAMP.z) < 4 ? (allLit ? "F · Завершить экспедицию" : "Лагерь · найдите пять маяков") : "Подойдите к парящему кристаллу, чтобы собрать энергию";
      raf = requestAnimationFrame(tick);
    };
    tick(); return () => cancelAnimationFrame(raf);
  }, [state, target, save]);
  return <Root data-hud>
    <Panel aria-label="Журнал экспедиции" style={{ visibility: menuOpen ? "hidden" : "visible" }}>
      <small>ЭКСПЕДИЦИЯ 01 / ОТКРЫТЫЙ МИР</small>
      <h1>Хранители маяков</h1>
      <div>◈ {energyLeft(save)} энергии <span> · </span> {save.restored.length}/5 маяков</div>
      <progress aria-label="Восстановленные маяки" value={save.restored.length} max={5} />
      <p>{save.completed ? "Долина спасена. Продолжайте исследовать мир." : "Собирайте осколки, зажгите пять маяков и вернитесь к огню лагеря."}</p>
      {hasUpgrade(save, DAWN_DRIVE_UPGRADE) && <p><b>Форсированный привод:</b> тяга +18%, скорость +15%</p>}
      <p ref={navigation} />
      <button onClick={() => setMenuOpen(true)}>Esc</button>
      <p role="status" aria-live="polite">{notice}</p>
      <small>{canSave ? "ПРОГРЕСС СОХРАНЯЕТСЯ" : "СОХРАНЕНИЕ НЕДОСТУПНО"}</small>
    </Panel>
    {!menuOpen && <MiniMap aria-label="Мини-карта экспедиции">
      <svg viewBox="-58 -58 116 116" role="img" aria-label="Маяки, осколки и положение игрока. Верх совпадает с направлением камеры.">
        <defs><clipPath id="mini-map-circle"><circle r="57" /></clipPath></defs>
        <g clipPath="url(#mini-map-circle)">
          <g ref={mapContent}>
            {[-160, -120, -80, -40, 0, 40, 80, 120, 160].map((n) => <g key={n} stroke="#ffffff12"><path d={`M ${n} -160 V 160 M -160 ${n} H 160`} /></g>)}
            {CRYSTALS.filter((c) => !save.collected.includes(c.id)).map((c) => <circle key={c.id} cx={c.x} cy={c.z} r="1.7" fill="#8de2bd" />)}
            <rect x={CAMP.x - 2.5} y={CAMP.z - 2.5} width="5" height="5" fill="#ffce84" />
            {BEACONS.map((b) => <circle key={b.id} cx={b.x} cy={b.z} r={target.id === b.id ? 5 : 3.8} fill={save.restored.includes(b.id) ? b.color : "#28484d"} stroke={b.color} strokeWidth={target.id === b.id ? 1.8 : 1} />)}
          </g>
          <circle r="3.8" fill="#fff" stroke="#132b31" strokeWidth="1.8" />
          <path d="M 0 -55 L -3.5 -48 L 3.5 -48 Z" fill="#ffce84" />
        </g>
      </svg>
    </MiniMap>}
    {!menuOpen && <Footer><div ref={prompt} /></Footer>}
    {menuOpen && <PauseLayer><PauseCard ref={menuRef} role="dialog" aria-modal="true" aria-labelledby="pause-title">
      <small>ХРАНИТЕЛИ МАЯКОВ</small><h2 id="pause-title">Пауза</h2>
      <label htmlFor="hud-transparency">Прозрачность панелей <output>{transparency}%</output></label>
      <input id="hud-transparency" type="range" min="0" max="85" step="5" value={transparency} onChange={(event) => setTransparency(Number(event.target.value))} />
      <h3>УПРАВЛЕНИЕ</h3>
      <dl><dt>WASD / стрелки</dt><dd>Газ, тормоз и поворот</dd><dt>Пробел</dt><dd>Ручник и управляемый занос</dd><dt>F</dt><dd>Восстановить маяк / завершить экспедицию</dd><dt>R</dt><dd>Вернуться в лагерь</dd><dt>Escape</dt><dd>Пауза / продолжить</dd></dl>
      <button onClick={() => setMenuOpen(false)}>Продолжить путешествие</button>
    </PauseCard></PauseLayer>}
    {!menuOpen && <Speed><span ref={speed}>00</span><small>КМ/Ч</small></Speed>}
  </Root>;
};
