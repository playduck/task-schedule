/* jshint esversion: 9 */

const { initTaskbar } = require("./taskbar.js");
const { initSettings, setSettings } = require("./settings.js");
import { Timeline, DataSet } from "vis-timeline/standalone";
import { io } from "socket.io-client";

import { Terminal } from "xterm";
import { FitAddon } from 'xterm-addon-fit';


const start_timeline = 0;
const end_timeline = 10 * 60 * 1000;
const edit = document.getElementById("edit");

let selectedItemId;
let items = new DataSet();
let groups = new DataSet();
let timeline;
let terminal;
let fitAddon;

const socket = io();
socket.on('connect', () => {
    // console.log("connected")
    items.remove(getItems());
    document.getElementById("header").classList.add("connected");

    socket.on("disconnect", () => {
        document.getElementById("header").classList.remove("connected");
    });

    socket.on("log", (_data) => {
        terminal.write(_data);
    });

    socket.on("data", (_data) => {
        handleDataUpdate(_data);
    });

    socket.on("currentTime", (_data) => {
        document.getElementById("guard").classList.add("guard");
        timeline.setCustomTime(_data.currentTime, "currentTime");
        timeline.moveTo(_data.currentTime, {
            animation: { duration: 100, easingFunction: "linear" }
        });

        // timeline.focus("currentTime");
    });

    socket.on("set-settings", setSettings);

    socket.on("end", (_data) => {
        items.remove(getItems().filter((d) => {
            console.log(d);
            return d.group == 1;
        }));
        document.getElementById("guard").classList.remove("guard");
        handleDataUpdate(_data);
        setTimeout(() => {
            timeline.setCustomTime(start_timeline, "currentTime");
        }, 500);
    });
});

function handleDataUpdate(data) {
    for (const idx in data) {
        items.update(data[idx]);
    }
}

function sendDataUpdate() {
    const data = getItems();
    socket.emit("data", data);
}

function initTerminal() {
    const terminalOpts = {
        fontWeight: "200",
        fontWeightBold: "700",
        // minimumContrastRatio: 4.5,
        // windowsMode: true,
        wordSeparator: ";",
        theme: {
            background: "#111111",
            black: "#111111",
            red: "#FF725C",
            brightRed: "#FF4136",
            blue: "#357EDD",
            brightBlue: "#00449E",
            green: "#19A974",
            brightGreen: "#137752",
            cyan: "#96CCFF",
            yellow: "#FFD700"
        }
    };
    terminal = new Terminal(terminalOpts);
    fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);
    terminal.open(document.getElementById("terminal-container"));
    fitAddon.fit();
}

function initTimeline() {

    const options = {
        showCurrentTime: false,
        start: start_timeline,
        end: end_timeline,
        itemsAlwaysDraggable: {
            item: false,
            range: false
        },
        stack: true,
        orientation: 'top',
        showMajorLabels: false,
        showMinorLabels: true,
        showWeekScale: false,
        zoomMin: 5000,
        zoomMax: 5000000,
        min: start_timeline - 10,
        minHeight: 300,
        rollingMode: {
            follow: false,
            offset: 0.5
        },
        editable: {
            add: false,
            updateGroup: false,
            updateTime: true,
            remove: true
        },
        tooltip: {
            delay: 500,
        },
        groupOrder: (item) => {
            return item.id;
        },
        loadingScreenTemplate: () => {
            return '<h1>Loading...</h1>';
        },
        format: {
            minorLabels: (date, scale, step) => {
                let d = "";
                switch (scale) {
                    case "second":
                        d = `${date.seconds().toString()}s`; /* jshint ignore: line */
                    case "minute":
                        d = `${date.minutes().toString()}m ${d}`;
                }
                return d;

            }
        }
    };

    groups.add({
        id: 0,
        content: "Planned&nbsp;"
    });

    groups.add({
        id: 1,
        content: "Actual&nbsp;"
    });

    const container = document.getElementById("visualization");
    timeline = new Timeline(container, items, groups, options);

    timeline.setCurrentTime(new Date(start_timeline));
    timeline.setWindow(start_timeline, end_timeline / 2, { animation: false });

    timeline.addCustomTime(start_timeline, "currentTime");
    timeline.addCustomTime(start_timeline, "epoch");
    timeline.on("timechange", function(event) {
        if (event.id == "epoch") {
            timeline.setCustomTime(start_timeline, "epoch");
        }
    });
}

function handleUpdate(event, properties) {
    let task = items.get(properties.items[0]);

    switch (event) {
        case "add":
            {
                sendDataUpdate();
                return;
            }
        case "update":
            {
                task.start = new Date(task.start).getTime();
                task.end = new Date(task.end).getTime();
                break;
            }
        case "remove":
            {
                sendDataUpdate();
                return;
            }
        default:
            {
                console.log(taskIdx, "task unhandled event");
            }
    }
    if (properties.data[0].userData != properties.oldData[0].userData) {
        return;
    } else {
        handleEditBox();
    }
    sendDataUpdate();
}

