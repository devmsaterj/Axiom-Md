const config = require("../../config");
const { DataTypes } = require("sequelize");

const AntiSpamDB = config.DATABASE.define("AntiSpam", {
    chat: {
        type: DataTypes.STRING,
        allowNull: false
    },
    action: {
        type: DataTypes.STRING,
        defaultValue: 'warn'
    },
    limit: {
        type: DataTypes.INTEGER,
        defaultValue: 5
    },
    time: {
        type: DataTypes.INTEGER,
        defaultValue: 10
    },
    status: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    }
});

module.exports = {
    AntiSpamDB,
    async getspam(jid) {
        return await AntiSpamDB.findOne({ where: { chat: jid }});
    },
    async updateSettings(jid, data) {
        let settings = await AntiSpamDB.findOne({ where: { chat: jid }});
        if (settings) return await settings.update(data);
        return await AntiSpamDB.create({ chat: jid, ...data });
    }
};