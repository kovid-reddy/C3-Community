/**
 * Dependency & Architectural Validation Script for C3 Monorepo
 * Enforces strict DAG dependency rules and Foundation package isolation.
 */

const fs = require('fs');
const path = require('path');

const PACKAGES_DIR = path.join(__dirname, '..', 'packages');

const FORBIDDEN_FOUNDATION_IMPORTS = [
  '@c3/auth',
  '@c3/cloud',
  '@c3/cluster',
  '@c3/compute',
  '@c3/discovery',
  '@c3/hardware',
  '@c3/jobs',
  '@c3/provider',
  'aws-sdk',
  '@aws-sdk',
  'dockerode',
  'kubernetes-client',
  'electron',
  'react',
  'react-dom',
];

function getAllTsFiles(dir, filesList = []) {
  if (!fs.existsSync(dir)) return filesList;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      getAllTsFiles(filePath, filesList);
    } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
      filesList.push(filePath);
    }
  }
  return filesList;
}

function verifyFoundationIsolation() {
  console.log('🔍 Checking Foundation package isolation...');
  const foundationSrc = path.join(PACKAGES_DIR, 'foundation', 'src');
  const tsFiles = getAllTsFiles(foundationSrc);

  let errors = 0;

  for (const file of tsFiles) {
    const content = fs.readFileSync(file, 'utf8');
    const importLines = content.match(/import\s+.*?from\s+['"]([^'"]+)['"]/g) || [];

    for (const line of importLines) {
      const match = line.match(/from\s+['"]([^'"]+)['"]/);
      if (match) {
        const importPath = match[1];

        for (const forbidden of FORBIDDEN_FOUNDATION_IMPORTS) {
          if (importPath === forbidden || importPath.startsWith(`${forbidden}/`)) {
            console.error(`❌ Dependency Error in ${file}: Foundation illegally imports '${importPath}'`);
            errors++;
          }
        }
      }
    }
  }

  if (errors > 0) {
    console.error(`❌ Foundation package isolation failed with ${errors} error(s).`);
    process.exit(1);
  } else {
    console.log('✅ Foundation package isolation verified successfully. No forbidden dependencies found.');
  }
}

function verifyMonorepoDag() {
  console.log('🔍 Checking Monorepo package dependency graph...');
  const packageDirs = fs.readdirSync(PACKAGES_DIR).filter((f) => {
    return fs.statSync(path.join(PACKAGES_DIR, f)).isDirectory();
  });

  const graph = {};

  for (const pkg of packageDirs) {
    const pkgJsonPath = path.join(PACKAGES_DIR, pkg, 'package.json');
    if (fs.existsSync(pkgJsonPath)) {
      const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
      const deps = Object.keys(pkgJson.dependencies || {}).concat(Object.keys(pkgJson.devDependencies || {}));
      graph[`@c3/${pkg}`] = deps.filter((d) => d.startsWith('@c3/'));
    }
  }

  // Foundation must have 0 dependencies on other @c3 packages except @c3/contracts
  const foundationDeps = graph['@c3/foundation'] || [];
  const invalidFoundationDeps = foundationDeps.filter((d) => d !== '@c3/contracts');
  if (invalidFoundationDeps.length > 0) {
    console.error(`❌ Architecture Error: @c3/foundation has illegal package dependencies: ${invalidFoundationDeps.join(', ')}`);
    process.exit(1);
  }

  console.log('✅ Monorepo DAG dependency graph verified successfully.');
}

console.log('=== C3 Monorepo Dependency Verification ===');
verifyFoundationIsolation();
verifyMonorepoDag();
console.log('=== All Dependency Rules Passed ===');
