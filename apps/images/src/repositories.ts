import { defaults, type Settings } from "./github";

// Deployment-owned pool. Keep old repositories here so their images remain visible.
// The page token must have Contents read/write access to every repository.
export const repositories: readonly Settings[] = [
  defaults,
  { ...defaults, repo: "hugh-image-02" },
  { ...defaults, repo: "hugh-image-03" },
];
