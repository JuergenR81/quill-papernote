import { $ } from "execa";

// The release commit and tag are made by CI, so they are attributed to the Actions bot
// rather than to a person who did not run them. Deliberately --local: a global write
// would outlive the checkout and silently relabel every later commit on that machine,
// which is exactly what happens when this script is run outside CI by accident.
async function configGit() {
  await $`git config --local user.name ${"github-actions[bot]"}`;
  await $`git config --local user.email ${"41898282+github-actions[bot]@users.noreply.github.com"}`;
}

export default configGit;
