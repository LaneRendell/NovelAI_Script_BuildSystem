import { featherProvider } from "./feather-provider";
import { IconSetProvider } from "./types";

export const providerRegistry = new Map<string, IconSetProvider>([
  [featherProvider.name, featherProvider],
]);
