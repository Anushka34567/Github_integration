
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

    const ticketSchema = require('./src/models/ticket')

    ticketSchema.getForCache(function (err, tickets) {
        if (err) {
            console.error(err);
            process.exit(1);
        }

        console.log(`Found ${tickets.length} tickets in cache query range (last 365 days).`);

        let closedCount = 0;
        tickets.forEach(t => {
            console.log(`Ticket T#${t.uid}: Status=${t.status}, Subject="${t.subject}", Date=${t.date}`);
            if (t.status === 3) {
                closedCount++;
            }
        });

        console.log(`Calculated Closed Count: ${closedCount}`);
        console.log(`Calculated Total: ${tickets.length}`);

        process.exit(0);
    });
})
