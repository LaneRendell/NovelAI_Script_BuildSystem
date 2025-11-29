const fs = require('fs');
const path = require('path');
const https = require('https');

// Parse command line arguments
const args = process.argv.slice(2);
const isWatch = args.includes('--watch');
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

function fetchExternalTypes() {
    return new Promise((resolve, reject) => {
        const url = 'https://novelai.github.io/scripting/types/script-types.d.ts';
        const outputPath = path.join(__dirname, 'external', 'script-types.d.ts');

        // Check if file already exists and is less than 24 hours old
        if (fs.existsSync(outputPath)) {
            const stats = fs.statSync(outputPath);
            const age = Date.now() - stats.mtimeMs;
            const hoursOld = age / (1000 * 60 * 60);

            if (hoursOld < 24) {
                console.log('✓ Using cached NovelAI type definitions');
                resolve();
                return;
            }
        }

        console.log('📥 Fetching NovelAI type definitions...');

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

    let bundledContent = generateScriptHeader(config);

    for (const file of config.sourceFiles) {
        const filePath = path.join(projectPath, file);

        if (!fs.existsSync(filePath)) {
            console.warn(`⚠️  Skipping missing file: ${file}`);
            continue;
        }

        let content = fs.readFileSync(filePath, 'utf8');

        // Remove imports and exports
        content = removeImportsExports(content);

        // Add file separator comment
        bundledContent += `\n// ============================================================================\n`;
        bundledContent += `// ${file}\n`;
        bundledContent += `// ============================================================================\n\n`;
        bundledContent += content;
        bundledContent += '\n';
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
    await fetchExternalTypes();

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
    await fetchExternalTypes();

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
  --watch    Watch for changes and rebuild automatically
  --help     Show this help message

Examples:
  node build.js              Build all projects
  node build.js my-script    Build only "my-script" project
  node build.js --watch      Watch and rebuild all projects
  node build.js --watch my-script  Watch specific project

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
