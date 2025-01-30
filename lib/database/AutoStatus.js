const config = require('../../config');
const { DataTypes } = require('sequelize');

const AutoStatusDB = config.DATABASE.define('AutoStatus', {
    enabled: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    }
});

async function getAutoStatus() {
    const [status] = await AutoStatusDB.findOrCreate({
        where: {},
        defaults: { enabled: false }
    });
    return status.enabled;
}

async function setAutoStatus(enabled) {
    const [status] = await AutoStatusDB.findOrCreate({
        where: {},
        defaults: { enabled }
    });
    status.enabled = enabled;
    await status.save();
    return status.enabled;
}

module.exports = {
    AutoStatusDB,
    getAutoStatus,
    setAutoStatus
};