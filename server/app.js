/* jshint esversion: 10 */

const fs = require('fs');
const path = require('path');
const express = require("express");
const app = express();
const server = require("http").createServer(app);
const io = require("socket.io")(server);
const router = require("./router.js")
const { exec } = require('child_process');
const gpio = require('onoff').Gpio;

const port = 3000
const settingsFile = "settings.json"

router.route(express, app);

let startTime = 0;
let data = []
let proceses = []
let timeouts = 0;
let interval = undefined;
let stream = undefined;
let syncPin = undefined;
let settings = {
    logging: {
        logsSave: true,
        logsStdout: true
    },
    cloud: {
        cloudURL: "",
        cloudName: "",
        cloudPasswd: ""
    },
    sync: {
        gpioPin: -1,
        gpioActive: "high"
    }
};

if (!fs.existsSync("./download")) {
    fs.mkdir("./download", (err) => {
        console.log(err);
    })
}
fs.readFile(settingsFile, 'utf-8', (err, file) => {
    if (!err) {
        settings = JSON.parse(file);
        console.log(settings);
    }
});

//https://stackoverflow.com/a/42182416/12231900
function deleteFolderRecursive(directory) {
    fs.readdir(directory, (err, files) => {
        if (err) throw err;

        for (const file of files) {
            fs.unlink(path.join(directory, file), err => {
                if (err) throw err;
            });
        }
    });
};

function writeStream(id, message) {
    const time = (new Date()).getTime();
    const deltaTime = time - startTime;
    io.emit("log", `\x1B[0;34m${time}\x1B[0m ; \x1B[1;36m${deltaTime}\x1B[0m\t ; \x1B[0;32m${id}\x1B[0m\t ; ${message}`);
    if (settings.logging.logsSave && stream && stream.writable) {
        stream.write(`${time} ; ${deltaTime} ; ${id} ; ${message}`);
    }
}

function addActual(actual) {

    const obj = {
        id: `${actual.id}-actual`,
        group: 1,
        start: actual.userData.actual.start,
        end: actual.userData.actual.end,
        content: actual.content,
        className: `${actual.className} actual`,
        editable: false,
        userData: actual.userData
    }

    const idx = data.findIndex((d) => {
        console.log(d.id, obj.id, d.id == obj.id)
        return d.id == obj.id;
    })
    console.log(idx)
    if (idx > -1) {
        data[idx] = obj
    } else {
        data.push(obj)
    }

}

function commandDone(idx) {
    data[idx].userData.actual.end = (new Date()).getTime() - startTime;
    addActual(data[idx]);
    timeouts -= 1;

    if (timeouts == 0) {
        writeStream("----", `Execution done\r\n\r\n`);
        clearInterval(interval);
        if (syncPin) {
            syncPin.write(settings.sync.gpioActive == "high" ? 0 : 1);
        }

        data = modifyAllCommands(data, false);
        io.emit("end", data);

        deleteFolderRecursive("./download");
        
        const dirCont = fs.readdirSync("./");
        const files = dirCont.filter( function( elm ) {return elm.match(/.*\.(db)/ig);});
        if(files.length > 0)    {
        fs.unlink(files[0], (err) => {
            console.log(err)
        });
    }

        proceses = [];
        if (settings.logging.logsSave) {
            stream.cork();
            setTimeout(() => {
                stream.end();
            }, 200);
        }
    }
}

function modifyAllCommands(d, forward) {
    d.forEach(e => {
        e = modifyCommand(e, forward);
    });
    return d;
}

function modifyCommand(d, forward) {
    switch (d.userData.type) {
        case "download":
            if (forward) {
                d.userData.command = d.userData.command.replace("NEXTCLOUD_USERNAME", settings.cloud.cloudName);
                d.userData.command = d.userData.command.replace("NEXTCLOUD_PASSWORD", settings.cloud.cloudPasswd);
                d.userData.command = d.userData.command.replace("NEXTCLOUD_URL", settings.cloud.cloudURL);
            } else {
                d.userData.command = d.userData.command.replace(settings.cloud.cloudName, "NEXTCLOUD_USERNAME");
                d.userData.command = d.userData.command.replace(settings.cloud.cloudPasswd, "NEXTCLOUD_PASSWORD");
                d.userData.command = d.userData.command.replace(settings.cloud.cloudURL, "NEXTCLOUD_URL");
            }
            break;
    }
    return d;
}

