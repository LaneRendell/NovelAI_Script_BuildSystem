const fs = require('fs');
const path = require('path');
const https = require('https');

// Parse command line arguments
const args = process.argv.slice(2);
const isWatch = args.includes('--watch');
const forceRefreshTypes = args.includes('--refresh-types');
const projectArg = args.find(arg => !arg.startsWith('--'));

// Ensure dist and external directories exist
if (!fs.existsSync('dist')) {
    fs.mkdirSync('dist', { recursive: true });
}
if (!fs.existsSync('external')) {
    fs.mkdirSync('external', { recursive: true });
}

// =============================================================================
// External Types Fetching
// =============================================================================

function fetchExternalTypes(forceRefresh = false) {
    return new Promise((resolve, reject) => {
        const url = 'https://novelai.github.io/scripting/types/script-types.d.ts';
        const outputPath = path.join(__dirname, 'external', 'script-types.d.ts');

        // Check if file already exists and is less than 24 hours old (unless force refresh)
        if (!forceRefresh && fs.existsSync(outputPath)) {
            const stats = fs.statSync(outputPath);
            const age = Date.now() - stats.mtimeMs;
            const hoursOld = age / (1000 * 60 * 60);

            if (hoursOld < 24) {
                console.log('✓ Using cached NovelAI type definitions');
                resolve();
                return;
            }
        }

        console.log(forceRefresh ? '📥 Force refreshing NovelAI type definitions...' : '📥 Fetching NovelAI type definitions...');

        https.get(url, (res) => {
            if (res.statusCode !== 200) {
                reject(new Error(`Failed to fetch types: HTTP ${res.statusCode}`));
                return;
            }

            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                fs.writeFileSync(outputPath, data, 'utf8');
                console.log('✓ NovelAI type definitions downloaded');
                resolve();
            });
        }).on('error', reject);
    });
}

// =============================================================================
// Project Discovery
// =============================================================================

/**
 * Discover all projects in the projects/ directory
 */
function discoverProjects() {
    const projectsDir = path.join(__dirname, 'projects');
    const projects = [];

    if (!fs.existsSync(projectsDir)) {
        return projects;
    }

    const entries = fs.readdirSync(projectsDir, { withFileTypes: true });

    for (const entry of entries) {
        if (!entry.isDirectory()) continue;

        const projectPath = path.join(projectsDir, entry.name);
        const configPath = path.join(projectPath, 'project.json');

        if (fs.existsSync(configPath)) {
            try {
                const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
                projects.push({
                    name: entry.name,
                    path: projectPath,
                    config: {
                        name: config.name || entry.name,
                        version: config.version || '1.0.0',
                        author: config.author || 'Unknown',
                        description: config.description || '',
                        license: config.license || 'MIT',
                        sourceFiles: config.sourceFiles || ['src/index.ts'],
                    }
                });
            } catch (err) {
                console.warn(`⚠️  Invalid project.json in ${entry.name}: ${err.message}`);
            }
        } else {
            // Auto-discover project without project.json (use defaults)
            const srcPath = path.join(projectPath, 'src');
            if (fs.existsSync(srcPath)) {
                console.log(`ℹ️  Project "${entry.name}" has no project.json, using defaults`);
                projects.push({
                    name: entry.name,
                    path: projectPath,
                    config: {
                        name: entry.name,
                        version: '1.0.0',
                        author: 'Unknown',
                        description: '',
                        license: 'MIT',
                        sourceFiles: autoDiscoverSourceFiles(srcPath),
                    }
                });
            }
        }
    }

    return projects;
}

/**
 * Auto-discover TypeScript files in a src directory
 */
