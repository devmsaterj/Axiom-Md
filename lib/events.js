var config = require("../config");
var commands = [];

function command(info, func) {
    var infos = {
        function: func,
        fromMe: info.fromMe ?? true,
        onlyGroup: info.onlyGroup ?? false,
        onlyPm: info.onlyPm ?? false,
        desc: info.desc ?? '',
        type: info.type ?? 'misc',
        dontAddCommandList: info.dontAddCommandList ?? false,
        on: info.on ?? false
    };

    if (info.pattern) {
        if (info.pattern instanceof RegExp) {
            infos.pattern = new RegExp(`^${config.HANDLERS}${info.pattern.source}$`, `is`);
        } else {
            infos.pattern = new RegExp(`^${config.HANDLERS}${info.pattern}$`, `is`);
        }
    }
    
    if (info.on === 'text') {
        infos.on = 'text';
        infos.pattern = false;
    }

    commands.push(infos);
}

module.exports = {
    command,
    commands,
};
