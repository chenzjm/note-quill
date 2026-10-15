import { readFileSync, writeFileSync } from "fs";

const manifest = JSON.parse(readFileSync("manifest.json", "utf8"));
const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
const versions = JSON.parse(readFileSync("versions.json", "utf8"));

// npm 10 起不再把新版本号作为参数传给 version 脚本，改从 npm_package_version 取；
// 直接调用时仍支持 `node version-bump.mjs 1.2.3`
const targetVersion = process.argv[2] ?? process.env.npm_package_version;

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
