const { DataTypes } = require('sequelize');
const config = require('../../config');

const AntiDeleteDB = config.DATABASE.define('antidelete', {
    enabled: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    destination: {
        type: DataTypes.STRING,
        allowNull: true
    }
});

async function getAntiDelete() {
    const [data] = await AntiDeleteDB.findOrCreate({ where: {} });
    return data.enabled;
}

async function setAntiDelete(enabled) {
    const [data] = await AntiDeleteDB.findOrCreate({ where: {} });
    data.enabled = enabled;
    await data.save();
    return data.enabled;
}

async function setDestination(jid) {
    const [data] = await AntiDeleteDB.findOrCreate({ where: {} });
    data.destination = jid;
    await data.save();
    return data.destination;
}

async function getDestination() {
    const [data] = await AntiDeleteDB.findOrCreate({ where: {} });
    return data.destination;
}

module.exports = {
    AntiDeleteDB,
    getAntiDelete,
    setAntiDelete,
    setDestination,
    getDestination
};