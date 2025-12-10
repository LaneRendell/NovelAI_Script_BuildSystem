// Utility functions and types
// This file demonstrates how to use imports/exports with the build system
// The build system will automatically remove import/export keywords

/**
 * Configuration interface
 */
export interface ScriptConfig {
    scriptName: string;
    version: string;
    enabled: boolean;
    debugMode?: boolean;
}

/**
 * Statistics interface for tracking script usage
 */
export interface ScriptStats {
    runCount: number;
    generationCount: number;
    lastRun?: number;
    lastGeneration?: number;
}

/**
 * Format a timestamp for display
 */
export function formatTimestamp(timestamp: number): string {
    return new Date(timestamp).toISOString();
}

/**
 * Get statistics from storage
 */
export async function getStats(): Promise<ScriptStats> {
    const runCount = await api.v1.storage.get("runCount") || 0;
    const generationCount = await api.v1.storage.get("generationCount") || 0;
    const lastRun = await api.v1.storage.get("lastRun");
    const lastGeneration = await api.v1.storage.get("lastGeneration");

    return {
        runCount,
        generationCount,
        lastRun,
        lastGeneration,
    };
}

/**
 * Update run count in storage
 */
export async function incrementRunCount(): Promise<number> {
    const count = (await api.v1.storage.get("runCount") || 0) + 1;
    await api.v1.storage.set("runCount", count);
    await api.v1.storage.set("lastRun", Date.now());
    return count;
}

/**
 * Update generation count in storage
 */
export async function incrementGenerationCount(): Promise<number> {
    const count = (await api.v1.storage.get("generationCount") || 0) + 1;
    await api.v1.storage.set("generationCount", count);
    await api.v1.storage.set("lastGeneration", Date.now());
    return count;
}

/**
 * Log debug information if debug mode is enabled
 */
export function debugLog(config: ScriptConfig, ...args: any[]): void {
    if (config.debugMode) {
        api.v1.log("[DEBUG]", ...args);
    }
}

/**
 * Show a toast notification with consistent styling
 */
export async function showNotification(message: string, type: "info" | "success" | "warning" | "error" = "info"): Promise<void> {
    await api.v1.ui.toast(message, {
        autoClose: 3000,
        type,
    });
}