function autoDiscoverSourceFiles(srcPath) {
    const files = [];

    function scanDir(dir, relativeTo) {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            const relativePath = path.relative(relativeTo, fullPath).replace(/\\/g, '/');

            if (entry.isDirectory()) {
                scanDir(fullPath, relativeTo);
            } else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.d.ts')) {
                files.push('src/' + relativePath);
            }
        }
    }

    scanDir(srcPath, srcPath);

    // Sort to put index.ts last (it's usually the entry point)
    files.sort((a, b) => {
        if (a.includes('index.ts')) return 1;
        if (b.includes('index.ts')) return -1;
        return a.localeCompare(b);
    });

    return files;
}

// =============================================================================
// Build Functions
// =============================================================================

/**
 * Parse namespace imports from content
 * Returns array of { alias: string, modulePath: string }
 */
function parseNamespaceImports(content) {
    const namespaceImports = [];
    // Match: import * as alias from "./module" or './module'
    const regex = /^import\s+\*\s+as\s+(\w+)\s+from\s+['"]([^'"]+)['"]\s*;?\s*$/gm;
    let match;
    while ((match = regex.exec(content)) !== null) {
        namespaceImports.push({
            alias: match[1],
            modulePath: match[2]
        });
    }
    return namespaceImports;
}

/**
 * Parse exported VALUE identifiers from a module's content
 * Returns array of exported names (functions, constants, classes, enums)
 * Note: interfaces and type aliases are NOT included - they don't exist at runtime
 */
function parseValueExports(content) {
    const exports = [];

    // Match: export function name
    const funcRegex = /^export\s+(?:async\s+)?function\s+(\w+)/gm;
    let match;
    while ((match = funcRegex.exec(content)) !== null) {
        exports.push(match[1]);
    }

    // Match: export const/let/var name
    const varRegex = /^export\s+(?:const|let|var)\s+(\w+)/gm;
    while ((match = varRegex.exec(content)) !== null) {
        exports.push(match[1]);
    }

    // Match: export class name
    const classRegex = /^export\s+class\s+(\w+)/gm;
    while ((match = classRegex.exec(content)) !== null) {
        exports.push(match[1]);
    }

    // Match: export enum name
    const enumRegex = /^export\s+enum\s+(\w+)/gm;
    while ((match = enumRegex.exec(content)) !== null) {
        exports.push(match[1]);
    }

    return exports;
}

/**
 * Parse exported TYPE declarations from a module's content
 * Returns array of { name, declaration } for interfaces and type aliases
 * These need to go in a namespace for type access via namespace.TypeName
 */
