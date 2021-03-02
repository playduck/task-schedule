/* jshint esversion: 10 */

const settingsDom = document.getElementById("settings")

function setSettings(_settings) {
    settingsDom.querySelector("#logs-save").checked = _settings.logging.logsSave;
    settingsDom.querySelector("#logs-stdout").checked = _settings.logging.logsStdout;

    settingsDom.querySelector("#cloud-url").value = _settings.cloud.cloudURL;
    settingsDom.querySelector("#cloud-name").value = _settings.cloud.cloudName;
    settingsDom.querySelector("#cloud-passwd").value = _settings.cloud.cloudPasswd;

    settingsDom.querySelector("#gpio-pin").value = _settings.sync.gpioPin;
    settingsDom.querySelector("#gpio-active").value = _settings.sync.gpioActive;
}

function addSettingsEventListener(_socket) {

    settingsDom.addEventListener("change", () => {
        const settings = {
                logging: {
                    logsSave: settingsDom.querySelector("#logs-save").checked,
                    logsStdout: settingsDom.querySelector("#logs-stdout").checked
                },
                cloud: {
                    cloudURL: settingsDom.querySelector("#cloud-url").value,
                    cloudName: settingsDom.querySelector("#cloud-name").value,
                    cloudPasswd: settingsDom.querySelector("#cloud-passwd").value
                },
                sync: {
                    gpioPin: settingsDom.querySelector("#gpio-pin").value,
                    gpioActive: settingsDom.querySelector("#gpio-active").value
                }
            }
            // console.log(settings);
        _socket.emit("set-settings", settings);
    });

}

module.exports = {
    initSettings: addSettingsEventListener,
    setSettings: setSettings
}