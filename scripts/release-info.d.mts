export type ReleaseInfoInput = {
  packageName: string;
  packageVersion: string;
  tagName: string;
};

export type ReleaseInfo = {
  version: string;
  tag: 'latest' | 'next';
  packageSpec: string;
};

export function getReleaseInfo(input: ReleaseInfoInput): ReleaseInfo;
