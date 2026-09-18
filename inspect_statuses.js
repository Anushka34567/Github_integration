
const path = require('path')
const nconf = require('nconf')
const winston = require('./src/logger')
const async = require('async')

global.env = process.env.NODE_ENV || 'production'

// Load Config
nconf.file({
    file: path.join(__dirname, '/config.yml'),
    format: require('nconf-yaml')
})

nconf.defaults({
    base_dir: __dirname
})

const db = require('./src/database')

db.init(function (err) {
    if (err) {
        console.error(err)
        process.exit(1)
    }

    const ticketStatusSchema = require('./src/models/ticketStatus')

    ticketStatusSchema.find({}, function (err, statuses) {
        if (err) { console.error(err); process.exit(1); }

        console.log('--- Ticket Statuses ---');
        statuses.forEach(s => {
            console.log(`ID: ${s._id}, Name: ${s.name}, isResolved: ${s.isResolved}`);
        });
        process.exit(0);
    });
})
