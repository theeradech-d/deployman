const path = require("path");
const fs = require("fs");
const { exec } = require("child_process");
const config = require("./config");

function gitPull() {
    const repoPath = config.sourceDir;

    const projectPath = path.resolve(__dirname, repoPath);

    exec(`cd ${projectPath} && git pull`, (error, stdout, stderr) => {
        if (error) {
            console.error(`exec error: ${error}`);
            return;
        }

        console.log(`stdout: ${stdout}`);
        console.error(`stderr: ${stderr}`);

        const updatedFiles = listFileInGitPullLog(stdout);

        console.log(updatedFiles);

        copyToDest(updatedFiles);
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
    const logFilePath = path.resolve(__dirname, 'logs', `log-${currentDate}.log`);

    let logData = ""; // create empty log data

    logData += `\n${currentDateTimeFormat}\n`;

    filesToCopy.forEach((f) => {
        let file = f.fileName;
        let type = f.type;

        const sourcePath = path.join(sourceDir, file);
        const destPath = path.join(destDir, file);

        if (type == "delete") {
            fs.unlinkSync(destPath);
            logData += `    - ${file} - delete\n`;
        } else {
            let dirname = path.dirname(destPath)
            if (!fs.existsSync(dirname)) {
                fs.mkdirSync(dirname, { recursive: true });
            }
            if (fs.existsSync(destPath)) {
                let bakName = `${file}.bak.${currentDateTime}`;
                const bakPath = path.join(destDir, bakName);
                fs.renameSync(destPath, bakPath);
                logData += `    - ${file} - exist (backup to ${bakName})\n`;
            } else {
                logData += `    - ${file} - new\n`;
            }
            fs.copyFileSync(sourcePath, destPath);
        }
    });

    fs.appendFileSync(logFilePath, logData);
}

module.exports = {
    gitPull,
    listFileInGitPullLog,
    copyToDest,
};