function execCommand(index, data, command) {
    console.log(`Starting Command Execution ${data.id}`);
    writeStream(data.id, "Starting Execution\r\n")
    console.log(command)
    const child = exec(command);
    proceses[index] = (child);

    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk) => {
        if (settings.logging.logsStdout) {
            const lines = chunk.split('\n');
            for (const l in lines) {
                if (lines[l] != "")
                    writeStream(data.id, lines[l] + "\r\n")
            }
        }
        // console.log(chunk)
    });

    child.on('close', (code) => {
        writeStream(data.id, `Execution ended with Code ${code}\r\n`)
        console.log(`child process exited with code ${code}`);
        if (code != null) {

            if (data.userData.retrigger) {
                if (proceses[index] != undefined) {
                    execCommand(index, data, command);
                }
            } else {
                proceses[index] = undefined;
                commandDone(index);
            }
        }
    });
}

function handleData() {
    data = data.filter((d) => {
        return d.group == 0;
    });

    if (data.filter((d) => {
            return d.group == 0;
        }) < 1) {
        return;
    }

    data = modifyAllCommands(data, true)

    if (syncPin) {
        syncPin.write(settings.sync.gpioActive == "high" ? 1 : 0)
    }

    if (settings.logging.logsSave) {
        stream = fs.createWriteStream(path.join(__dirname, "../logs/", `output-${Math.floor((new Date()).getTime() / 1000)}.log`));
        stream.write("Actual Timestamp ; Relative Timestamp ; ID ; Message\r\n")
    }

    // assuming data is valid
    startTime = (new Date()).getTime();
    // set timeouts
    interval = setInterval(() => {
        io.emit("currentTime", {
            currentTime: (new Date()).getTime() - startTime
        });
    }, 200)

    for (const idx in data) {
        if (data[idx].group == 0) {
            timeouts += 1;
            setTimeout(() => {
                console.log("Starting Task", data[idx].id, data[idx].group);
                writeStream(data[idx].id, "Starting Task\r\n")

                setTimeout(() => {
                    if (proceses[idx] != undefined) {
                        console.log("Ending Task", data[idx].id);
                        writeStream(data[idx].id, "Ending Task\r\n")

                        proceses[idx].kill('SIGINT');
                        proceses[idx].kill('SIGKILL');
                        proceses[idx] = undefined;
                        commandDone(idx);
                    }
                }, (data[idx].end - data[idx].start));

                execCommand(idx, data[idx], data[idx].userData.command);
                data[idx].userData.actual.start = (new Date()).getTime() - startTime;

            }, data[idx].start);
        }
    }
}

io.on("connection", (socket) => {
    console.log("connection from", socket.request.connection.remoteAddress);

    socket.on("data", (_data) => {
        data = modifyAllCommands(_data, false)
        socket.broadcast.emit("data", data)
    })
    socket.on("start", (_data) => {
        data = modifyAllCommands(_data, false)
        socket.broadcast.emit("data", data)
        handleData()
    });
    socket.on("set-settings", (_settings) => {
        settings = _settings;
        socket.broadcast.emit("set-settings", settings);

        fs.writeFile(settingsFile, JSON.stringify(settings), (err) => {
            if (err) {
                throw err;
            }
            console.log("Saved settings");
        });

        if (syncPin != undefined) {
            syncPin.unexport();
        }
        if (process.platform == "linux" && settings.sync.gpioPin >= 0) {
            syncPin = new gpio(settings.sync.gpioPin, "out");
            syncPin.write(settings.sync.gpioActive == "high" ? 0 : 1)
        } else {
            syncPin = undefined;
        }

    });

    socket.emit("set-settings", settings);
    socket.emit("data", data);
});

process.on('SIGINT', () => {
    if (syncPin) {
        syncPin.unexport()
    }
    process.exit(1)
});

server.listen(port);