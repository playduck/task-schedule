/* jshint esversion: 9 */

const path = require("path");

const dashboardDir = "./public/dashboard";

function route(express, app) {

    app.get('/dashboard', (req, res) => {
        const resPath = path.resolve(path.join(dashboardDir, "index.html"));
        res.sendFile(resPath);
    });

    app.get("/tachyons.css", (req, res) => {
        const resPath = path.resolve("./node_modules/tachyons/css/tachyons.min.css");
        res.sendFile(resPath, "tachyons.css");
    });

    app.get("/xterm.css", (req, res) => {
        const resPath = path.resolve("./node_modules/xterm/css/xterm.css");
        res.sendFile(resPath, "xterm.css");
    });

    app.use(express.static(path.resolve(dashboardDir)));

    app.get('*', function(req, res, next) {
        throw new Error('woops');
    });

    app.use(function(error, req, res, next) {
        console.log("Error loading", req.path);
        res.json({ message: error.message });
    });
}

module.exports = {
    route
};