const core = require("./core");

async function main() {
    await core.preScript()
    await core.gitPull()
    let commits = await core.gitListCommits();
    let selectedCommits = await core.selectCommits(commits);
    await core.confirmDeploy(selectedCommits);
    await core.postScript()
}

main();
