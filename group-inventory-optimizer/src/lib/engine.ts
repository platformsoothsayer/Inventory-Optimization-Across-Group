/** Glue shared by the UI and Node scripts. */
import type { Assumptions, Unit, World } from "./types";
import { fitDemand, type DemandModel } from "./demand";
import { buildContext, type EconContext } from "./economics";
import { optimize, type OptimizerResult } from "./optimizer";

export interface Engine {
  world: World;
  units: Unit[];
  dm: DemandModel;
  ctx: EconContext;
  result: OptimizerResult;
}

export function createDemand(world: World): DemandModel {
  return fitDemand(world, world.months);
}

export function runEngine(world: World, units: Unit[], dm: DemandModel, a: Assumptions): Engine {
  const ctx = buildContext(world, dm, a);
  const result = optimize(ctx, units);
  return { world, units, dm, ctx, result };
}
