export type QueueStatus = "waiting" | "ready" | "in_progress" | "completed" | "removed";

export type QueueState = {
  status: QueueStatus;
  barberId: number | null;
  startedAt: Date | string | null;
  completedAt: Date | string | null;
};

export type QueueAction = { barberId: number | null } | { status: QueueStatus };

export class QueueLifecycleError extends Error {}

export function initialQueueStatus(barberId: number | null): QueueStatus {
  return barberId === null ? "waiting" : "ready";
}

export function assertQueueState(state: QueueState): void {
  if (state.status === "waiting" && state.barberId !== null) throw new QueueLifecycleError("A waiting queue entry cannot have a barber.");
  if (["ready", "in_progress", "completed"].includes(state.status) && state.barberId === null)
    throw new QueueLifecycleError("A barber must be assigned before service can start.");
  if (["in_progress", "completed"].includes(state.status) && state.startedAt === null)
    throw new QueueLifecycleError("Service must be started before it can be completed.");
  if (state.status === "completed" && state.completedAt === null)
    throw new QueueLifecycleError("A completed queue entry must have a completion time.");
  if (["waiting", "ready", "removed"].includes(state.status) && state.startedAt !== null)
    throw new QueueLifecycleError("Service timestamps do not match the queue state.");
  if (state.status !== "completed" && state.completedAt !== null)
    throw new QueueLifecycleError("Service timestamps do not match the queue state.");
  if (state.completedAt !== null && state.startedAt === null)
    throw new QueueLifecycleError("Completion time cannot precede service start.");
  if (state.startedAt !== null && state.completedAt !== null && new Date(state.completedAt) < new Date(state.startedAt))
    throw new QueueLifecycleError("Completion time cannot precede service start.");
}

export function transitionQueue(state: QueueState, action: QueueAction): QueueStatus {
  assertQueueState(state);
  if (state.status === "completed") throw new QueueLifecycleError("This queue entry has already been completed.");
  if (state.status === "removed") throw new QueueLifecycleError("This queue entry has already been removed.");

  if ("barberId" in action) {
    if (state.status !== "waiting" && state.status !== "ready")
      throw new QueueLifecycleError("A barber cannot be changed after service starts.");
    return initialQueueStatus(action.barberId);
  }
  if (action.status === "in_progress") {
    if (state.status === "waiting") throw new QueueLifecycleError("A barber must be assigned before service can start.");
    if (state.status !== "ready") throw new QueueLifecycleError("Service has already started.");
    return "in_progress";
  }
  if (action.status === "completed") {
    if (state.status !== "in_progress") throw new QueueLifecycleError("Service must be started before it can be completed.");
    return "completed";
  }
  if (action.status === "removed") {
    if (state.status !== "waiting" && state.status !== "ready")
      throw new QueueLifecycleError("Service cannot be removed after it starts.");
    return "removed";
  }
  throw new QueueLifecycleError("Change the barber to move between waiting and ready.");
}
