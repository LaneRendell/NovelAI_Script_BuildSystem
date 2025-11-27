const fs = require('fs');
const path = require('path');
const https = require('https');

const isWatch = process.argv.includes('--watch');

// Ensure dist and external directories exist
if (!fs.existsSync('dist')) {
    fs.mkdirSync('dist', { recursive: true });
}
if (!fs.existsSync('external')) {
    fs.mkdirSync('external', { recursive: true });
}

// Fetch external type definitions
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

// Script metadata header
const scriptHeader = `/**
 * Your Script Name
 * Version: Current Version
 * Author: Your Name <your.email@example.com>
 * Description: Your script description here.
 * License: Your License
 *
 * Additional information or links can go here.
 */

`;

// Files in dependency order (no imports/exports needed in final bundle)
// IMPORTANT: List files in dependency order - dependencies first, then files that use them
const sourceFiles = [
    'src/utils.ts',    // Utilities must come first since index.ts imports from it
    'src/index.ts',    // Main entry point comes last
    // Add your additional source files here in dependency order
];

function removeImportsExports(content) {
    // Remove import statements (including multiline imports and type imports)
    // Use [\s\S] to match any character including newlines
    content = content.replace(/^import\s+type\s+[\s\S]*?from\s+['"].*?['"];?\s*\n?/gm, '');
    content = content.replace(/^import\s+[\s\S]*?from\s+['"].*?['"];?\s*\n?/gm, '');
    content = content.replace(/^\/\/.*import.*from.*\n?/gm, '');

    // Remove export keywords (but keep the declarations)
    content = content.replace(/^export\s+/gm, '');

    return content;
}

async function bundleTypeScript() {
    try {
        // Fetch external types first
        await fetchExternalTypes();

        let bundledContent = scriptHeader;

        for (const file of sourceFiles) {
            const filePath = path.join(__dirname, file);

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

        // Write to output file
        const outputPath = path.join(__dirname, 'dist', 'yourscriptname.ts');
        fs.writeFileSync(outputPath, bundledContent, 'utf8');

        console.log('✅ Build complete!');

        // Show output file size
        const stats = fs.statSync(outputPath);
        const sizeKB = (stats.size / 1024).toFixed(2);
        console.log(`📦 Output: dist/yourscriptname.ts (${sizeKB} KB)`);

        return true;
    } catch (error) {
        console.error('❌ Build failed:', error);
        return false;
    }
}

async function watch() {
    console.log('👀 Watching for changes...');

    const srcDir = path.join(__dirname, 'src');

    fs.watch(srcDir, { recursive: true }, (eventType, filename) => {
        if (filename && filename.endsWith('.ts')) {
            console.log(`\n📝 ${filename} changed, rebuilding...`);
            bundleTypeScript().catch(err => console.error('Build error:', err));
        }
    });

    // Initial build
    await bundleTypeScript();
}

// Run build or watch
if (isWatch) {
    watch().catch(err => {
        console.error('Watch error:', err);
        process.exit(1);
    });
} else {
    bundleTypeScript().then(success => {
        process.exit(success ? 0 : 1);
    }).catch(err => {
        console.error('Build error:', err);
        process.exit(1);
    });
}
