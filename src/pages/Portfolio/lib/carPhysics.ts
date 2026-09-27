export interface CarTerrain {
  heightAt(x: number, z: number): number;
  normalAt(x: number, z: number, out: CarNormal): void;
}

export interface CarNormal {
  x: number;
  y: number;
  z: number;
}

export interface CarInput {
  throttle: number;
  brake: number;
  steer: number;
  handbrake?: number;
}

export interface CarTuning {
  engineMultiplier: number;
  maxSpeedMultiplier: number;
  gripMultiplier: number;
}

export const STOCK_CAR_TUNING: CarTuning = {
  engineMultiplier: 1,
  maxSpeedMultiplier: 1,
  gripMultiplier: 1,
};

export interface CarBody {
  x: number;
  z: number;
  heading: number;
  speed: number;
  steer: number;
  yawRate: number;
  lateral: number;
  y: number;
  vy: number;
  wheelSpin: number;
  airborne: boolean;
  slip: number;
  roll: number;
  rollVel: number;
  pitch: number;
  pitchVel: number;
}

export const GRAVITY = 22;
export const ENGINE_ACCEL = 19;
export const BRAKE_DECEL = 30;
export const REVERSE_ACCEL = 8;
export const ENGINE_BRAKING = 3;
export const ROLLING_RESISTANCE = 0.03;
export const DRAG = 0.012;
export const MAX_SPEED = 18;
export const MAX_REVERSE = 7;
export const TRACTION = 1;
export const GRIP = 7;
export const MAX_LATERAL = 6;
export const STEER_LIMIT = 0.55;
export const STEER_RATE = 18;
export const STEER_MIN_SPEED = 1.5;
export const YAW_TORQUE = 28;
export const YAW_DAMPING = 8;
export const MAX_YAW_RATE = 3;
export const ATTITUDE_STIFFNESS = 42;
export const ATTITUDE_DAMPING = 10;
export const ROLL_FACTOR = 0.07;
export const PITCH_FACTOR = 0.05;
export const WHEEL_RADIUS = 0.22;
export const CAR_RADIUS = 0.6;
export const SUSPENSION_STIFFNESS = 180;
export const SUSPENSION_DAMPING = 14;
export const SUSPENSION_TRAVEL = 0.16;
export const AIRBORNE_GAP = GRAVITY / SUSPENSION_STIFFNESS;
const MAX_STEP = 1 / 120;

const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));

export const createCarBody = (
  x: number,
  z: number,
  heading: number,
  y: number,
): CarBody => ({
  x,
  z,
  heading,
  speed: 0,
  steer: 0,
  yawRate: 0,
  lateral: 0,
  y,
  vy: 0,
  wheelSpin: 0,
  airborne: false,
  slip: 0,
  roll: 0,
  rollVel: 0,
  pitch: 0,
  pitchVel: 0,
});

/** Signed forward grade: negative uphill, positive downhill. */
export const forwardGrade = (
  normal: CarNormal,
  heading: number,
): number => normal.x * Math.sin(heading) + normal.z * Math.cos(heading);

/** Signed lateral grade: how much gravity pulls the car sideways. */
export const lateralGrade = (
  normal: CarNormal,
  heading: number,
): number => normal.x * Math.cos(heading) - normal.z * Math.sin(heading);

/** 0 on flat ground, 1 on a vertical wall. */
export const slopeAngle = (normal: CarNormal): number =>
  Math.acos(clamp(normal.y, -1, 1));

/** Rollover likelihood grows with slope and speed. */
export const slopeRisk = (
  normal: CarNormal,
  speed: number,
): number =>
  slopeAngle(normal) * (0.4 + Math.min(1, Math.abs(speed) / MAX_SPEED));

