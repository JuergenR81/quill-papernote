import { $ } from "execa";

// The release commit and tag are made by CI, so they are attributed to the Actions bot
// rather than to a person who did not run them.
async function configGit() {
  await $`git config --global user.name ${"github-actions[bot]"}`;
  await $`git config --global user.email ${"41898282+github-actions[bot]@users.noreply.github.com"}`;
}

export default configGit;
