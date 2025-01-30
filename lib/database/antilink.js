const config = require("../../config");
const { DataTypes } = require("sequelize");

const AntiLinkDB = config.DATABASE.define("AntiLink", {
    chat: {
        type: DataTypes.STRING,
        allowNull: false
    },
    action: {
        type: DataTypes.STRING,
        defaultValue: 'delete'
    },
    status: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true
    }
});

module.exports = {
    AntiLinkDB,
    async enableAntilink(jid, action = 'delete') {
        let data = await AntiLinkDB.findOne({ where: { chat: jid }});
        if (data) {
            await data.update({ status: true, action });
            return data;
        }
        return await AntiLinkDB.create({ chat: jid, action, status: true });
    },
    async disableAntilink(jid) {
        let data = await AntiLinkDB.findOne({ where: { chat: jid }});
        if (data) {
            await data.update({ status: false });
            return data;
        }
        return false;
    },
    async getSettings(jid) {
        return await AntiLinkDB.findOne({ where: { chat: jid }});
    }
};