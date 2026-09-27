import { describe, expect, it } from "vitest";
import {
  CarTerrain,
  createCarBody,
  forwardGrade,
  lateralGrade,
  MAX_YAW_RATE,
  GRAVITY,
  SUSPENSION_TRAVEL,
  slopeRisk,
  stepCar,
} from "./carPhysics";

const STEP = 1 / 60;

const makeTerrain = (gradeX: number, gradeZ = 0): CarTerrain => {
  const nx = -gradeX;
  const ny = 1;
  const nz = -gradeZ;
  const length = Math.hypot(nx, ny, nz);

  return {
    heightAt: (x, z) => gradeX * x + gradeZ * z,
    normalAt: (_x, _z, out) => {
      out.x = nx / length;
      out.y = ny / length;
      out.z = nz / length;
    },
  };
};

const drive = (
  body: ReturnType<typeof createCarBody>,
  terrain: CarTerrain,
  input: { throttle?: number; brake?: number; steer?: number },
  seconds: number,
): void => {
  const steps = Math.round(seconds / STEP);

  for (let i = 0; i < steps; i += 1) {
    stepCar(
      body,
      {
        throttle: input.throttle ?? 0,
        brake: input.brake ?? 0,
        steer: input.steer ?? 0,
      },
      terrain,
      STEP,
    );
  }
};

describe("car slope physics", () => {
  it("accelerates on flat ground with throttle", () => {
    const body = createCarBody(0, 0, 0, 0);

    drive(body, makeTerrain(0), { throttle: 1 }, 1);

    expect(body.speed).toBeGreaterThan(5);
    expect(body.y).toBeCloseTo(0, 1);
  });

  it("coasts to a stop on flat ground", () => {
    const body = createCarBody(0, 0, 0, 0);

    body.speed = 10;
    drive(body, makeTerrain(0), {}, 4);

    expect(Math.abs(body.speed)).toBeLessThan(0.5);
  });

  it("loses speed climbing a hill", () => {
    const terrain = makeTerrain(0.364);
    const body = createCarBody(0, 0, Math.PI / 2, 0);

    body.speed = 12;
    drive(body, terrain, {}, 0.6);

    expect(body.speed).toBeLessThan(7);
  });

  it("cannot climb a steep slope and rolls back", () => {
    const terrain = makeTerrain(1);
    const body = createCarBody(0, 0, Math.PI / 2, 0);

    drive(body, terrain, { throttle: 1 }, 2.5);

    expect(body.speed).toBeLessThan(1);
  });

  it("picks up speed rolling downhill", () => {
    const terrain = makeTerrain(-0.364);
    const body = createCarBody(0, 0, Math.PI / 2, 0);

    drive(body, terrain, {}, 1);

    expect(body.speed).toBeGreaterThan(2);
    expect(body.x).toBeGreaterThan(1);
  });

  it("slides sideways on a cross-slope", () => {
    const terrain = makeTerrain(1, 0);
    const body = createCarBody(0, 0, 0, 0);

    drive(body, terrain, {}, 1);

    expect(body.lateral).toBeLessThan(-1);
    expect(body.x).toBeLessThan(-0.3);
  });

  it("keeps suspension within its travel on a steady climb", () => {
    const terrain = makeTerrain(0.2);
    const body = createCarBody(0, 0, Math.PI / 2, 0);

    drive(body, terrain, { throttle: 1 }, 1.5);

    const groundY = terrain.heightAt(body.x, body.z);

    expect(body.y).toBeGreaterThanOrEqual(groundY - SUSPENSION_TRAVEL);
    expect(body.airborne).toBe(false);
  });
});

