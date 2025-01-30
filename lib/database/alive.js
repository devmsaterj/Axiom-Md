const config = require("../../config");
const { DataTypes } = require("sequelize");

const AliveDB = config.DATABASE.define("Alive", {
    message: {
        type: DataTypes.TEXT,
        allowNull: false,
        defaultValue: "*Bot Status*\n\n*User:* @user\n*Version:* @version\n*Uptime:* @uptime\n*Commands:* @cmds",
        validate: {
            isString(value) {
                if (typeof value !== 'string') {
                    throw new Error('Message must be a string');
                }
            }
        }
    }
});

module.exports = {
    AliveDB,
    async getMessage() {
        let msg = await AliveDB.findOne();
        return msg?.message || "*Bot Status*\n\n*User:* @user\n*Version:* @version\n*Uptime:* @uptime\n*Commands:* @cmds";
    },
    async setMessage(text) {
        // Ensure text is string
        const message = typeof text === 'string' ? text : String(text);
        let msg = await AliveDB.findOne();
        if (msg) {
            return await msg.update({ message });
        }
        return await AliveDB.create({ message });
    }
};