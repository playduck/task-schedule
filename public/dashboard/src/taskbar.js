/* jshint esversion: 9 */

function hideSections() {
    document.getElementById("schedule").hidden = true;
    document.getElementById("schedule-button").classList.remove("bg-dark-gray");
    document.getElementById("settings").hidden = true;
    document.getElementById("settings-button").classList.remove("bg-dark-gray");
    document.getElementById("terminal").hidden = true;
    document.getElementById("terminal-button").classList.remove("bg-dark-gray");
}

function initTaskbar(cb) {

    document.getElementById("schedule-button").onclick = () => {
        hideSections()
        document.getElementById("schedule").hidden = false;
        document.getElementById("schedule-button").classList.add("bg-dark-gray");
        cb("schedule");
    }

    document.getElementById("settings-button").onclick = () => {
        hideSections()
        document.getElementById("settings").hidden = false;
        document.getElementById("settings-button").classList.add("bg-dark-gray");
        cb("settings");
    }

    document.getElementById("terminal-button").onclick = () => {
        hideSections()
        document.getElementById("terminal").hidden = false;
        document.getElementById("terminal-button").classList.add("bg-dark-gray");
        cb("terminal");
    }

}

module.exports = {
    initTaskbar
}