describe("turning inertia", () => {
  it("builds yaw rate gradually instead of snapping", () => {
    const terrain = makeTerrain(0);
    const body = createCarBody(0, 0, 0, 0);

    drive(body, terrain, { throttle: 1 }, 2);
    stepCar(body, { throttle: 1, brake: 0, steer: 1 }, terrain, STEP);

    expect(body.yawRate).toBeGreaterThan(0);
    expect(body.yawRate).toBeLessThan(MAX_YAW_RATE);
  });

  it("keeps rotating for a while after the wheel is released", () => {
    const terrain = makeTerrain(0);
    const body = createCarBody(0, 0, 0, 0);

    drive(body, terrain, { throttle: 1, steer: 1 }, 1.4);

    const yawAtRelease = body.yawRate;
    const headingAtRelease = body.heading;

    expect(yawAtRelease).toBeGreaterThan(0.4);

    drive(body, terrain, { throttle: 1 }, 0.2);

    expect(body.heading).toBeGreaterThan(headingAtRelease);
    expect(body.yawRate).toBeGreaterThan(0);
    expect(body.yawRate).toBeLessThan(yawAtRelease);
  });

  it("gives the chassis attitude mass through a spring-damper", () => {
    const terrain = makeTerrain(0);
    const body = createCarBody(0, 0, 0, 0);

    drive(body, terrain, { throttle: 1 }, 1.5);
    drive(body, terrain, { throttle: 1, steer: 1 }, 0.3);

    expect(Math.abs(body.roll)).toBeGreaterThan(0);
    expect(Math.abs(body.rollVel)).toBeGreaterThan(0);

    drive(body, terrain, { throttle: 0, brake: 0 }, 0.3);

    expect(Math.abs(body.roll)).toBeGreaterThan(0);
  });
});

describe("car upgrades", () => {
  it("applies engine, speed and grip tuning without changing stock defaults", () => {
    const terrain = makeTerrain(0);
    const stock = createCarBody(0, 0, 0, 0);
    const tuned = createCarBody(0, 0, 0, 0);
    for (let i = 0; i < 600; i += 1) {
      stepCar(stock, { throttle: 1, brake: 0, steer: 0 }, terrain, STEP);
      stepCar(tuned, { throttle: 1, brake: 0, steer: 0 }, terrain, STEP, {
        engineMultiplier: 1.18,
        maxSpeedMultiplier: 1.15,
        gripMultiplier: 1.08,
      });
    }
    expect(stock.speed).toBeLessThanOrEqual(18);
    expect(tuned.speed).toBeGreaterThan(stock.speed + 1);
    expect(tuned.speed).toBeLessThanOrEqual(18 * 1.15);
  });
  it("lets the handbrake trade speed and grip for a controlled slide", () => {
    const terrain = makeTerrain(0);
    const normalTurn = createCarBody(0, 0, 0, 0);
    const drift = createCarBody(0, 0, 0, 0);
    normalTurn.speed = drift.speed = 14;
    for (let i = 0; i < 30; i += 1) {
      stepCar(normalTurn, { throttle: 1, brake: 0, steer: 1 }, terrain, STEP);
      stepCar(drift, { throttle: 1, brake: 0, steer: 1, handbrake: 1 }, terrain, STEP);
    }
    expect(drift.speed).toBeLessThan(normalTurn.speed);
    expect(drift.slip).toBeGreaterThan(normalTurn.slip);
    expect(drift.slip).toBeGreaterThan(0.2);
  });
});

describe("slope grades", () => {
  it("distinguishes uphill, flat and downhill", () => {
    const uphill = { x: -0.34, y: 0.94, z: 0 };
    const flat = { x: 0, y: 1, z: 0 };

    expect(forwardGrade(uphill, Math.PI / 2)).toBeLessThan(0);
    expect(forwardGrade(flat, 0)).toBe(0);
    expect(forwardGrade({ x: 0.34, y: 0.94, z: 0 }, Math.PI / 2)).toBeGreaterThan(0);
  });

  it("reports lateral grade across the heading", () => {
    expect(Math.abs(lateralGrade({ x: -0.5, y: 0.866, z: 0 }, 0))).toBeGreaterThan(0);
  });

  it("grows the rollover risk with slope and speed", () => {
    const gentle = { x: -0.34, y: 0.94, z: 0 };
    const steep = { x: -0.707, y: 0.707, z: 0 };

    expect(slopeRisk({ x: 0, y: 1, z: 0 }, 10)).toBe(0);
    expect(slopeRisk(steep, 10)).toBeGreaterThan(slopeRisk(gentle, 10));
    expect(slopeRisk(steep, 15)).toBeGreaterThan(slopeRisk(steep, 3));
  });
});

const idle = { throttle: 0, brake: 0, steer: 0 };
const ramp: CarTerrain = {
  heightAt: (_x, z) => Math.min(z * 0.4, 2),
  normalAt: (_x, z, out) => {
    const grade = z < 5 ? 0.4 : 0;
    const length = Math.hypot(1, grade);
    out.x = 0;
    out.y = 1 / length;
    out.z = -grade / length;
  },
};