const stepCarSubstep = (
  body: CarBody,
  input: CarInput,
  terrain: CarTerrain,
  dt: number,
  tuning: CarTuning,
): void => {
  const normal: CarNormal = { x: 0, y: 1, z: 0 };

  terrain.normalAt(body.x, body.z, normal);

  const load = Math.max(0, normal.y);
  const gradeForward = forwardGrade(normal, body.heading);
  const gradeLateral = lateralGrade(normal, body.heading);
  const previousSpeed = body.speed;
  const previousHeading = body.heading;
  const groundAtStart = terrain.heightAt(body.x, body.z);
  const supportSpeed = -(normal.x * (Math.sin(body.heading) * body.speed + Math.cos(body.heading) * body.lateral) +
    normal.z * (Math.cos(body.heading) * body.speed - Math.sin(body.heading) * body.lateral)) / Math.max(0.2, normal.y);
  // A tire can push against the ground, but cannot pull the car down.
  const extension = body.y - groundAtStart;
  const support = extension <= AIRBORNE_GAP
    ? Math.max(0, GRAVITY - extension * SUSPENSION_STIFFNESS -
      (body.vy - supportSpeed) * SUSPENSION_DAMPING)
    : 0;
  body.airborne = support === 0;

  // Engine / brake force, limited by available traction.
  let drive = 0;

  if (!body.airborne) {
    if (input.throttle > 0) {
      drive += ENGINE_ACCEL * tuning.engineMultiplier * input.throttle;
    }

    if (input.brake > 0) {
      drive +=
        body.speed > 0.5
          ? -BRAKE_DECEL * input.brake
          : -REVERSE_ACCEL * input.brake;
    }

    const maxTraction = TRACTION * GRAVITY * load;

    drive = clamp(drive, -maxTraction, maxTraction);
    if (input.handbrake && Math.abs(body.speed) > 0.5) {
      drive -= Math.sign(body.speed) * 12 * input.handbrake;
    }
  }

  const rolling = ROLLING_RESISTANCE * GRAVITY * load;
  const gravityAlongSlope = body.airborne ? 0 : GRAVITY * gradeForward;

  if (body.airborne) {
    // Only quadratic air drag while airborne.
  } else if (input.throttle === 0 && input.brake === 0) {
    // Coasting: engine braking + rolling resistance, then gravity.
    const decel = ENGINE_BRAKING + rolling;

    if (Math.abs(body.speed) <= decel * dt) {
      body.speed = 0;
    } else {
      body.speed -= Math.sign(body.speed) * decel * dt;
    }

    body.speed += gravityAlongSlope * dt;
  } else {
    if (Math.abs(body.speed) <= rolling * dt) {
      body.speed = 0;
    } else {
      body.speed -= Math.sign(body.speed) * rolling * dt;
    }

    body.speed += (drive + gravityAlongSlope) * dt;
  }

  const dragFactor = Math.exp(-Math.hypot(body.speed, body.lateral) * DRAG * dt);
  body.speed *= dragFactor;
  if (body.airborne) {
    body.lateral *= dragFactor;
  } else {
    body.speed = clamp(body.speed, -MAX_REVERSE, MAX_SPEED * tuning.maxSpeedMultiplier);
  }

  // Steering — yaw carries angular momentum, so the car leans into turns and
  // keeps rotating briefly after the wheel is released.
  const speedFactor = Math.min(1, Math.abs(body.speed) / STEER_MIN_SPEED);
  const direction = body.speed >= 0 ? 1 : -1;

  body.steer +=
    (input.steer * STEER_LIMIT - body.steer) * Math.min(1, STEER_RATE * dt);

  if (body.airborne) {
    body.yawRate *= Math.exp(-0.35 * dt);
  } else {
    const highSpeedControl = 1 - 0.25 * Math.min(1, Math.abs(body.speed) / MAX_SPEED);
    const targetYaw = body.steer * (YAW_TORQUE / YAW_DAMPING) * speedFactor * direction * highSpeedControl;
    const response = input.steer === 0 ? 12 : YAW_DAMPING;
    body.yawRate += (targetYaw - body.yawRate) * (1 - Math.exp(-response * dt));
    body.yawRate = clamp(body.yawRate, -MAX_YAW_RATE, MAX_YAW_RATE);
  }

  body.heading += body.yawRate * dt;

  if (body.airborne) {
    // Rotating the chassis in flight must not rotate its world-space momentum.
    const angle = body.heading - previousHeading;
    const speed = body.speed;
    body.speed = speed * Math.cos(angle) + body.lateral * Math.sin(angle);
    body.lateral = body.lateral * Math.cos(angle) - speed * Math.sin(angle);
  }

  // Lateral slip — cross-slope gravity versus tire grip.
  body.lateral += (body.airborne ? 0 : GRAVITY * gradeLateral) * dt;

  if (!body.airborne && input.handbrake) {
    body.lateral -= body.yawRate * body.speed * 0.42 * input.handbrake * dt;
  }
  const grip = body.airborne ? 0 : GRIP * tuning.gripMultiplier * load * (1 - (input.handbrake ?? 0) * 0.72);

  if (Math.abs(body.lateral) <= grip * dt) {
    body.lateral = 0;
  } else {
    body.lateral -= Math.sign(body.lateral) * grip * dt;
  }

  if (!body.airborne) {
    body.lateral = clamp(body.lateral, -MAX_LATERAL, MAX_LATERAL);
  }
  body.slip = Math.abs(body.lateral);

  // Chassis attitude has mass: roll reacts to cornering and pitch to
  // acceleration, both integrated through a spring-damper.
  const longitudinal = (body.speed - previousSpeed) / Math.max(dt, 1e-4);
  const lateralAccel = body.yawRate * body.speed;
  const rollTarget = clamp(-lateralAccel * ROLL_FACTOR, -0.28, 0.28);
  const pitchTarget = clamp(-longitudinal * PITCH_FACTOR, -0.16, 0.16);

  if (!body.airborne) {
    body.rollVel +=
      ((rollTarget - body.roll) * ATTITUDE_STIFFNESS -
        body.rollVel * ATTITUDE_DAMPING) *
      dt;
    body.roll += body.rollVel * dt;

    body.pitchVel +=
      ((pitchTarget - body.pitch) * ATTITUDE_STIFFNESS -
        body.pitchVel * ATTITUDE_DAMPING) *
      dt;
  } else {
    body.rollVel *= Math.exp(-0.6 * dt);
    body.pitchVel *= Math.exp(-0.6 * dt);
    body.roll += body.rollVel * dt;
  }
  body.pitch += body.pitchVel * dt;

  // Integrate along heading plus lateral slip.
  const forwardX = Math.sin(body.heading);
  const forwardZ = Math.cos(body.heading);
  const rightX = Math.cos(body.heading);
  const rightZ = -Math.sin(body.heading);

  body.x += forwardX * body.speed * dt + rightX * body.lateral * dt;
  body.z += forwardZ * body.speed * dt + rightZ * body.lateral * dt;

  // Suspension stores vertical momentum on climbs and releases it over crests.
  body.vy += (support - GRAVITY) * dt;
  body.y += body.vy * dt;

  const groundY = terrain.heightAt(body.x, body.z);
  const bottomStop = groundY - SUSPENSION_TRAVEL;

  if (body.y < bottomStop) {
    body.y = bottomStop;
    // Bottoming out absorbs most impact energy, retaining a small rebound.
    const impact = body.vy - supportSpeed;
    if (impact < 0) {
      body.vy = supportSpeed - impact * 0.15;
    }
  }

  body.airborne = body.y - groundY > AIRBORNE_GAP ||
    (support === 0 && body.y > groundY);

  body.wheelSpin += (body.speed / WHEEL_RADIUS + body.lateral * 0.4) * dt;
};

/** Bounded substeps keep suspension and landing stable across render rates. */
export const stepCar = (
  body: CarBody,
  input: CarInput,
  terrain: CarTerrain,
  dt: number,
  tuning: CarTuning = STOCK_CAR_TUNING,
): void => {
  if (!Number.isFinite(dt) || dt <= 0) return;
  const duration = Math.min(dt, 0.1);
  const steps = Math.ceil(duration / MAX_STEP);
  for (let i = 0; i < steps; i += 1) {
    stepCarSubstep(body, input, terrain, duration / steps, tuning);
  }
};
