import { randomBytes } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin } from "vite";
import { applyAction, freshWorld, freshPerson, nearFire, poseAllowed, settleDeaths, stepMatter, stepVitals, stepWildlife } from "../src/lib/survival/rules";
import type { WorldState, Peer, WorldAction } from "../src/lib/survival/rules";

interface Member { peer: Peer; token: string; lastSeen: number; lastAction: number; stream?: ServerResponse }
interface Room { state: WorldState; members: Map<string, Member>; touched: number }
const COLORS = ["#e8ad63", "#6cc7bf", "#c9a3cf", "#91b575"];

/** Same-origin, server-authoritative SSE rooms for development and production preview. */
export const coopPlugin = (): Plugin => {
  const rooms = new Map<string, Room>();
  const payload = (room: Room) => ({ state: room.state, peers: Array.from(room.members.values()).map((m) => m.peer) });
  const publish = (room: Room, event: string, data: unknown) => {
    const packet = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    room.members.forEach((member) => { if (member.stream && !member.stream.destroyed) member.stream.write(packet); });
  };
  const removeMember = (room: Room, id: string) => {
    const member = room.members.get(id), person = room.state.people[id];
    if (person) person.slots.forEach((item, index) => { if (item) room.state.drops.push({ id: `leave:${id}:${index}`, item, x: person.pose.x + Math.cos(index) * 0.5, z: person.pose.z + Math.sin(index) * 0.5 }); });
    delete room.state.people[id]; room.state.revision++;
    member?.stream?.end(); room.members.delete(id); room.touched = Date.now();
  };
  const handler = (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    if (!url.pathname.startsWith("/api/coop")) { next(); return; }
    const reply = (code: number, data: unknown) => { res.writeHead(code, { "Content-Type": "application/json", "Cache-Control": "no-store" }); res.end(JSON.stringify(data)); };
    if (req.method === "GET" && url.pathname === "/api/coop/health") { reply(200, { available: true }); return; }
    const find = () => {
      const room = rooms.get(url.searchParams.get("room") ?? "");
      const member = room?.members.get(url.searchParams.get("id") ?? "");
      return member?.token === url.searchParams.get("token") ? { room, member } : {};
    };
    if (req.method === "GET" && url.pathname === "/api/coop/events") {
      const { room, member } = find();
      if (!room || !member) { reply(401, { error: "Комната закрыта. Подключитесь заново." }); return; }
      member.stream?.end();
      res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive", "X-Accel-Buffering": "no" });
      res.write(`event: world\ndata: ${JSON.stringify(payload(room))}\n\n`);
      member.stream = res; member.lastSeen = Date.now();
      req.on("close", () => { if (member.stream === res) member.stream = undefined; });
      return;
    }
    if (req.method !== "POST") { reply(404, { error: "Неизвестный запрос" }); return; }
    if (!req.headers["content-type"]?.startsWith("application/json") || (req.headers.origin && new URL(req.headers.origin).host !== req.headers.host)) { reply(403, { error: "Недопустимый источник запроса" }); return; }
    let body = "";
    req.on("data", (chunk: Buffer) => { body += chunk.toString(); if (body.length > 4096) req.destroy(); });
    req.on("end", () => {
      try {
        const data = JSON.parse(body);
        if (url.pathname === "/api/coop/join") {
          const code = typeof data.room === "string" ? data.room.trim().toUpperCase() : "";
          if (code && !/^[A-Z0-9]{6}$/.test(code)) { reply(400, { error: "Код комнаты состоит из 6 символов" }); return; }
          if (!code && rooms.size >= 50) { reply(503, { error: "Сервер заполнен. Попробуйте позже." }); return; }
          const roomCode = code || randomBytes(3).toString("hex").toUpperCase();
          let room = rooms.get(roomCode);
          if (code && !room) { reply(404, { error: "Комната не найдена. Проверьте код." }); return; }
          if (!room) { const state = freshWorld(); state.people = {}; room = { state, members: new Map(), touched: Date.now() }; rooms.set(roomCode, room); }
          if (room.members.size >= 4) { reply(409, { error: "В комнате уже четыре исследователя" }); return; }
          const id = randomBytes(8).toString("hex"), token = randomBytes(24).toString("hex");
          const person = freshPerson(room.state.seed, data.gender === "female" ? "female" : "male");
          person.pose.x += room.members.size * 1.4;
          room.state.people[id] = person;
          const peer: Peer = { id, name: typeof data.name === "string" ? data.name.replace(/[<>\x00-\x1f]/g, "").trim().slice(0, 18) || "Человек" : "Человек", color: COLORS[room.members.size], gender: person.gender, ...person.pose };
          room.members.set(id, { peer, token, lastSeen: Date.now(), lastAction: 0 }); room.touched = Date.now();
          publish(room, "world", payload(room)); reply(200, { room: roomCode, id, token, ...payload(room) }); return;
        }
        const { room, member } = find();
        if (!room || !member) { reply(401, { error: "Соединение с комнатой потеряно" }); return; }
        const now = Date.now();
        if (url.pathname === "/api/coop/leave") {
          removeMember(room, member.peer.id); publish(room, "world", payload(room)); reply(200, { ok: true }); return;
        }
        if (url.pathname === "/api/coop/pose") {
          const pose = data.pose;
          if (!pose || ![pose.x, pose.y, pose.z, pose.yaw].every((n) => typeof n === "number" && Number.isFinite(n))) { reply(400, { error: "Некорректная позиция" }); return; }
          if (!poseAllowed(room.state.seed, member.peer, pose, (now - member.lastSeen) / 1000)) {
            // Not an error: the client is alive but out of sync, so it snaps back to the authoritative pose.
            member.lastSeen = now;
            const { x, y, z, yaw } = member.peer; reply(200, { ok: false, pose: { x, y, z, yaw } }); return;
          }
          Object.assign(member.peer, { x: pose.x, y: pose.y, z: pose.z, yaw: pose.yaw, moving: pose.moving === true, sprinting: pose.sprinting === true }); member.lastSeen = now; room.touched = now;
          room.state.people[member.peer.id].pose = { ...member.peer };
          publish(room, "peers", payload(room).peers); reply(200, { ok: true }); return;
        }
        if (url.pathname === "/api/coop/action") {
          if (now - member.lastAction < 180) { reply(429, { error: "Слишком быстро" }); return; }
          member.lastAction = now;
          const result = applyAction(room.state, member.peer.id, data.action as WorldAction, member.peer);
          room.state = result.state; room.touched = now;
          const reborn = result.ok && data.action?.type === "respawn" ? room.state.people[member.peer.id]?.pose : undefined;
          if (reborn) { Object.assign(member.peer, { x: reborn.x, y: reborn.y, z: reborn.z, yaw: reborn.yaw, moving: false, sprinting: false }); member.lastSeen = now; }
          if (result.ok) publish(room, "world", payload(room));
          reply(200, { ok: result.ok, effect: result.effect, ...(reborn ? { pose: reborn } : {}) }); return;
        }
        reply(404, { error: "Неизвестное действие" });
      } catch { if (!res.headersSent) reply(400, { error: "Некорректный запрос" }); }
    });
  };
  const attach = (server: { middlewares: { use: (fn: typeof handler) => unknown }; httpServer: { once: (event: string, cb: () => void) => unknown } | null }) => {
    server.middlewares.use(handler);
    const timer = setInterval(() => {
      rooms.forEach((room, code) => {
        let changed = false;
        room.members.forEach((member, id) => {
          if (Date.now() - member.lastSeen > 20000) { removeMember(room, id); changed = true; }
          else { const person = room.state.people[id]; if (person) room.state.people[id] = stepVitals(person, 1, member.peer.moving, member.peer.sprinting, nearFire(room.state, member.peer)); }
        });
        const settled = settleDeaths(stepMatter(room.state, 1));
        if (settled !== room.state) { room.state = settled; changed = true; }
        if (changed) publish(room, "world", payload(room));
        if (room.members.size) { room.state = stepWildlife(room.state, Array.from(room.members.values()).map((member) => member.peer), 1); publish(room, "world", payload(room)); }
        if (!room.members.size && Date.now() - room.touched > 30 * 60 * 1000) rooms.delete(code);
      });
    }, 1000);
    timer.unref();
    server.httpServer?.once("close", () => { clearInterval(timer); rooms.forEach((room) => room.members.forEach((m) => m.stream?.end())); rooms.clear(); });
  };
  return { name: "origin-coop", configureServer: attach, configurePreviewServer: attach };
};