describe("suspension and flight", () => {
  it("carries uphill momentum above a ramp crest and settles after landing", () => {
    const body = createCarBody(0, 0, 0, 0);
    body.speed = 14;
    let clearance = 0;
    let risingInAir = false;
    for (let i = 0; i < 240; i += 1) {
      stepCar(body, { ...idle, throttle: 1 }, ramp, STEP);
      if (body.z > 5) {
        clearance = Math.max(clearance, body.y - 2);
        risingInAir ||= body.airborne && body.vy > 1;
      }
      expect(body.y).toBeGreaterThanOrEqual(ramp.heightAt(body.x, body.z) - SUSPENSION_TRAVEL);
    }
    expect(risingInAir).toBe(true);
    expect(clearance).toBeGreaterThan(0.3);
    expect(body.airborne).toBe(false);
    expect(body.y).toBeCloseTo(2, 2);
    expect(Math.abs(body.vy)).toBeLessThan(0.1);
  });

  it("falls ballistically from a ledge without snapping down", () => {
    const body = createCarBody(0, 0, 0, 4);
    body.speed = 10;
    stepCar(body, idle, makeTerrain(0), 0.1);
    expect(body.airborne).toBe(true);
    expect(body.vy).toBeCloseTo(-GRAVITY * 0.1, 8);
    expect(body.y).toBeGreaterThan(3.8);
  });

  it("cannot accelerate, brake or change trajectory with airborne steering", () => {
    const initial = createCarBody(0, 0, 0, 20);
    initial.speed = 12;
    initial.yawRate = 2;
    const controlled = { ...initial };
    const coast = { ...initial };
    drive(controlled, makeTerrain(0), { throttle: 1, brake: 1, steer: 1 }, 0.5);
    drive(coast, makeTerrain(0), {}, 0.5);
    expect(controlled.x).toBeCloseTo(0, 8);
    expect(controlled.z).toBeGreaterThan(5);
    expect(controlled.x).toBeCloseTo(coast.x, 8);
    expect(controlled.z).toBeCloseTo(coast.z, 8);
    expect(controlled.heading).toBeGreaterThan(0.5);
  });

  it("absorbs a hard landing and comes to rest without sinking", () => {
    const body = createCarBody(0, 0, 0, 5);
    let rebound = false;
    for (let i = 0; i < 300; i += 1) {
      stepCar(body, idle, makeTerrain(0), STEP);
      rebound ||= body.vy > 0.5;
      expect(body.y).toBeGreaterThanOrEqual(-SUSPENSION_TRAVEL);
    }
    expect(rebound).toBe(true);
    expect(body.y).toBeCloseTo(0, 3);
    expect(body.vy).toBeCloseTo(0, 3);
    expect(body.airborne).toBe(false);
  });

  it("produces the same ramp jump at 30, 60 and 120 fps", () => {
    const simulate = (fps: number) => {
      const body = createCarBody(0, 0, 0, 0);
      body.speed = 14;
      for (let i = 0; i < fps; i += 1) {
        stepCar(body, { ...idle, throttle: 1 }, ramp, 1 / fps);
      }
      return body;
    };
    const reference = simulate(120);
    for (const fps of [30, 60]) {
      const body = simulate(fps);
      expect(body.y).toBeCloseTo(reference.y, 8);
      expect(body.vy).toBeCloseTo(reference.vy, 8);
      expect(body.z).toBeCloseTo(reference.z, 8);
    }
  });
});

describe("responsive handling", () => {
  it("responds and countersteers within a fraction of a second", () => {
    const body = createCarBody(0, 0, 0, 0);
    body.speed = 12;
    drive(body, makeTerrain(0), { throttle: 1, steer: 1 }, 0.15);
    expect(body.yawRate).toBeGreaterThan(0.65);
    drive(body, makeTerrain(0), { throttle: 1, steer: -1 }, 0.2);
    expect(body.yawRate).toBeLessThan(-0.4);
    drive(body, makeTerrain(0), { throttle: 1 }, 0.3);
    expect(Math.abs(body.yawRate)).toBeLessThan(0.15);
  });
});
