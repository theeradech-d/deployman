const core = require("./core");

async function main() {
    await core.gitPull()
    let commits = await core.gitListCommits();
    let selectedCommits = await core.selectCommits(commits);
    await core.confirmDeploy(selectedCommits);
}

main();
