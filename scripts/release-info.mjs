import { appendFile, readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const SEMVER_PATTERN =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;

export function getReleaseInfo({
  packageName,
  packageVersion,
  tagName,
}) {
  if (!SEMVER_PATTERN.test(packageVersion)) {
    throw new Error(
      `Package version must be a valid semantic version: ${packageVersion}`,
    );
  }
  if (!tagName.startsWith('v')) {
    throw new Error(`Release tag must start with v: ${tagName}`);
  }

  const taggedVersion = tagName.slice(1);
  if (taggedVersion !== packageVersion) {
    throw new Error(
      `Release tag ${tagName} does not match package version ${packageVersion}`,
    );
  }

  return {
    version: packageVersion,
    tag: packageVersion.includes('-') ? 'next' : 'latest',
    packageSpec: `${packageName}@${packageVersion}`,
  };
}

async function run() {
  const manifest = JSON.parse(
    await readFile(new URL('../package.json', import.meta.url), 'utf8'),
  );
  const tagName = process.env.RELEASE_TAG ?? process.env.GITHUB_REF_NAME;
  if (!tagName) {
    throw new Error('RELEASE_TAG or GITHUB_REF_NAME is required.');
  }

  const release = getReleaseInfo({
    packageName: manifest.name,
    packageVersion: manifest.version,
    tagName,
  });

  if (process.env.GITHUB_OUTPUT) {
    await appendFile(
      process.env.GITHUB_OUTPUT,
      [
        `version=${release.version}`,
        `tag=${release.tag}`,
        `package_spec=${release.packageSpec}`,
        '',
      ].join('\n'),
    );
    return;
  }

  console.log(JSON.stringify(release));
}

const entryPoint = process.argv[1]
  ? pathToFileURL(process.argv[1]).href
  : undefined;

if (entryPoint === import.meta.url) {
  await run();
}
