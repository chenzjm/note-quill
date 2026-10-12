import { readFileSync, writeFileSync } from "fs";

const manifest = JSON.parse(readFileSync("manifest.json", "utf8"));
const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
const versions = JSON.parse(readFileSync("versions.json", "utf8"));

const targetVersion = process.argv[2];

if (!targetVersion) {
	console.error("Missing target version!");
	process.exit(1);
}

if (!/^\d+\.\d+\.\d+$/.test(targetVersion)) {
	console.error("Target version must follow: x.y.z");
	process.exit(1);
}

manifest.version = targetVersion;
packageJson.version = targetVersion;
versions[targetVersion] = manifest.minAppVersion;

writeFileSync("manifest.json", JSON.stringify(manifest, null, "\t") + "\n");
writeFileSync("package.json", JSON.stringify(packageJson, null, "\t") + "\n");
writeFileSync("versions.json", JSON.stringify(versions, null, "\t") + "\n");

console.log(`Bumped version to ${targetVersion}`);
