type TaskInfoGetter = (filePath: string) => Promise<unknown>;
type TaskInfoSource = (filePath: string) => unknown;
type TaskEditModal = (taskInfo: unknown) => void | Promise<void>;

interface TaskNotesModalApi {
  getTaskInfo(filePath: string): Promise<unknown>;
  openTaskEditModal(taskInfo: unknown): Promise<void>;
}

interface TaskNotesRuntimeApi {
  apiVersion: number;
  hasCapability: (capability: string) => boolean;
  settings?: unknown;
  catalog?: unknown;
  tasks?: unknown;
}

export function getTaskNotesModalApi(
  plugins: unknown,
): TaskNotesModalApi | undefined {
  if (!isRecord(plugins)) {
    return undefined;
  }
  const plugin = plugins["tasknotes"];
  if (!isRecord(plugin)) {
    return undefined;
  }
  const openTaskEditModal = plugin["openTaskEditModal"];
  if (!isTaskEditModal(openTaskEditModal)) {
    return undefined;
  }

  const api = getTaskNotesRuntimeApi(plugin);
  const taskGetter = api?.hasCapability("tasks.read")
    ? runtimeTaskGetter(api)
    : legacyTaskGetter(plugin);
  if (!taskGetter) {
    return undefined;
  }
  return {
    getTaskInfo: taskGetter,
    openTaskEditModal: async (taskInfo) => {
      await openTaskEditModal.call(plugin, taskInfo);
    },
  };
}

export function getTaskNotesRuntimeApi(
  plugin: Record<string, unknown>,
): TaskNotesRuntimeApi | undefined {
  const api = plugin["api"];
  if (
    !isRecord(api) ||
    api["apiVersion"] !== 1 ||
    !isCapabilityChecker(api["hasCapability"])
  ) {
    return undefined;
  }
  const hasCapability = api["hasCapability"];
  return {
    apiVersion: 1,
    hasCapability: (capability) => hasCapability.call(api, capability),
    settings: api["settings"],
    catalog: api["catalog"],
    tasks: api["tasks"],
  };
}

export function callRuntimeApiMethod(
  target: unknown,
  methodName: string,
): unknown {
  if (!isRecord(target)) {
    throw new Error(
      `TaskNotes runtime API is missing the ${methodName} interface.`,
    );
  }
  const method = target[methodName];
  if (typeof method !== "function") {
    throw new Error(`TaskNotes runtime API does not provide ${methodName}().`);
  }
  return method.call(target);
}

export function runtimeTaskGetter(
  api: TaskNotesRuntimeApi,
): TaskInfoGetter | undefined {
  if (!isRecord(api["tasks"])) {
    throw new Error("TaskNotes runtime API is missing the tasks interface.");
  }
  const tasks = api["tasks"];
  const getTask = tasks["get"];
  if (!isTaskInfoGetter(getTask)) {
    throw new Error("TaskNotes runtime API does not provide tasks.get().");
  }
  return async (filePath) => await getTask.call(tasks, filePath);
}

export function legacyTaskGetter(
  plugin: Record<string, unknown>,
): TaskInfoGetter | undefined {
  const cacheManager = plugin["cacheManager"];
  if (!isRecord(cacheManager)) {
    return undefined;
  }
  const getTaskInfo = cacheManager["getTaskInfo"];
  if (!isTaskInfoGetter(getTaskInfo)) {
    return undefined;
  }
  return async (filePath) => await getTaskInfo.call(cacheManager, filePath);
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function isTaskInfoGetter(value: unknown): value is TaskInfoSource {
  return typeof value === "function";
}

export function isCapabilityChecker(
  value: unknown,
): value is (capability: string) => boolean {
  return typeof value === "function";
}

export function isTaskEditModal(value: unknown): value is TaskEditModal {
  return typeof value === "function";
}