function parseTypeExports(content) {
    const typeExports = [];

    // Match: export interface Name { ... }
    // Need to handle nested braces
    const interfaceRegex = /^export\s+(interface\s+\w+(?:\s+extends\s+[^{]+)?)\s*\{/gm;
    let match;
    while ((match = interfaceRegex.exec(content)) !== null) {
        const startIndex = match.index;
        const declarationStart = match[1]; // "interface Name" or "interface Name extends X"

        // Find the matching closing brace
        let braceCount = 1;
        let i = match.index + match[0].length;
        while (i < content.length && braceCount > 0) {
            if (content[i] === '{') braceCount++;
            else if (content[i] === '}') braceCount--;
            i++;
        }

        const fullDeclaration = content.slice(startIndex + 'export '.length, i);
        const name = declarationStart.match(/interface\s+(\w+)/)[1];
        typeExports.push({ name, declaration: fullDeclaration });
    }

    // Match: export type Name = ...;
    const typeAliasRegex = /^export\s+(type\s+(\w+)(?:<[^>]*>)?\s*=\s*[^;]+;)/gm;
    while ((match = typeAliasRegex.exec(content)) !== null) {
        typeExports.push({
            name: match[2],
            declaration: match[1]
        });
    }

    return typeExports;
}

/**
 * Resolve a relative module path to a source file path
 */
function resolveModulePath(importPath, currentFile, projectPath) {
    // Remove ./ or ../ prefix and add .ts extension if needed
    let resolved = importPath;
    if (!resolved.endsWith('.ts')) {
        resolved += '.ts';
    }

    // Get the directory of the current file
    const currentDir = path.dirname(currentFile);

    // Resolve relative to current file's directory
    const fullPath = path.resolve(projectPath, currentDir, resolved);

    // Return path relative to project root
    return path.relative(projectPath, fullPath).replace(/\\/g, '/');
}

function removeImportsExports(content) {
    // Remove import statements (including multiline imports and type imports)
    content = content.replace(/^import\s+type\s+[\s\S]*?from\s+['"].*?['"];?\s*\n?/gm, '');
    content = content.replace(/^import\s+[\s\S]*?from\s+['"].*?['"];?\s*\n?/gm, '');
    content = content.replace(/^\/\/.*import.*from.*\n?/gm, '');

    // Remove export keywords (but keep the declarations)
    content = content.replace(/^export\s+/gm, '');

    return content;
}

function generateScriptHeader(config) {
    return `/**
 * ${config.name}
 * Version: ${config.version}
 * Author: ${config.author}
 * Description: ${config.description}
 * License: ${config.license}
 *
 * Built with NovelAI Script Build System
 */

`;
}

function generateDistTsConfig() {
    return JSON.stringify({
        compilerOptions: {
            target: "ES2020",
            module: "ESNext",
            lib: ["ES2020"],
            moduleResolution: "bundler",
            strict: false,
            noEmit: true,
            skipLibCheck: true,
            typeRoots: ["../../external", "../../node_modules/@types"]
        },
        include: ["./*.ts", "../../external/**/*"]
    }, null, 2);
}

async function buildProject(project) {
    const { name, path: projectPath, config } = project;

    console.log(`\n🔨 Building project: ${name}`);

    // First pass: Build export maps for all source files
    const valueExportMap = new Map(); // Map<modulePath, string[]> - value exports (functions, const, etc.)
    const typeExportMap = new Map();  // Map<modulePath, Array<{name, declaration}>> - type exports (interfaces, type aliases)
    const rawContents = new Map();    // Map<filePath, string> - raw file contents

    for (const file of config.sourceFiles) {
        const filePath = path.join(projectPath, file);

        if (!fs.existsSync(filePath)) {
            continue;
        }

        const content = fs.readFileSync(filePath, 'utf8');
        rawContents.set(file, content);

        // Parse and store value exports (runtime) for this file
        const valueExports = parseValueExports(content);
        valueExportMap.set(file, valueExports);

        // Parse and store type exports (compile-time) for this file
        const typeExports = parseTypeExports(content);
        typeExportMap.set(file, typeExports);
    }

    // Second pass: Build a map of which namespace wrappers need to be generated after each source file
    // Map<sourceFile, Array<{ alias, valueExports[], typeExports[] }>>
    const wrappersAfterFile = new Map();

    for (const file of config.sourceFiles) {
        const content = rawContents.get(file);
        if (!content) continue;

        const namespaceImports = parseNamespaceImports(content);

        for (const nsImport of namespaceImports) {
            // Resolve the module path relative to the importing file
            const resolvedPath = resolveModulePath(nsImport.modulePath, file, projectPath);

            // Look up exports for this module
            const moduleValueExports = valueExportMap.get(resolvedPath) || [];
            const moduleTypeExports = typeExportMap.get(resolvedPath) || [];

            if (moduleValueExports.length > 0 || moduleTypeExports.length > 0) {
                // Add wrapper to be generated after the source module
                if (!wrappersAfterFile.has(resolvedPath)) {
                    wrappersAfterFile.set(resolvedPath, []);
                }

                const wrappers = wrappersAfterFile.get(resolvedPath);
                // Check if we already have a wrapper for this alias
                const existing = wrappers.find(w => w.alias === nsImport.alias);
                if (!existing) {
                    wrappers.push({
                        alias: nsImport.alias,
                        valueExports: moduleValueExports,
                        typeExports: moduleTypeExports
                    });
                }
            }
        }
    }

    // Build the bundled content
    let bundledContent = generateScriptHeader(config);

    for (const file of config.sourceFiles) {
        const filePath = path.join(projectPath, file);

        if (!fs.existsSync(filePath)) {
            console.warn(`⚠️  Skipping missing file: ${file}`);
            continue;
        }

        let content = rawContents.get(file);

        // Remove imports and exports
        content = removeImportsExports(content);

        // Add file separator comment
        bundledContent += `\n// ============================================================================\n`;
        bundledContent += `// ${file}\n`;
        bundledContent += `// ============================================================================\n\n`;
        bundledContent += content;
        bundledContent += '\n';

        // Generate namespace wrappers for this module (if any files import it as namespace)
        const wrappers = wrappersAfterFile.get(file);
        if (wrappers && wrappers.length > 0) {
            bundledContent += `// Namespace wrapper(s) for ${file}\n`;
            for (const wrapper of wrappers) {
                // Generate TypeScript namespace for types (interfaces, type aliases)
                // This uses declaration merging with the const below
                if (wrapper.typeExports.length > 0) {
                    bundledContent += `namespace ${wrapper.alias} {\n`;
                    for (const typeExport of wrapper.typeExports) {
                        // Indent each line of the declaration
                        const indented = typeExport.declaration
                            .split('\n')
                            .map(line => `    ${line}`)
                            .join('\n');
                        bundledContent += `    export ${indented.trimStart()}\n`;
                    }
                    bundledContent += `}\n`;
                }

                // Generate const object for runtime values (functions, variables, etc.)
                if (wrapper.valueExports.length > 0) {
                    bundledContent += `const ${wrapper.alias} = {\n`;
                    bundledContent += wrapper.valueExports.map(e => `    ${e}`).join(',\n');
                    bundledContent += `\n};\n`;
                }
                bundledContent += '\n';
            }
        }
    }

    // Create project-specific output directory
    const projectDistDir = path.join(__dirname, 'dist', name);
    if (!fs.existsSync(projectDistDir)) {
        fs.mkdirSync(projectDistDir, { recursive: true });
    }

    // Write the bundled script
    const outputFilename = `${config.name}.ts`;
    const outputPath = path.join(projectDistDir, outputFilename);
    fs.writeFileSync(outputPath, bundledContent, 'utf8');

    // Write project-specific tsconfig for IDE type hints
    const tsconfigPath = path.join(projectDistDir, 'tsconfig.json');
    if (!fs.existsSync(tsconfigPath)) {
        fs.writeFileSync(tsconfigPath, generateDistTsConfig(), 'utf8');
    }

    // Show output file size
    const stats = fs.statSync(outputPath);
    const sizeKB = (stats.size / 1024).toFixed(2);
    console.log(`✅ Built: dist/${name}/${outputFilename} (${sizeKB} KB)`);

    return true;
}

async function buildAll() {
    const projectsDir = path.join(__dirname, 'projects');

    if (!fs.existsSync(projectsDir)) {
        console.error('❌ No projects/ directory found.');
        console.error('   Create a projects/ directory with subdirectories for each project.');
        console.error('   Example: projects/my-script/src/index.ts');
        return false;
    }

    // Fetch external types first
    await fetchExternalTypes(forceRefreshTypes);

    const projects = discoverProjects();

    if (projects.length === 0) {
        console.error('❌ No valid projects found in projects/ directory');
        console.error('   Each project needs a src/ directory (project.json is optional)');
        return false;
    }

    console.log(`\n📦 Found ${projects.length} project(s): ${projects.map(p => p.name).join(', ')}`);

    let allSuccess = true;
    for (const project of projects) {
        const success = await buildProject(project);
        if (!success) allSuccess = false;
    }

    console.log(`\n✅ Build complete! Built ${projects.length} project(s)`);
    return allSuccess;
}

async function buildOne(projectName) {
    // Fetch external types first
    await fetchExternalTypes(forceRefreshTypes);

    const projects = discoverProjects();
    const project = projects.find(p => p.name === projectName || p.config.name === projectName);

    if (!project) {
        console.error(`❌ Project "${projectName}" not found`);
        console.error(`   Available projects: ${projects.map(p => p.name).join(', ') || '(none)'}`);
        return false;
    }

    return await buildProject(project);
}

// =============================================================================
// Watch Mode
// =============================================================================

async function watch(projectName) {
    const projectsDir = path.join(__dirname, 'projects');

    if (!fs.existsSync(projectsDir)) {
        console.error('❌ No projects/ directory found to watch');
        return;
    }

    console.log('👀 Watching for changes...');

    if (projectName) {
        // Watch specific project
        const projectDir = path.join(projectsDir, projectName);
        if (!fs.existsSync(projectDir)) {
            console.error(`❌ Project "${projectName}" not found`);
            return;
        }

        fs.watch(projectDir, { recursive: true }, (_eventType, filename) => {
            if (filename && filename.endsWith('.ts')) {
                console.log(`\n📝 ${projectName}/${filename} changed, rebuilding...`);
                buildOne(projectName).catch(err => console.error('Build error:', err));
            }
        });
        console.log(`   Watching project: ${projectName}`);
    } else {
        // Watch all projects
        fs.watch(projectsDir, { recursive: true }, (_eventType, filename) => {
            if (filename && filename.endsWith('.ts')) {
                // Extract project name from path
                const parts = filename.split(path.sep);
                const changedProject = parts[0];

                console.log(`\n📝 ${filename} changed, rebuilding ${changedProject}...`);
                buildOne(changedProject).catch(err => console.error('Build error:', err));
            }
        });
        console.log('   Watching all projects');
    }

    // Initial build
    if (projectName) {
        await buildOne(projectName);
    } else {
        await buildAll();
    }
}

// =============================================================================
// CLI Entry Point
// =============================================================================

function showHelp() {
    console.log(`
NovelAI Script Build System

Usage:
  node build.js [options] [project-name]

Options:
  --watch          Watch for changes and rebuild automatically
  --refresh-types  Force download fresh NovelAI type definitions
  --help           Show this help message

Examples:
  node build.js                    Build all projects
  node build.js my-script          Build only "my-script" project
  node build.js --watch            Watch and rebuild all projects
  node build.js --watch my-script  Watch specific project
  node build.js --refresh-types    Build with fresh type definitions

Project Structure:
  /projects/
    /my-script/
      /project.json       Project configuration (optional)
      /src/
        /index.ts         Main entry point
        /utils.ts         Additional source files
    /another-script/
      /project.json
      /src/
        /index.ts
  /dist/                  Built outputs
    /my-script/
      /my-script.ts       Ready to paste into NovelAI
    /another-script/
      /another-script.ts

project.json format:
  {
    "name": "my-script",
    "version": "1.0.0",
    "author": "Your Name",
    "description": "Script description",
    "license": "MIT",
    "sourceFiles": [
      "src/utils.ts",
      "src/index.ts"
    ]
  }

Note: If project.json is missing, source files are auto-discovered from src/
`);
}

if (args.includes('--help')) {
    showHelp();
    process.exit(0);
}

// Run build or watch
if (isWatch) {
    watch(projectArg).catch(err => {
        console.error('Watch error:', err);
        process.exit(1);
    });
} else if (projectArg) {
    buildOne(projectArg).then(success => {
        process.exit(success ? 0 : 1);
    }).catch(err => {
        console.error('Build error:', err);
        process.exit(1);
    });
} else {
    buildAll().then(success => {
        process.exit(success ? 0 : 1);
    }).catch(err => {
        console.error('Build error:', err);
        process.exit(1);
    });
}
