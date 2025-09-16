import fs from 'fs';

const projectPath = process.argv[2];

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

console.log(JSON.stringify(dependencyTree, null, 2));
//
// const writeToMermaid = (depTree) => {
//     let mermaidStr = 'flowchart TD\n';
//     const edges = new Set();
//
//     const traverse = (node) => {
//         if (node.children) {
//             node.children.forEach(child => {
//                 edges.add(`    ["${node.name}"] --> ["${child.name}"]`);
//                 traverse(child);
//             });
//         }
//     };
//     depTree.forEach(traverse);
//     mermaidStr += Array.from(edges).join('\n');
//     return mermaidStr;
// };
//
// const mermaidOutput = writeToMermaid(dependencyTree);
// fs.writeFileSync(`${projectPath}/dependency-tree.mmd`, mermaidOutput);
// console.log(`Mermaid diagram written to ${projectPath}/dependency-tree.mmd`);