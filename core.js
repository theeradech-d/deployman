const path = require("path");
const fs = require("fs");
const { exec } = require("child_process");
const config = require("./config");
const { prompt, MultiSelect, Confirm } = require("enquirer");

function gitListCommits() {
    return new Promise((resolve, reject) => {
        const repoPath = config.sourceDir;

        const projectPath = path.resolve(__dirname, repoPath);

        exec(
            `cd ${projectPath} && git log -20 --pretty=format:"%h---%s---%cd" --date=format:'%Y-%m-%d %H:%M:%S'`,
            async (error, stdout, stderr) => {
                if (error) {
                    console.error(`exec error: ${error}`);
                    reject(error);
                    return;
                }

                // console.log(`stdout: ${stdout}`);
                // console.error(`stderr: ${stderr}`);

                let lists = stdout.split("\n").map((row) => {
                    const [id, comment, date] = row.split("---");
                    return {
                        id,
                        comment,
                        date,
                        name: `${id} - ${date} - ${comment} `,
                        value: id,
                    };
                });

                resolve(lists);
            }
        );
    });
}

async function selectCommits(lists) {
    const prompt = new MultiSelect({
        name: "value",
        message: "Pick commits",
        limit: 20,
        choices: lists,
        result(names) {
            return this.map(names);
        },
    });

    return prompt.run().then((answer) => {
        let data = [];
        Object.keys(answer).forEach((name) => {
            let id = answer[name];
            data.push({
                id,
                name,
            });
        });

        return data;
    });
}

function listFilesInCommitId(commitId) {
    return new Promise((resolve, reject) => {
        const repoPath = config.sourceDir;

        const projectPath = path.resolve(__dirname, repoPath);

        exec(
            `cd ${projectPath} && git diff-tree --no-commit-id --name-status -r ${commitId}`,
            async (error, stdout, stderr) => {
                if (error) {
                    console.error(`exec error: ${error}`);
                    reject(error);
                    return;
                }

                console.log(stdout);

                let lists = stdout
                    .trim()
                    .split("\n")
                    .map((o) => o.trim().split("\t"))
                    .filter((o) => o[0] && o[1])
                    .map((o) => {
                        let type = "";
                        switch (o[0]) {
                            case "A":
                                type = "add";
                                break;
                            case "M":
                                type = "update";
                                break;
                            case "D":
                                type = "delete";
                                break;
                            default:
                                type = "unknow";
                                break;
                        }
                        return {
                            type,
                            fileName: o[1],
                        };
                    });

                resolve(lists);
            }
        );
    });
}

async function confirmDeploy(_commits) {
    let commits = _commits.reverse();

    let allFiles = [];
    for (let index = 0; index < commits.length; index++) {
        const commit = commits[index];
        let files = await listFilesInCommitId(commit.id);

        // console.log({
        //     commit,
        //     files,
        // });

        allFiles = [...allFiles, ...files];
    }

    if (allFiles.length == 0) {
        console.error("no files");
        return;
    }

    const prompt = new Confirm({
        name: "question",
        message: "Confirm deploys?",
    });

    console.table(allFiles);

    let confirm = await prompt.run();

    if (confirm) {
        copyToDest(allFiles);
    }
}

function gitPull() {
    return new Promise((resolve, reject) => {
        const repoPath = config.sourceDir;

        const projectPath = path.resolve(__dirname, repoPath);

        const shell = `cd ${projectPath} && git pull`;
        console.log(shell);
        exec(shell, (error, stdout, stderr) => {
            if (error) {
                console.error(`exec error: ${error}`);
                reject(error);
                return;
            }

            console.log(`stdout: ${stdout}`);
            console.error(`stderr: ${stderr}`);

            resolve();

            // const updatedFiles = listFileInGitPullLog(stdout);

            // console.log(updatedFiles);

            // copyToDest(updatedFiles);
        });
    });
}

function listFileInGitPullLog(stdout) {
    const updatedFiles = stdout
        .split("\n")
        .filter((line) => line.includes("|"))
        .map((line) => {
            let lineArray = line.trim().split("|");
            let fileName = lineArray[0].trim();
            let type = "";

            let plusText = lineArray[1].trim().split(" ")[1];

            if (plusText == "+") {
                type = "update";
            } else if (plusText == "-") {
                type = "delete";
            } else if (plusText.includes("+") && plusText.includes("-")) {
                type = "update";
            }
            return {
                fileName,
                type,
            };
        });

    return updatedFiles;
}

function copyToDest(filesToCopy) {
    const currentDate = new Date().toISOString().slice(0, 10); // get current date in ISO format
    const currentDateTime = new Date()
        .toISOString()
        .slice(0, 19)
        .replace(/T/g, "_")
        .replace(/:/g, "-"); // get current date in ISO format
    const currentDateTimeFormat = new Date().toISOString(); // get current date in ISO format

    const sourceDir = config.sourceDir;
    const destDir = config.destDir;
    const logFilePath = path.resolve(
        __dirname,
        "logs",
        `log-${currentDate}.log`
    );

    let logData = ""; // create empty log data

    logData += `\n${currentDateTimeFormat}\n`;

    for (let index = 0; index < filesToCopy.length; index++) {
        const f = filesToCopy[index];
        let file = f.fileName;
        let type = f.type;

        const sourcePath = path.join(sourceDir, file);
        const destPath = path.join(destDir, file);

        if (type == "delete") {
            if (fs.existsSync(destPath)) {
                let bakName = `${file}.bak.delete.${currentDateTime}`;
                const bakPath = path.join(destDir, bakName);
                fs.renameSync(destPath, bakPath);
                logData += `    - ${file} - delete (backup to ${bakName})\n`;
            }else{
                logData += `    - ${file} - delete_is_not_exist\n`;
            }
        } else {
            let dirname = path.dirname(destPath);
            if (!fs.existsSync(dirname)) {
                fs.mkdirSync(dirname, { recursive: true });
            }
            if (fs.existsSync(destPath)) {
                let bakName = `${file}.bak.${currentDateTime}`;
                const bakPath = path.join(destDir, bakName);
                fs.renameSync(destPath, bakPath);
                logData += `    - ${file} - exist (backup to ${bakName})\n`;
            } else {
                if (fs.existsSync(sourcePath)) {
                    logData += `    - ${file} - new\n`;
                } else {
                    logData += `    - ${file} - new_is_not_exist\n`;
                }
            }

            if (fs.existsSync(sourcePath)) {
                fs.copyFileSync(sourcePath, destPath);
            }
        }
    }

    fs.appendFileSync(logFilePath, logData);

    console.log(logData);
}

module.exports = {
    gitListCommits,
    selectCommits,
    confirmDeploy,
    gitPull,
    listFileInGitPullLog,
    copyToDest,
};
