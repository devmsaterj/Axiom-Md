const config = require("../../config");
const { DataTypes } = require("sequelize");

const AntiBadWordDB = config.DATABASE.define("AntiBadWord", {
    chat: {
        type: DataTypes.STRING,
        allowNull: false
    },
    words: {
        type: DataTypes.TEXT,
        allowNull: false,
        defaultValue: '[]',
        get() {
            return JSON.parse(this.getDataValue('words'));
        },
        set(value) {
            this.setDataValue('words', JSON.stringify(value));
        }
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
    AntiBadWordDB,
    async enableAntiBadWord(jid, action = 'delete') {
        let data = await AntiBadWordDB.findOne({ where: { chat: jid }});
        if (data) {
            return await data.update({ status: true, action });
        }
        return await AntiBadWordDB.create({ chat: jid, action, status: true });
    },
    async disableAntiBadWord(jid) {
        let data = await AntiBadWordDB.findOne({ where: { chat: jid }});
        if (data) {
            return await data.update({ status: false });
        }
        return false;
    },
    async getAntiBadWord(jid) {
        return await AntiBadWordDB.findOne({ where: { chat: jid }});
    },
    async addBadWord(jid, word) {
        let data = await AntiBadWordDB.findOne({ where: { chat: jid }});
        if (data) {
            const words = data.words;
            words.push(word.toLowerCase());
            return await data.update({ words });
        }
        return await AntiBadWordDB.create({ chat: jid, words: [word.toLowerCase()] });
    },
    async removeBadWord(jid, word) {
        let data = await AntiBadWordDB.findOne({ where: { chat: jid }});
        if (data) {
            const words = data.words.filter(w => w !== word.toLowerCase());
            return await data.update({ words });
        }
        return false;
    }
};