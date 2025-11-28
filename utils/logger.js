const fs = require('fs');
const path = require('path');

const loggerPath = path.join(__dirname, '../logs/system.log');

if (!fs.existsSync(path.dirname(loggerPath))) {
    fs.mkdirSync(path.dirname(loggerPath));
}

function log(type, message) {
    const timestamp = new Date().toISOString();
    const line = `> ${type}: [ ${timestamp} ]  ${message}\n`;

    fs.appendFile(loggerPath, line, (err) => {
        if (err) {
            console.error("Logger error: ", err);
        }
    });
}

function action(message) {
    log("ACTION", message);
}

function error(message) {
    log("ERROR", message);
}

module.exports = { action, error };