edit.addEventListener("input", (event) => {
    if (selectedItemId != undefined) {
        let selectedItem = items.get(selectedItemId);
        selectedItem.content = edit.querySelector("#edit-name").value;

        selectedItem.start = edit.querySelector("#edit-start").value * 1000;
        selectedItem.end = (edit.querySelector("#edit-start").value * 1000 +
            edit.querySelector("#edit-duration").value * 1000);


        selectedItem.userData.command = edit.querySelector("#edit-command").value;
        selectedItem.userData.retrigger = edit.querySelector("#edit-retrigger").checked;


        items.updateOnly(selectedItem);
        sendDataUpdate();
    }
});

function handleEditBox() {
    if (selectedItemId != undefined) {
        let selectedItem = items.get(selectedItemId);
        let enable = selectedItem.group == 0;

        if (enable) {
            edit.classList.remove("b--black-20");
            edit.classList.add("b--yellow");
        }

        edit.querySelector("#edit-name").value = selectedItem.content;

        edit.querySelector("#edit-start").value = (selectedItem.start / 1000);
        edit.querySelector("#edit-duration").value = (selectedItem.end - selectedItem.start) / 1000;

        edit.querySelector("#edit-name").disabled = !enable;
        edit.querySelector("#edit-start").disabled = !enable;
        edit.querySelector("#edit-duration").disabled = !enable;

        edit.querySelector("#custom-command").classList.remove("dn");
        edit.querySelector("#edit-command").value = selectedItem.userData.command;
        edit.querySelector("#edit-retrigger").checked = selectedItem.userData.retrigger;

        edit.querySelector("#edit-command").disabled = !enable;
        edit.querySelector("#edit-retrigger").disabled = !enable;

    } else {
        edit.classList.add("b--black-20");
        edit.classList.remove("b--yellow");

        edit.querySelector("#edit-name").value = "";

        edit.querySelector("#edit-start").value = "";
        edit.querySelector("#edit-duration").value = "";

        edit.querySelector("#custom-command").classList.add("dn");

        edit.querySelector("#edit-start").disabled = true;
        edit.querySelector("#edit-duration").disabled = true;
        edit.querySelector("#edit-name").disabled = true;
        edit.querySelector("#edit-command").disabled = true;
        edit.querySelector("#edit-retrigger").disabled = true;

    }
}

function itemSelected(properties) {
    if (properties.items[0] != undefined) {
        selectedItemId = properties.items[0];
    } else {
        selectedItemId = undefined;
    }
    handleEditBox();
}

function getItems() {
    let data = [];
    items.forEach((item, id) => {
        data.push(item);
    });
    return data;
}


function findNextId() {
    const list = getItems();
    if (list.length == 0) {
        return 0;
    }

    let ids = {};
    for (const i in list) {
        if (list[i].group == 0) {
            ids[list[i].id] = true;
        }
    }

    console.log(ids);

    for (var i = 0; i < list.length + 1; i++) {
        if (ids[i] != true) {
            return i;
        }
    }

    return i + 1;
}


function findNextSlot() {
    let data = getItems();
    data = data.filter((d) => {
        return d.group == 0;
    });

    data = data.sort((a, b) => {
        return (a.start >= b.start);
    });

    let occupiedUntil = start_timeline;
    for (let i = 0; i < data.length; i++) {
        if (data[i].start <= occupiedUntil) {
            occupiedUntil = data[i].end;
        }
    }
    return occupiedUntil;
}


initTimeline();
initTerminal();
initTaskbar((active) => {
    if (active == "terminal") {
        fitAddon.fit();
    } else if (active == "schedule") {
        timeline.redraw();
    }
});
initSettings(socket);

items.on('*', (event, properties) => {
    handleUpdate(event, properties);
});

timeline.on('select', (properties) => {
    itemSelected(properties);
});

timeline.on("doubleClick", () => {});


function addElement(type, command) {
    const start = findNextSlot();
    const nextId = findNextId();

    items.add({
        id: nextId,
        group: 0,
        start: start,
        end: start + 10 * 1000,
        content: `${nextId} ${type}`,
        className: type,
        userData: {
            type: type,
            command: command,
            actual: {
                start: -1000,
                end: -100
            }
        }
    });
}

document.getElementById("add-custom").onclick = () => {
    addElement("custom", "ping -c 4 127.0.0.1");
};

document.getElementById("add-download").onclick = () => {
    addElement("download",
        "nextcloudcmd --trust --user \"NEXTCLOUD_USERNAME\" --password \"NEXTCLOUD_PASSWORD\" ./download NEXTCLOUD_URL/download"
    );
};

document.getElementById("add-video").onclick = () => {
    addElement("video", "vlc --repeat ./download/*.mp4");
};

document.getElementById("fit-timeline").onclick = () => {
    timeline.fit();
};

document.getElementById("toggle-rolling").onclick = () => {

    const data = getItems();
    socket.emit("start", data);

    timeline.setCurrentTime(new Date(start_timeline));
    // document.getElementById("guard").classList.add("guard")
};