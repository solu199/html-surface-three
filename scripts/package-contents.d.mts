export type PublicPackageManifest = {
  name?: string;
  version?: string;
  license?: string;
  publishConfig?: {
    access?: string;
  };
};

export function assertPublicPackage(input: {
  files: string[];
  manifest: PublicPackageManifest;
}): void;
