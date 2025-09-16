import fs from 'fs';
import * as child_process from "node:child_process";

const projectPath = process.argv[2];
const flags = process.argv.slice(3);

if (!projectPath) {
    console.error('Please provide a project path as an argument.');
    process.exit(1);
}

const packageJsonPath = `${projectPath}/package.json`;

if (!fs.existsSync(packageJsonPath)) {
    console.error(`No package.json found in the specified path: ${projectPath}`);
    process.exit(1);
}

const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

if (!packageJson.dependencies) {
    console.error('No dependencies section found in package.json.');
    process.exit(1);
}

if(!flags.includes('--skip-install')){
    console.log('Installing dependencies...');
    child_process.execSync('npm i', { cwd: projectPath });
}

const dependencies = packageJson.dependencies;
const devDependencies = packageJson.devDependencies || {};
const peerDependencies = packageJson.peerDependencies || {};

const allDependencies = { ...dependencies, ...devDependencies, ...peerDependencies };

const buildDependencyTree = (depName, visited = new Set()) => {
    if (visited.has(depName)) {
        return { name: depName, version: allDependencies[depName], circular: true };
    }
    visited.add(depName);

    const depPackageJsonPath = `${projectPath}/node_modules/${depName}/package.json`;
    if (!fs.existsSync(depPackageJsonPath)) {
        return { name: depName, version: allDependencies[depName], missing: true };
    }

    const depPackageJson = JSON.parse(fs.readFileSync(depPackageJsonPath, 'utf-8'));
    const subDeps = { ...depPackageJson.dependencies, ...depPackageJson.peerDependencies };

    const children = Object.keys(subDeps || {}).map(subDep => buildDependencyTree(subDep, new Set(visited)));

    return { name: depName, version: allDependencies[depName], children };
};

const dependencyTree = Object.keys(dependencies).map(dep => buildDependencyTree(dep));

// console.log(JSON.stringify(dependencyTree, null, 2));

const packages = {};
const reversePackagesMap = {};

let nextId = 1001;

const buildUniqueIds = (node) => {
    node.forEach(dep => {
        const key = `${dep.name}@${dep.version}`;
        if (!packages[key]) {
            packages[key] = nextId;
            reversePackagesMap[nextId] = key;
            nextId++;
        }
        if (dep.children && dep.children.length > 0) {
            buildUniqueIds(dep.children);
        }
    });
}

dependencyTree.forEach(dep => {
    buildUniqueIds([dep]);
})

// Object.keys(packages).forEach((key)=>{
//     console.log(`${packages[key]}: ${key}`);
// })

const writeToMermaid = (depTree) => {
    let mermaidStr = 'flowchart TD\n';
    const edges = new Set();

    const traverse = (node) => {
        if (node.children) {
            node.children.forEach(child => {
                edges.add(`    ${packages[node.name + '@' + node.version]}["${node.name}@${node.version}"] --> ${packages[child.name + '@' + child.version]}["${child.name}: ${child.version}"]`);
                traverse(child);
            });
        }
    };
    depTree.forEach(traverse);
    mermaidStr += Array.from(edges).join('\n');
    return mermaidStr;
};

const mermaidOutput = writeToMermaid(dependencyTree);

//write to html file
const htmlContent = `
<!DOCTYPE html>
<html lang="en">
    <head>
        <meta charset="UTF-8">
        <title>Large Mermaid Diagram</title>
    </head>
    <body>

        <pre class="mermaid">
            ${mermaidOutput}
        </pre>
        <script type="module">
            import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs';
            mermaid.initialize({
                startOnLoad: true,
                theme: 'default',
                flowchart: {},
                maxEdges: 2000,
                maxTextSize: 100000,
            });
        </script>
    </body>
</html>
`;

fs.writeFileSync('dependency-graph.html', htmlContent);

console.log('Dependency graph written to dependency-graph.html');
console.log('Open this file in a web browser to view the graph.');