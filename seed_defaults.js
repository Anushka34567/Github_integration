const path = require('path');
const nconf = require('nconf');
const _ = require('lodash');
const async = require('async');

nconf.file({
    file: path.join(__dirname, 'config.yml'),
    format: require('nconf-yaml')
});

const database = require('./src/database');
const TicketType = require('./src/models/tickettype');
const Priority = require('./src/models/ticketpriority');
const Status = require('./src/models/ticketStatus');
const Setting = require('./src/models/setting');

console.log('Connecting to database...');

database.init(function (err, db) {
    if (err) {
        console.error('Failed to connect:', err);
        process.exit(1);
    }

    console.log('Connected. Seeding default data...');

    async.series([
        function seedPriorities(next) {
            console.log('Seeding Priorities...');
            const priorities = [
                { name: 'Normal', migrationNum: 1, default: true, htmlColor: '#29b955' },
                { name: 'Urgent', migrationNum: 2, default: true, htmlColor: '#d32f2f' },
                { name: 'Critical', migrationNum: 3, default: true, htmlColor: '#2196F3' }
            ];

            async.each(priorities, function (p, cb) {
                Priority.findOne({ name: p.name }, function (err, existing) {
                    if (err) return cb(err);
                    if (existing) return cb();

                    const newP = new Priority(p);
                    newP.save(cb);
                });
            }, next);
        },
        function seedStatuses(next) {
            console.log('Seeding Statuses...');
            // Based on defaults.js logic
            const statuses = [
                { name: 'New', htmlColor: '#29b955', uid: 0, order: 0, isResolved: false, slatimer: true, isLocked: true },
                { name: 'Open', htmlColor: '#d32f2f', uid: 1, order: 1, isResolved: false, slatimer: true, isLocked: true },
                { name: 'Pending', htmlColor: '#2196F3', uid: 2, order: 2, isResolved: false, slatimer: false, isLocked: true },
                { name: 'Closed', htmlColor: '#CCCCCC', uid: 3, order: 3, isResolved: true, slatimer: false, isLocked: true }
            ];

            async.each(statuses, function (s, cb) {
                Status.findOne({ name: s.name }, function (err, existing) {
                    if (err) return cb(err);
                    if (existing) return cb();

                    const newS = new Status(s);
                    newS.save(cb);
                });
            }, next);
        },
        function seedTicketTypes(next) {
            console.log('Seeding Ticket Types...');
            TicketType.getTypes(function (err, types) {
                if (err) return next(err);
                if (types && types.length > 0) return next();

                // Need priorities for the type
                Priority.find({}, function (err, priorities) {
                    if (err) return next(err);

                    const newType = new TicketType({
                        name: 'Issue',
                        priorities: priorities.map(p => p._id)
                    });

                    newType.save(next);
                });
            });
        },
        function setDefaults(next) {
            console.log('Setting Defaults...');

            async.parallel([
                function (cb) {
                    TicketType.findOne({ name: 'Issue' }, function (err, type) {
                        if (err || !type) return cb();
                        Setting.findOne({ name: 'ticket:type:default' }, function (err, setting) {
                            if (existingSetting(err, setting, cb)) return;

                            const s = new Setting({
                                name: 'ticket:type:default',
                                value: type._id
                            });
                            s.save(cb);
                        });
                    });
                },
                function (cb) {
                    Status.findOne({ name: 'New' }, function (err, status) {
                        if (err || !status) return cb();
                        Setting.findOne({ name: 'ticket:status:default' }, function (err, setting) {
                            if (existingSetting(err, setting, cb)) return;

                            const s = new Setting({
                                name: 'ticket:status:default',
                                value: status._id
                            });
                            s.save(cb);
                        });
                    });
                }
            ], next);
        }
    ], function (err) {
        if (err) {
            console.error('Error seeding defaults:', err);
            process.exit(1);
        }
        console.log('Seed completed successfully!');
        process.exit(0);
    });
});

function existingSetting(err, setting, cb) {
    if (err) { return cb(err); }
    if (setting) { return cb(true); } // Treat existing as error to skip in parallel but we handle callback
    return false;
}
