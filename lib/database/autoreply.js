const config = require("../../config");
const { DataTypes } = require("sequelize");

const DMAutoReplyDB = config.DATABASE.define("DMAutoReply", {
    pattern: {
        type: DataTypes.STRING,
        allowNull: false
    },
    response: {
        type: DataTypes.TEXT,
        allowNull: false
    },
    enabled: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
    }
});

module.exports = {
    DMAutoReplyDB,
    async getDMReplies() {
        return await DMAutoReplyDB.findAll();
    },
    async addDMReply(pattern, response) {
        return await DMAutoReplyDB.create({ pattern, response });
    },
    async deleteDMReply(pattern) {
        return await DMAutoReplyDB.destroy({ where: { pattern } });
    },
    async toggleDMReply(enabled) {
        return await DMAutoReplyDB.update({ enabled }, { where: {} });
    },
    async getDMStatus() {
        const reply = await DMAutoReplyDB.findOne();
        return reply ? reply.enabled : true;
    }
};